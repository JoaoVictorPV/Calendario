import { supabase, isSupabaseOffline } from './supabase';

const TABLE = 'user_prefs';

function localKey(userId) {
  return `clepsidra_prefs_${userId}`;
}

export async function loadUserPrefs(userId) {
  if (!userId) return {};

  // local primeiro
  const localValue = (() => {
    try {
      const raw = localStorage.getItem(localKey(userId));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })();

  if (isSupabaseOffline) return localValue;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('prefs')
      .eq('user_id', userId)
      .limit(1);

    if (error) return localValue;
    const remote = data?.[0]?.prefs ?? {};
    return { ...localValue, ...remote };
  } catch {
    return localValue;
  }
}

export async function saveUserPrefs(userId, prefsPatch) {
  if (!userId) return;

  // merge local
  const current = await loadUserPrefs(userId);
  const next = { ...current, ...(prefsPatch || {}) };
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(next));
  } catch {
    // ignore
  }

  if (isSupabaseOffline) return;

  try {
    await supabase
      .from(TABLE)
      .upsert([
        {
          user_id: userId,
          prefs: next,
          updated_at: new Date().toISOString(),
        },
      ], { onConflict: 'user_id' });
  } catch {
    // ignore
  }
}
