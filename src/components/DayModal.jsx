import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Trash2, Plus, Check, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export function DayModal({ date, onClose, events, tags, setEvents, setTags, session }) {
  const dateKey = format(date, 'yyyy-MM-dd');
  const dayEvents = events.filter(e => e.date === dateKey);

  const [newEventTitle, setNewEventTitle] = useState('');
  const [selectedTagId, setSelectedTagId] = useState(null);
  
  // Tag Creation State
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#A7C957'); // Default Sage

  const predefinedColors = [
    '#A7C957', // Sage
    '#C77DFF', // Lavender
    '#E07A5F', // Terracotta
    '#E9C46A', // Darker Yellow for contrast
    '#81B0FE', // Soft Blue
    '#78716C', // Stone
  ];

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const { data, error } = await supabase.from('tags').insert([{
      name: newTagName.trim(),
      color: newTagColor,
      user_id: session.user.id
    }]).select();

    if (data) {
      setTags([...tags, data[0]]);
      setSelectedTagId(data[0].id);
      setIsCreatingTag(false);
      setNewTagName('');
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    const { data, error } = await supabase.from('events').insert([{
      title: newEventTitle.trim(),
      date: dateKey,
      tag_id: selectedTagId,
      user_id: session.user.id
    }]).select();

    if (data) {
      setEvents([...events, data[0]]);
      setNewEventTitle('');
    }
  };

  const handleDeleteEvent = async (id) => {
    await supabase.from('events').delete().eq('id', id);
    setEvents(events.filter(e => e.id !== id));
  };

  const handleUpdateEvent = async (id, newTitle) => {
    await supabase.from('events').update({ title: newTitle }).eq('id', id);
    setEvents(events.map(e => e.id === id ? { ...e, title: newTitle } : e));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 border border-border">
        
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-white/50">
          <div>
            <h3 className="text-2xl font-medium text-foreground">
              {format(date, "d 'de' MMMM", { locale: ptBR })}
            </h3>
            <p className="text-muted-foreground text-sm capitalize">
              {format(date, "EEEE", { locale: ptBR })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Add Event Form */}
          <div className="space-y-3">
             <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Novo evento..."
                  className="flex-1 bg-white border border-border rounded-xl px-4 py-3 outline-none focus:border-primary transition-all shadow-sm text-foreground placeholder:text-muted-foreground/50"
                  value={newEventTitle}
                  onChange={e => setNewEventTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddEvent(e)}
                  autoFocus
                />
                <button 
                  onClick={handleAddEvent}
                  className="bg-primary text-primary-foreground p-3 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Plus size={24} />
                </button>
             </div>
             
             {/* Tag Selector */}
             <div className="flex flex-wrap items-center gap-2 pb-2">
                <button 
                   onClick={() => setSelectedTagId(null)}
                   className={cn(
                     "px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                     selectedTagId === null 
                       ? "bg-foreground text-background border-foreground" 
                       : "bg-white border-border text-muted-foreground hover:border-foreground/30"
                   )}
                >
                  Sem Tag
                </button>
                {tags.map(tag => (
                   <button
                     key={tag.id}
                     onClick={() => setSelectedTagId(tag.id)}
                     className={cn(
                       "px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1 whitespace-nowrap shadow-sm",
                       selectedTagId === tag.id
                         ? "border-transparent ring-1 ring-offset-1"
                         : "bg-white border-border text-muted-foreground hover:opacity-80"
                     )}
                     style={{ 
                       backgroundColor: selectedTagId === tag.id ? tag.color : 'white',
                       color: selectedTagId === tag.id ? '#FFF' : '',
                       borderColor: selectedTagId === tag.id ? tag.color : ''
                     }}
                   >
                     {tag.name}
                   </button>
                ))}
                <button
                  onClick={() => setIsCreatingTag(!isCreatingTag)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-primary/50 text-primary hover:bg-primary/5 transition-all whitespace-nowrap"
                >
                  + Nova Tag
                </button>
             </div>

             {/* Create Tag UI */}
             {isCreatingTag && (
               <div className="p-4 bg-secondary/30 rounded-xl border border-border animate-in fade-in slide-in-from-top-2">
                 <div className="flex gap-2 mb-3">
                   <input 
                     placeholder="Nome da tag (Ex: Trabalho)"
                     className="flex-1 bg-white border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                     value={newTagName}
                     onChange={e => setNewTagName(e.target.value)}
                   />
                   <button 
                     onClick={handleCreateTag}
                     className="px-4 bg-primary text-white rounded-lg text-sm font-medium"
                   >
                     Salvar
                   </button>
                 </div>
                 <div className="flex gap-2 flex-wrap">
                   {predefinedColors.map(color => (
                     <button
                       key={color}
                       onClick={() => setNewTagColor(color)}
                       className={cn(
                         "w-6 h-6 rounded-full transition-transform hover:scale-110 ring-offset-1",
                         newTagColor === color && "ring-2 ring-foreground"
                       )}
                       style={{ backgroundColor: color }}
                     />
                   ))}
                 </div>
               </div>
             )}
          </div>

          <div className="h-px bg-border w-full" />

          {/* List */}
          <div className="space-y-3">
            {dayEvents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Nenhum evento para este dia.
              </p>
            ) : (
              dayEvents.map(event => {
                const tag = tags.find(t => t.id === event.tag_id);
                return (
                  <div key={event.id} className="group flex items-start gap-3 p-3 rounded-xl bg-white border border-border shadow-sm hover:shadow-md transition-all">
                     <div 
                       className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                       style={{ backgroundColor: tag ? tag.color : '#E5E5E5' }} 
                     />
                     <div className="flex-1">
                        {/* Inline Edit */}
                        <input
                          type="text"
                          defaultValue={event.title}
                          onBlur={(e) => handleUpdateEvent(event.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                               e.target.blur();
                            }
                          }}
                          className="w-full bg-transparent outline-none text-foreground font-medium placeholder:text-muted-foreground/50"
                        />
                        {tag && (
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mt-1">
                            {tag.name}
                          </span>
                        )}
                     </div>
                     <button 
                       onClick={() => handleDeleteEvent(event.id)}
                       className="sm:opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                     >
                       <Trash2 size={16} />
                     </button>
                  </div>
                )
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
