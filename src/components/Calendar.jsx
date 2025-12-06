import React, { useState } from 'react';
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
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const minSwipeDistance = 50;

  const handleSwipe = (distance) => {
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      setCurrentMonth(addMonths(currentMonth, 1));
    }
    if (isRightSwipe) {
      setCurrentMonth(subMonths(currentMonth, 1));
    }
  };

  // Touch Handlers
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    handleSwipe(distance);
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Mouse Handlers
  const onMouseDown = (e) => {
    setTouchEnd(null);
    setTouchStart(e.clientX);
    setIsDragging(true);
  };

  const onMouseMove = (e) => {
    if (isDragging) {
      setTouchEnd(e.clientX);
    }
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (touchStart && touchEnd) {
       const distance = touchStart - touchEnd;
       handleSwipe(distance);
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  const onMouseLeave = () => {
    if(isDragging) {
        setIsDragging(false);
        setTouchStart(null);
        setTouchEnd(null);
    }
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
  });

  return (
    <div 
      className="space-y-4 touch-pan-y select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
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
              onClick={() => {
                // Prevent click if it was a drag
                if (!touchStart || !touchEnd) {
                   onSelectDate(date);
                }
              }}
              className={cn(
                "aspect-[4/5] rounded-xl flex flex-col items-center justify-start pt-2 gap-1 transition-all border relative overflow-hidden",
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
              <div className="flex gap-1 flex-wrap justify-center px-0.5 w-full content-start h-full mt-0.5">
                {dayEvents.slice(0, 6).map(event => {
                   const tag = tags.find(t => t.id === event.tag_id);
                   const color = tag ? tag.color : '#E5E5E5'; 
                   return (
                     <div 
                       key={event.id} 
                       className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                       style={{ backgroundColor: color }}
                     />
                   )
                })}
                 {dayEvents.length > 6 && (
                  <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
