import React from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export function Calendar({ currentMonth, setCurrentMonth, events, tags, onSelectDate }) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
  });

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between px-2">
        <button 
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 hover:bg-white rounded-full transition-colors text-muted-foreground hover:text-foreground hover:shadow-sm"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-medium capitalize text-foreground">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <button 
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 hover:bg-white rounded-full transition-colors text-muted-foreground hover:text-foreground hover:shadow-sm"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-2">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(day => (
          <div key={day} className="text-xs text-muted-foreground text-center font-medium py-2">
            {day}
          </div>
        ))}

        {days.map((date, i) => {
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const isTodayDate = isToday(date);
          const dateKey = format(date, 'yyyy-MM-dd');
          const dayEvents = events.filter(e => e.date === dateKey);

          return (
            <button
              key={i}
              onClick={() => onSelectDate(date)}
              className={cn(
                "aspect-[4/5] rounded-xl flex flex-col items-center justify-start pt-2 gap-1 transition-all border",
                isCurrentMonth ? "bg-white border-border/50 shadow-sm" : "bg-transparent border-transparent opacity-40",
                isTodayDate && "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary/50",
                "hover:border-primary/30 hover:shadow-md active:scale-95"
              )}
            >
              <span className={cn(
                "text-sm font-medium",
                isTodayDate && "text-primary"
              )}>
                {format(date, 'd')}
              </span>
              
              {/* Dots Indicator */}
              <div className="flex gap-1 flex-wrap justify-center px-1 w-full content-start h-full">
                {dayEvents.slice(0, 6).map(event => {
                   const tag = tags.find(t => t.id === event.tag_id);
                   const color = tag ? tag.color : '#E5E5E5'; // Default grey
                   return (
                     <div 
                       key={event.id} 
                       className="w-1.5 h-1.5 rounded-full shrink-0"
                       style={{ backgroundColor: color }}
                     />
                   )
                })}
                 {dayEvents.length > 6 && (
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
