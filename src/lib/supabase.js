import { createClient } from '@supabase/supabase-js'
import { initialTags, initialEvents } from './initialData';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let client;
let isOffline = false;

if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http') && !supabaseUrl.includes('admin')) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey)
  } catch (e) {
    console.warn("Supabase init failed, using offline mode", e)
    isOffline = true;
  }
} else {
  isOffline = true;
}

// --- Offline Mode Logic (LocalStorage) ---

const localDb = {
  get: (table) => {
    try {
      const stored = localStorage.getItem(`clepsidra_${table}`);
      if (!stored) {
        // Seed initial data if empty
        let seedData = [];
        if (table === 'tags') seedData = initialTags;
        if (table === 'events') seedData = initialEvents;
        
        if (seedData.length > 0) {
           localStorage.setItem(`clepsidra_${table}`, JSON.stringify(seedData));
           return seedData;
        }
        return [];
      }
      return JSON.parse(stored);
    } catch { return []; }
  },
  set: (table, data) => localStorage.setItem(`clepsidra_${table}`, JSON.stringify(data)),
  add: (table, item) => {
    const data = localDb.get(table);
    const newItem = { ...item, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    data.push(newItem);
    localDb.set(table, data);
    return newItem;
  },
  update: (table, id, updates) => {
    const data = localDb.get(table);
    const index = data.findIndex(i => i.id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...updates };
      localDb.set(table, data);
      return data[index];
    }
    return null;
  },
  delete: (table, id) => {
    const data = localDb.get(table);
    const newData = data.filter(i => i.id !== id);
    localDb.set(table, newData);
  }
};

const offlineClient = {
  auth: {
    getSession: async () => {
      const user = localStorage.getItem('clepsidra_user');
      return { 
        data: { 
          session: user ? { user: { id: 'offline-user-id', email: user } } : null 
        } 
      }
    },
    onAuthStateChange: (callback) => {
      return { data: { subscription: { unsubscribe: () => {} } } }
    },
    signInWithOtp: async ({ email }) => {
      localStorage.setItem('clepsidra_user', email);
      window.location.reload(); 
      return { error: null };
    },
    signOut: async () => {
      localStorage.removeItem('clepsidra_user');
      // Also clear data on logout? Maybe not for offline demo persistence.
      // But typically logout clears session.
      window.location.reload();
      return { error: null };
    }
  },
  from: (table) => ({
    select: async () => ({ data: localDb.get(table), error: null }),
    
    insert: (data) => {
      const items = Array.isArray(data) ? data : [data];
      const newItems = items.map(item => localDb.add(table, item));
      
      return {
        select: async () => ({ data: newItems, error: null }),
        then: (resolve) => resolve({ data: null, error: null })
      };
    },
    
    update: (updates) => ({
      eq: async (field, value) => {
        if (field === 'id') {
           localDb.update(table, value, updates);
        }
        return { error: null };
      }
    }),
    
    delete: () => ({
      eq: async (field, value) => {
        if (field === 'id') {
          localDb.delete(table, value);
        }
        return { error: null };
      }
    })
  })
};

export const supabase = client || offlineClient;

// Exponho o modo offline (útil para feature-flags sem quebrar o app)
export const isSupabaseOffline = isOffline;
