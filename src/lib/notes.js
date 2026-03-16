import { supabase, isSupabaseOffline } from './supabase';

const TABLE = 'event_notes';

function localKey(userId, eventId) {
  return `clepsidra_note_${userId}_${eventId}`;
}

export async function getEventNote({ userId, eventId }) {
  if (!userId || !eventId) return null;

  // Sempre tenta ler do local como fallback
  const localValue = (() => {
    try {
      return localStorage.getItem(localKey(userId, eventId)) || '';
    } catch {
      return '';
    }
  })();

  if (isSupabaseOffline) return localValue;

  // Supabase
  // (evita usar maybeSingle porque pode não existir em alguns builds)
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, content')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .limit(1);

  // maybeSingle pode não existir no client offline, mas aqui já estamos online.
  if (error) {
    // Se a tabela ainda não existir, não quebra o app.
    return localValue;
  }

  const remoteValue = data?.[0]?.content ?? '';
  // Se remoto vazio, mas local tem, usa local (caso tabela não tenha sido criada antes)
  return remoteValue || localValue;
}

export async function upsertEventNote({ userId, eventId, content }) {
  if (!userId || !eventId) return;
  const value = (content ?? '').toString();

  // Espelha em localStorage sempre (garante que funcione mesmo se a tabela do Supabase ainda não existir)
  try {
    localStorage.setItem(localKey(userId, eventId), value);
  } catch {
    // ignore
  }

  if (isSupabaseOffline) return;

  // Se o usuário apagar o texto, remove a nota.
  if (!value.trim()) {
    try {
      await supabase.from(TABLE).delete().eq('user_id', userId).eq('event_id', eventId);
    } catch {
      // ignore (ex.: tabela ainda não criada no Supabase)
    }
    return;
  }

  // Upsert por (user_id,event_id)
  try {
    await supabase
      .from(TABLE)
      .upsert(
        [{
          user_id: userId,
          event_id: eventId,
          content: value,
          updated_at: new Date().toISOString(),
        }],
        { onConflict: 'user_id,event_id' }
      );
  } catch {
    // ignore (ex.: tabela ainda não criada no Supabase)
  }
}

export async function getNotesForEvents({ userId, eventIds }) {
  if (!userId || !Array.isArray(eventIds) || eventIds.length === 0) return {};

  const uniqueIds = Array.from(new Set(eventIds)).filter(Boolean);
  if (uniqueIds.length === 0) return {};

  const localOut = {};
  for (const id of uniqueIds) {
    try {
      localOut[id] = localStorage.getItem(localKey(userId, id)) || '';
    } catch {
      localOut[id] = '';
    }
  }

  if (isSupabaseOffline) return localOut;

  const { data, error } = await supabase
    .from(TABLE)
    .select('event_id, content')
    .eq('user_id', userId)
    .in('event_id', uniqueIds);

  if (error) {
    // Se a tabela ainda não existir, não quebra o app.
    return localOut;
  }

  const out = {};
  (data || []).forEach((row) => {
    out[row.event_id] = row.content || '';
  });

  // Merge: remoto ganha, mas se remoto vazio e local tem, mantém local
  const merged = { ...localOut, ...out };
  for (const id of Object.keys(merged)) {
    if (!merged[id] && localOut[id]) merged[id] = localOut[id];
  }

  return merged;
}
