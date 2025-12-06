import React from 'react';
import { X, Trash2, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function TagManager({ onClose, tags, setTags }) {
  
  const handleDeleteTag = async (id) => {
    await supabase.from('tags').delete().eq('id', id);
    setTags(tags.filter(t => t.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
      <div className="bg-background w-full max-w-sm rounded-2xl shadow-xl border border-border flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Tag size={18} /> Gerenciar Tags
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded-full text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
           {tags.length === 0 ? (
             <p className="text-center text-muted-foreground py-4 text-sm">Nenhuma tag criada.</p>
           ) : (
             tags.map(tag => (
               <div key={tag.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-border">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full ring-1 ring-border"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="font-medium text-sm">{tag.name}</span>
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
  );
}
