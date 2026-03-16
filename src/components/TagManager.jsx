import React, { useState } from 'react';
import { X, Trash2, Tag, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { predefinedTagColors } from '../lib/tagColors';

export function TagManager({ onClose, tags, setTags }) {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#A7C957'); // Default Sage

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from('tags').insert([{
      name: newTagName.trim(),
      color: newTagColor,
      user_id: user.id
    }]).select();

    if (data) {
      setTags([...tags, data[0]]);
      setNewTagName('');
    }
  };
  
  const handleDeleteTag = async (id) => {
    await supabase.from('tags').delete().eq('id', id);
    setTags(tags.filter(t => t.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
      <div className="bg-background w-full max-w-sm rounded-2xl shadow-xl border border-border flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        
        <div className="p-4 border-b border-border flex items-center justify-between bg-card/60">
          <h2 className="text-lg font-medium flex items-center gap-2 text-foreground">
            <Tag size={18} className="text-primary" /> Gerenciar Tags
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded-full text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
           
           {/* Create Tag Section */}
           <div className="p-4 bg-secondary/30 rounded-xl border border-border space-y-3">
             <div className="flex gap-2">
               <input 
                 placeholder="Nova Tag..."
                 className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-all text-foreground"
                 value={newTagName}
                 onChange={e => setNewTagName(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
               />
               <button 
                 onClick={handleCreateTag}
                 disabled={!newTagName.trim()}
                 className="px-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
               >
                 <Plus size={20} />
               </button>
             </div>
             
             <div className="flex gap-2 flex-wrap justify-center">
               {predefinedTagColors.map(color => (
                 <button
                   key={color}
                   onClick={() => setNewTagColor(color)}
                   className={cn(
                     "w-6 h-6 rounded-full transition-transform hover:scale-110 ring-offset-1 ring-offset-background",
                     newTagColor === color && "ring-2 ring-foreground scale-110"
                   )}
                   style={{ backgroundColor: color }}
                 />
               ))}
             </div>
           </div>

           <div className="h-px bg-border w-full" />

           {/* Tags List */}
           <div className="space-y-2">
             {tags.length === 0 ? (
               <p className="text-center text-muted-foreground py-4 text-sm">Nenhuma tag criada.</p>
             ) : (
               tags.map(tag => (
                 <div key={tag.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full ring-1 ring-border"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="font-medium text-sm text-foreground">{tag.name}</span>
                    </div>
                    <button 
                      onClick={() => handleDeleteTag(tag.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                 </div>
               ))
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
