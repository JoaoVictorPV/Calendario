import React, { useState } from 'react';
import { X, CalendarPlus, Check, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { eachDayOfInterval, isSameDay, format, startOfToday, addMonths } from 'date-fns';
import { cn } from '../lib/utils';

const WEEKDAYS = [
  { label: 'D', value: 0 },
  { label: 'S', value: 1 },
  { label: 'T', value: 2 },
  { label: 'Q', value: 3 },
  { label: 'Q', value: 4 },
  { label: 'S', value: 5 },
  { label: 'S', value: 6 },
];

export function BatchModal({ onClose, tags, onSuccess }) {
  const [title, setTitle] = useState('');
  const [selectedTagId, setSelectedTagId] = useState('');
  const [selectedWeekdays, setSelectedWeekdays] = useState([]);
  const [startDate, setStartDate] = useState(format(startOfToday(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addMonths(startOfToday(), 3), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);

  const toggleWeekday = (dayValue) => {
    setSelectedWeekdays(prev => 
      prev.includes(dayValue) 
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue]
    );
  };

  const calculateDates = () => {
    if (!startDate || !endDate || selectedWeekdays.length === 0) return [];
    
    const start = new Date(startDate + 'T00:00:00'); // Ensure local time interpretation
    const end = new Date(endDate + 'T00:00:00');
    
    if (end < start) return [];

    const interval = eachDayOfInterval({ start, end });
    return interval.filter(date => selectedWeekdays.includes(date.getDay()));
  };

  const handleGenerate = async () => {
    if (!title || !startDate || !endDate || selectedWeekdays.length === 0) return;
    
    setLoading(true);
    try {
      const datesToCreate = calculateDates();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const eventsToInsert = datesToCreate.map(date => ({
        user_id: user.id,
        title,
        date: format(date, 'yyyy-MM-dd'),
        tag_id: selectedTagId || null,
        created_at: new Date().toISOString()
      }));

      // Insert in batches of 50 to be safe
      const batchSize = 50;
      for (let i = 0; i < eventsToInsert.length; i += batchSize) {
        const batch = eventsToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from('events').insert(batch);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating batch events:', error);
      alert('Erro ao criar eventos. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  // Update preview count when dependencies change
  React.useEffect(() => {
    setPreviewCount(calculateDates().length);
  }, [startDate, endDate, selectedWeekdays]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
      <div className="bg-background w-full max-w-md rounded-2xl shadow-xl border border-border flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 overflow-hidden">
        
        <div className="p-4 border-b border-border flex items-center justify-between bg-white">
          <h2 className="text-lg font-medium flex items-center gap-2 text-foreground">
            <CalendarPlus size={20} className="text-primary" /> 
            Adicionar Eventos em Massa
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded-full text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* Title Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Nome do Evento</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Academia, Estudar..."
              className="w-full px-3 py-2 rounded-xl bg-secondary/30 border border-transparent focus:bg-white focus:border-primary/50 outline-none transition-all text-foreground"
            />
          </div>

          {/* Tag Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Tag (Opcional)</label>
            <div className="flex gap-2 flex-wrap">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagId(tag.id === selectedTagId ? '' : tag.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-2",
                    selectedTagId === tag.id 
                      ? "ring-2 ring-primary border-transparent bg-white shadow-sm" 
                      : "border-border hover:bg-secondary/50 bg-white"
                  )}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Weekday Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Repetir nos dias</label>
            <div className="flex justify-between gap-1">
              {WEEKDAYS.map(day => {
                const isSelected = selectedWeekdays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    onClick={() => toggleWeekday(day.value)}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium transition-all",
                      isSelected 
                        ? "bg-primary text-primary-foreground shadow-md scale-105" 
                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">De</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-secondary/30 border border-transparent focus:bg-white focus:border-primary/50 outline-none transition-all text-foreground text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Até</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-secondary/30 border border-transparent focus:bg-white focus:border-primary/50 outline-none transition-all text-foreground text-sm"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-primary/5 rounded-xl p-4 flex items-center gap-3">
             <div className="p-2 bg-primary/10 rounded-lg text-primary">
               <Check size={18} />
             </div>
             <div className="text-sm text-foreground">
               <span className="font-bold text-primary">{previewCount}</span> eventos serão criados neste intervalo.
             </div>
          </div>

        </div>

        <div className="p-4 border-t border-border bg-white flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleGenerate}
            disabled={loading || previewCount === 0 || !title}
            className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Gerar Eventos'}
          </button>
        </div>

      </div>
    </div>
  );
}
