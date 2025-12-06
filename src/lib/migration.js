import { supabase } from './supabase';

export async function migrateLocalData(user) {
  // Security check: Only for specific user
  if (user.email !== 'joaovictorpv@hotmail.com') return;

  try {
    // Check if data already exists in Supabase to avoid duplication
    // We check 'tags' table as a proxy for existing data
    const { count } = await supabase.from('tags').select('*', { count: 'exact', head: true });
    
    if (count !== null && count > 0) {
      console.log("Data already exists in Supabase. Skipping migration.");
      return;
    }

    const localTags = JSON.parse(localStorage.getItem('clepsidra_tags') || '[]');
    const localEvents = JSON.parse(localStorage.getItem('clepsidra_events') || '[]');

    if (localTags.length === 0 && localEvents.length === 0) {
        console.log("No local data to migrate.");
        return;
    }

    console.log("Starting migration for", user.email);

    // 1. Migrate Tags
    const tagIdMap = {}; // oldId -> newUUID
    const tagsToInsert = [];

    for (const tag of localTags) {
      // Check if ID is a valid UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tag.id);
      
      const newId = isUUID ? tag.id : crypto.randomUUID();
      tagIdMap[tag.id] = newId;

      tagsToInsert.push({
        id: newId,
        user_id: user.id,
        name: tag.name,
        color: tag.color,
        created_at: tag.created_at || new Date().toISOString()
      });
    }

    if (tagsToInsert.length > 0) {
      const { error } = await supabase.from('tags').insert(tagsToInsert);
      if (error) {
        console.error("Tag Migration Error:", error);
        return; // Stop if tags fail
      }
    }

    // 2. Migrate Events
    const eventsToInsert = localEvents.map(event => {
      let newTagId = null;
      if (event.tag_id && tagIdMap[event.tag_id]) {
        newTagId = tagIdMap[event.tag_id];
      }

      return {
        // Generate new ID for event to ensure validity
        id: crypto.randomUUID(), 
        user_id: user.id,
        title: event.title,
        date: event.date,
        tag_id: newTagId,
        created_at: event.created_at || new Date().toISOString()
      };
    });

    if (eventsToInsert.length > 0) {
      const { error } = await supabase.from('events').insert(eventsToInsert);
      if (error) console.error("Event Migration Error:", error);
    }

    console.log("Migration Complete Successfully!");
    
    // Clear local storage to verify we are now using cloud data?
    // Or keep it as backup?
    // Better not to delete automatically, user might want to check first.
    // But logic should prioritize fetching from Supabase now.

  } catch (err) {
    console.error("Migration unexpected error:", err);
  }
}
