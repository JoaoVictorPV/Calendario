import { supabase } from './supabase';
import { initialTags, initialEvents } from './initialData';

export async function migrateLocalData(user) {
  // Security check: Only for specific user
  if (user.email !== 'joaovictorpv@hotmail.com') return;

  try {
    // Check if data already exists in Supabase to avoid duplication
    const { count } = await supabase.from('tags').select('*', { count: 'exact', head: true });
    
    if (count !== null && count > 0) {
      console.log("Data already exists in Supabase. Skipping seed.");
      return;
    }

    console.log("Seeding initial data for", user.email);

    // Source: Initial Data (2026 Calendar)
    const tagsSource = initialTags;
    const eventsSource = initialEvents;

    // 1. Insert Tags
    const tagIdMap = {}; 
    const tagsToInsert = [];

    for (const tag of tagsSource) {
      // Generate valid UUIDs for Supabase
      const newId = crypto.randomUUID();
      tagIdMap[tag.id] = newId;

      tagsToInsert.push({
        id: newId,
        user_id: user.id,
        name: tag.name,
        color: tag.color,
        created_at: new Date().toISOString()
      });
    }

    if (tagsToInsert.length > 0) {
      const { error } = await supabase.from('tags').insert(tagsToInsert);
      if (error) {
        console.error("Tag Seed Error:", error);
        return; 
      }
    }

    // 2. Insert Events
    const eventsToInsert = eventsSource.map(event => {
      let newTagId = null;
      if (event.tag_id && tagIdMap[event.tag_id]) {
        newTagId = tagIdMap[event.tag_id];
      }

      return {
        id: crypto.randomUUID(), 
        user_id: user.id,
        title: event.title,
        date: event.date,
        tag_id: newTagId,
        created_at: new Date().toISOString()
      };
    });

    if (eventsToInsert.length > 0) {
      const { error } = await supabase.from('events').insert(eventsToInsert);
      if (error) console.error("Event Seed Error:", error);
    }

    console.log("Seeding 2026 Calendar Complete!");

  } catch (err) {
    console.error("Seeding unexpected error:", err);
  }
}
