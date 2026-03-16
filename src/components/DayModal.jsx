import React, { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, MessageSquareText, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { predefinedTagColors } from '../lib/tagColors';
import { getEventNote, getNotesForEvents, upsertEventNote } from '../lib/notes';

export function DayModal({ date, onClose, events, tags, setEvents, setTags, session }) {
  const dateKey = format(date, 'yyyy-MM-dd');
  const dayEvents = events.filter(e => e.date === dateKey);

  // Observações (por evento selecionado)
  const [selectedEventIdForNote, setSelectedEventIdForNote] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteStatus, setNoteStatus] = useState('idle'); // idle | saving | saved
  const saveTimerRef = useRef(null);

  const [notesByEventId, setNotesByEventId] = useState({});

  const [newEventTitle, setNewEventTitle] = useState('');
  const [selectedTagId, setSelectedTagId] = useState(null);
  
  // Tag Creation State
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#A7C957'); // Default Sage

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
      // Seleciona automaticamente o novo evento para observações
      setSelectedEventIdForNote(data[0].id);
    }
  };

  const handleDeleteEvent = async (id) => {
    await supabase.from('events').delete().eq('id', id);
    setEvents(events.filter(e => e.id !== id));

    if (selectedEventIdForNote === id) {
      setSelectedEventIdForNote(null);
      setNoteDraft('');
    }
  };

  const handleUpdateEvent = async (id, newTitle) => {
    await supabase.from('events').update({ title: newTitle }).eq('id', id);
    setEvents(events.map(e => e.id === id ? { ...e, title: newTitle } : e));
  };

  const [openNotePreview, setOpenNotePreview] = useState(null); // { title, content }

  const copyNote = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        // ignore
      }
    }
  };

  // Carrega observação quando troca o evento selecionado
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!selectedEventIdForNote) {
        if (alive) setNoteDraft('');
        return;
      }
      const content = await getEventNote({ userId: session.user.id, eventId: selectedEventIdForNote });
      if (alive) {
        setNoteDraft(content || '');
        setNoteStatus('idle');
      }
    })();
    return () => { alive = false; };
  }, [selectedEventIdForNote, session.user.id]);

  // Carrega notas do dia (para ícone por evento)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!session?.user?.id) return;
      const ids = dayEvents.map(e => e.id);
      const map = await getNotesForEvents({ userId: session.user.id, eventIds: ids });
      if (alive) setNotesByEventId(map);
    })();
    return () => { alive = false; };
  }, [dayEvents, session?.user?.id]);

  // Auto-save (debounce)
  useEffect(() => {
    if (!selectedEventIdForNote) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setNoteStatus('saving');

    saveTimerRef.current = setTimeout(async () => {
      await upsertEventNote({
        userId: session.user.id,
        eventId: selectedEventIdForNote,
        content: noteDraft,
      });

      // Notifica outras áreas (ex.: Próximos eventos) para atualizar o ícone/nota.
      try {
        window.dispatchEvent(new CustomEvent('clepsidra_note_updated', {
          detail: { eventId: selectedEventIdForNote }
        }));
      } catch {
        // ignore
      }

      // Atualiza mapa local do DayModal também
      setNotesByEventId(prev => ({ ...prev, [selectedEventIdForNote]: noteDraft }));

      setNoteStatus('saved');
      setTimeout(() => setNoteStatus('idle'), 800);
    }, 600);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [noteDraft, selectedEventIdForNote, session.user.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 border border-border">
        
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-card/60">
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
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-3 outline-none focus:border-primary transition-all shadow-sm text-foreground placeholder:text-muted-foreground/50"
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
                       : "bg-background border-border text-muted-foreground hover:border-foreground/30"
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
                       : "bg-background border-border text-muted-foreground hover:opacity-80"
                     )}
                     style={{ 
                       backgroundColor: selectedTagId === tag.id ? tag.color : 'transparent',
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
                     className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
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
                   {predefinedTagColors.map(color => (
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

          {/* Observações */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Observações</h4>
              <span className="text-[11px] text-muted-foreground">
                {noteStatus === 'saving' ? 'salvando…' : noteStatus === 'saved' ? 'salvo' : ''}
              </span>
            </div>

            <div className="flex gap-2 flex-wrap">
              {dayEvents.map(ev => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setSelectedEventIdForNote(ev.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                    selectedEventIdForNote === ev.id
                      ? 'bg-primary text-primary-foreground border-transparent'
                      : 'bg-background border-border text-muted-foreground hover:bg-secondary/40'
                  )}
                  title="Selecionar evento para observações"
                >
                  <span className="truncate max-w-[150px]">{ev.title}</span>
                  {!!(notesByEventId?.[ev.id] || '').trim() && (
                    <span className="ml-2 inline-flex items-center" title="Tem observação">
                      <MessageSquareText size={14} className="text-foreground/70" />
                    </span>
                  )}
                </button>
              ))}
            </div>

            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              disabled={!selectedEventIdForNote}
              placeholder={selectedEventIdForNote ? 'Escreva suas observações…' : 'Selecione um evento acima para adicionar observações.'}
              className={cn(
                'w-full min-h-[96px] max-h-[180px] resize-y rounded-2xl px-4 py-3 border outline-none transition-all text-sm',
                'bg-background border-border focus:border-primary/60',
                !selectedEventIdForNote && 'opacity-60'
              )}
            />
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
                const content = (notesByEventId?.[event.id] ?? (selectedEventIdForNote === event.id ? noteDraft : ''));
                const hasNote = !!content.trim();
                return (
                  <div key={event.id} className="group flex items-start gap-3 p-3 rounded-xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
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

                     {/* Ícone de observação (se existir) */}
                     {hasNote && (
                       <button
                         type="button"
                         onClick={() => setOpenNotePreview({ title: event.title, content })}
                         className="p-2 rounded-lg hover:bg-secondary/40 border border-border bg-background/60"
                         title="Ver observação"
                       >
                         <MessageSquareText size={16} className="text-muted-foreground" />
                       </button>
                     )}

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

          {/* Modal de Observação (no DayModal também) */}
          {openNotePreview && (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpenNotePreview(null);
              }}
              onTouchStart={(e) => {
                if (e.target === e.currentTarget) setOpenNotePreview(null);
              }}
            >
              <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-border bg-card/60 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{openNotePreview.title}</div>
                    <div className="text-[11px] text-muted-foreground">Observação</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyNote(openNotePreview.content)}
                      className="p-2 rounded-lg hover:bg-secondary/40 border border-border bg-background/60"
                      title="Copiar"
                    >
                      <Copy size={16} className="text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenNotePreview(null)}
                      className="p-2 rounded-lg hover:bg-secondary/40 border border-border bg-background/60"
                      title="Fechar"
                    >
                      <X size={16} className="text-muted-foreground" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {openNotePreview.content}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
