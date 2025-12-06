import { supabase } from './supabase';
import { initialTags, initialEvents } from './initialData';

let migrationInProgress = false;

export async function migrateLocalData(user) {
  // Security check: Only for specific user
  if (user.email !== 'joaovictorpv@hotmail.com') return;
  
  // Prevent double-firing
  if (migrationInProgress) return;
  migrationInProgress = true;

  try {
    // 1. DEDUPLICATION / CLEANUP FIRST
    // This fixes the issue if it ran twice already
    await cleanupDuplicates(user.id);

    // Check if data exists (after cleanup, if we deleted everything it would be 0, but we only delete dupes)
    // If we have data, we assume we are good.
    const { count } = await supabase.from('tags').select('*', { count: 'exact', head: true });
    
    if (count !== null && count > 0) {
      console.log("Data present. Migration/Seeding skipped.");
      migrationInProgress = false;
      return;
    }

    console.log("Seeding initial data for", user.email);

    // Source: Initial Data (2026 Calendar)
    const tagsSource = initialTags;
    const eventsSource = initialEvents;

    // 2. Insert Tags
    const tagIdMap = {}; 
    const tagsToInsert = [];

    for (const tag of tagsSource) {
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
        migrationInProgress = false;
        return; 
      }
    }

    // 3. Insert Events
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
  } finally {
      migrationInProgress = false;
  }
}

async function cleanupDuplicates(userId) {
    console.log("Checking for duplicates...");
    
    // 1. Deduplicate Tags
    const { data: allTags } = await supabase.from('tags').select('id, name, color').eq('user_id', userId);
    if (allTags && allTags.length > 0) {
        const seenTags = new Set();
        const dupTags = [];
        
        // Keep the first one seen, mark others for deletion
        for (const t of allTags) {
            const key = `${t.name}|${t.color}`;
            if (seenTags.has(key)) {
                dupTags.push(t.id);
            } else {
                seenTags.add(key);
            }
        }
        
        if (dupTags.length > 0) {
             console.log("Removing duplicate tags:", dupTags.length);
             // We must also delete events linked to these tags to avoid constraint errors, 
             // but Supabase 'on delete set null' (if configured) or cascade handles it. 
             // Our SQL said: "on delete set null". So events become tagless.
             // We will handle event dedup next anyway.
             await supabase.from('tags').delete().in('id', dupTags);
        }
    }

    // 2. Deduplicate Events
    const { data: allEvents } = await supabase.from('events').select('id, title, date').eq('user_id', userId);
    if (allEvents && allEvents.length > 0) {
        const seenEvents = new Set();
        const dupEvents = [];
        
        for (const e of allEvents) {
            const key = `${e.title}|${e.date}`;
            if (seenEvents.has(key)) {
                dupEvents.push(e.id);
            } else {
                seenEvents.add(key);
            }
        }
        
        if (dupEvents.length > 0) {
            console.log("Removing duplicate events:", dupEvents.length);
            await supabase.from('events').delete().in('id', dupEvents);
        }
    }
}
