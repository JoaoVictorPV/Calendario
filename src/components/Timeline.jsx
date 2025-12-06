import React from 'react';
import { X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Timeline({ onClose, events, tags }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Filter future events and sort by date
  const futureEvents = events
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Group by Month for panoramic view
  const groupedEvents = futureEvents.reduce((acc, event) => {
    const monthKey = format(parseISO(event.date), 'MMMM yyyy', { locale: ptBR });
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(event);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md h-full bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        <div className="p-6 border-b border-border flex items-center justify-between bg-white/50">
          <h2 className="text-xl font-medium text-foreground">Próximos Eventos</h2>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
           {Object.keys(groupedEvents).length === 0 ? (
             <div className="text-center text-muted-foreground py-12">
               Nenhum evento futuro agendado.
             </div>
           ) : (
             Object.entries(groupedEvents).map(([month, monthEvents]) => (
               <div key={month} className="space-y-4">
                 <h3 className="text-sm font-semibold text-primary uppercase tracking-wider sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                   {month}
                 </h3>
                 <div className="space-y-3 relative border-l-2 border-border ml-2 pl-6">
                   {monthEvents.map(event => {
                     const tag = tags.find(t => t.id === event.tag_id);
                     return (
                       <div key={event.id} className="relative group">
                         <div 
                           className="absolute -left-[29px] top-1.5 w-3 h-3 rounded-full ring-4 ring-background"
                           style={{ backgroundColor: tag ? tag.color : '#E5E5E5' }}
                         />
                         <div className="bg-white p-4 rounded-xl border border-border shadow-sm hover:shadow-md transition-all">
                           <div className="flex justify-between items-start mb-1">
                             <span className="text-sm font-medium text-muted-foreground">
                               {format(parseISO(event.date), "d 'de' MMMM, EEEE", { locale: ptBR })}
                             </span>
                           </div>
                           <h4 className="text-foreground font-medium">{event.title}</h4>
                           {tag && (
                             <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
                               {tag.name}
                             </span>
                           )}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
             ))
           )}
        </div>

      </div>
    </div>
  );
}
