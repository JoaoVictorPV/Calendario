import { supabase, isSupabaseOffline } from './supabase';

const TABLE = 'event_notes';

function localKey(userId, eventId) {
  return `clepsidra_note_${userId}_${eventId}`;
}

export async function getEventNote({ userId, eventId }) {
  if (!userId || !eventId) return null;

  if (isSupabaseOffline) {
    try {
      return localStorage.getItem(localKey(userId, eventId)) || '';
    } catch {
      return '';
    }
  }

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
    return '';
  }
  return data?.[0]?.content ?? '';
}

export async function upsertEventNote({ userId, eventId, content }) {
  if (!userId || !eventId) return;
  const value = (content ?? '').toString();

  if (isSupabaseOffline) {
    try {
      localStorage.setItem(localKey(userId, eventId), value);
    } catch {
      // ignore
    }
    return;
  }

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

  if (isSupabaseOffline) {
    const out = {};
    for (const id of uniqueIds) {
      try {
        out[id] = localStorage.getItem(localKey(userId, id)) || '';
      } catch {
        out[id] = '';
      }
    }
    return out;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('event_id, content')
    .eq('user_id', userId)
    .in('event_id', uniqueIds);

  if (error) {
    // Se a tabela ainda não existir, não quebra o app.
    return {};
  }

  const out = {};
  (data || []).forEach((row) => {
    out[row.event_id] = row.content || '';
  });
  return out;
}
