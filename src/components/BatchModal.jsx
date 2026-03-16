import React, { useState } from 'react';
import { X, CalendarPlus, Check, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  addDays,
  addMonths,
  differenceInCalendarWeeks,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  startOfToday,
  startOfWeek,
} from 'date-fns';
import { cn } from '../lib/utils';

const WEEKDAYS = [
  { label: 'S', value: 1 },
  { label: 'T', value: 2 },
  { label: 'Q', value: 3 },
  { label: 'Q', value: 4 },
  { label: 'S', value: 5 },
  { label: 'S', value: 6 },
  { label: 'D', value: 0 },
];

export function BatchModal({ onClose, tags, onSuccess }) {
  const [title, setTitle] = useState('');
  const [selectedTagId, setSelectedTagId] = useState('');

  // Repetição
  const [repeatType, setRepeatType] = useState('weekly'); // weekly | interval | monthly
  const [weeklyEvery, setWeeklyEvery] = useState(1); // 1 = toda semana, 2 = quinzenal...
  const [intervalEvery, setIntervalEvery] = useState(14); // dias
  const [intervalBase, setIntervalBase] = useState('calendar'); // calendar | business
  const [monthlyEvery, setMonthlyEvery] = useState(1); // meses
  const [monthlyBase, setMonthlyBase] = useState('calendar'); // calendar | business
  const [monthlyDayOfMonth, setMonthlyDayOfMonth] = useState(new Date().getDate());

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

  const toggleAllWeekdays = () => {
    const all = WEEKDAYS.map(w => w.value);
    const isAllSelected = all.every(v => selectedWeekdays.includes(v));
    setSelectedWeekdays(isAllSelected ? [] : all);
  };

  const ensureLocalDate = (iso) => new Date(`${iso}T00:00:00`);

  const isBusinessDay = (date) => {
    const d = date.getDay();
    return d !== 0 && d !== 6;
  };

  const adjustToBusinessDayForward = (date) => {
    // Empurra para o próximo dia útil (seg-sex)
    let d = new Date(date);
    while (!isBusinessDay(d)) d = addDays(d, 1);
    return d;
  };

  const addBusinessDaysSimple = (date, businessDaysToAdd) => {
    let d = new Date(date);
    let added = 0;
    while (added < businessDaysToAdd) {
      d = addDays(d, 1);
      if (isBusinessDay(d)) added += 1;
    }
    return d;
  };

  const clampDayInMonth = (year, monthIndex, dayOfMonth) => {
    const tentative = new Date(year, monthIndex, dayOfMonth);
    if (tentative.getMonth() === monthIndex) return tentative;
    // overflow => último dia do mês
    return endOfMonth(new Date(year, monthIndex, 1));
  };

  // Mantém o campo de dia do mês coerente quando o usuário muda startDate
  React.useEffect(() => {
    try {
      const start = ensureLocalDate(startDate);
      setMonthlyDayOfMonth(start.getDate());
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  const calculateDates = () => {
    if (!startDate || !endDate || !title) return [];

    const start = ensureLocalDate(startDate);
    const end = ensureLocalDate(endDate);
    if (end < start) return [];

    // --- Semanal (com escolha de dias) ---
    if (repeatType === 'weekly') {
      if (selectedWeekdays.length === 0) return [];

      const interval = eachDayOfInterval({ start, end });
      const startWeek = startOfWeek(start, { weekStartsOn: 1 });

      return interval.filter(date => {
        if (!selectedWeekdays.includes(date.getDay())) return false;
        const diffWeeks = differenceInCalendarWeeks(
          startOfWeek(date, { weekStartsOn: 1 }),
          startWeek,
          { weekStartsOn: 1 }
        );
        return diffWeeks % weeklyEvery === 0;
      });
    }

    // --- Intervalo (a cada X dias) ---
    if (repeatType === 'interval') {
      const every = Math.max(1, Number(intervalEvery) || 1);
      const base = intervalBase;

      let cursor = new Date(start);
      if (base === 'business') cursor = adjustToBusinessDayForward(cursor);

      const out = [];
      while (cursor <= end) {
        out.push(cursor);
        cursor = base === 'business'
          ? addBusinessDaysSimple(cursor, every)
          : addDays(cursor, every);
      }
      return out;
    }

    // --- Mensal (mesmo dia do mês) ---
    const everyMonths = Math.max(1, Number(monthlyEvery) || 1);
    const dayOfMonth = Math.min(31, Math.max(1, Number(monthlyDayOfMonth) || 1));
    const base = monthlyBase;

    let cursor = startOfMonth(start);
    const out = [];

    // Começa no mês do startDate
    while (cursor <= end) {
      const d = clampDayInMonth(cursor.getFullYear(), cursor.getMonth(), dayOfMonth);
      const adjusted = base === 'business' ? adjustToBusinessDayForward(d) : d;

      if (adjusted >= start && adjusted <= end) out.push(adjusted);

      cursor = addMonths(cursor, everyMonths);
    }
    return out;
  };

  const handleGenerate = async () => {
    if (!title || !startDate || !endDate) return;
    if (repeatType === 'weekly' && selectedWeekdays.length === 0) return;
    
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
  }, [title, startDate, endDate, selectedWeekdays, repeatType, weeklyEvery, intervalEvery, intervalBase, monthlyEvery, monthlyBase, monthlyDayOfMonth]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
      <div className="bg-background w-full max-w-md rounded-2xl shadow-xl border border-border flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 overflow-hidden">
        
        <div className="p-4 border-b border-border flex items-center justify-between bg-card/60">
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
              className="w-full px-3 py-2 rounded-xl bg-secondary/30 border border-transparent focus:bg-background focus:border-primary/50 outline-none transition-all text-foreground"
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
                      ? "ring-2 ring-primary border-transparent bg-background shadow-sm" 
                      : "border-border hover:bg-secondary/50 bg-background"
                  )}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Repeat Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Repetição</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'weekly', label: 'Semanal' },
                { key: 'interval', label: 'Intervalo' },
                { key: 'monthly', label: 'Mensal' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setRepeatType(opt.key)}
                  className={cn(
                    'px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
                    repeatType === opt.key
                      ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                      : 'bg-background border-border text-muted-foreground hover:bg-secondary/50'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly */}
          {repeatType === 'weekly' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-muted-foreground">Repetir nos dias</label>
                <button
                  onClick={toggleAllWeekdays}
                  className="text-xs px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-secondary/50 text-muted-foreground"
                >
                  Todos
                </button>
              </div>
              <div className="flex justify-between gap-1">
                {WEEKDAYS.map(day => {
                  const isSelected = selectedWeekdays.includes(day.value);
                  const isWeekend = day.value === 0 || day.value === 6;

                  return (
                    <button
                      key={day.value}
                      onClick={() => toggleWeekday(day.value)}
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium transition-all',
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-md scale-105'
                          : 'bg-secondary/50 hover:bg-secondary',
                        !isSelected && isWeekend ? 'text-red-500' : 'text-muted-foreground'
                      )}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">A cada</label>
                  <select
                    value={weeklyEvery}
                    onChange={(e) => setWeeklyEvery(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-secondary/30 border border-transparent focus:bg-background focus:border-primary/50 outline-none transition-all text-foreground text-sm"
                  >
                    <option value={1}>1 semana</option>
                    <option value={2}>2 semanas (quinzenal)</option>
                    <option value={3}>3 semanas</option>
                    <option value={4}>4 semanas</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Dica</label>
                  <div className="px-3 py-2 rounded-xl bg-primary/5 border border-primary/10 text-xs text-muted-foreground leading-snug">
                    Ex.: selecione <b>Seg</b> e “2 semanas” para uma segunda quinzenal.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interval */}
          {repeatType === 'interval' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">A cada</label>
                  <input
                    type="number"
                    min={1}
                    value={intervalEvery}
                    onChange={(e) => setIntervalEvery(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-secondary/30 border border-transparent focus:bg-background focus:border-primary/50 outline-none transition-all text-foreground text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Base</label>
                  <div className="flex rounded-xl bg-secondary/50 p-1 border border-border">
                    <button
                      onClick={() => setIntervalBase('calendar')}
                      className={cn(
                        'flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all',
                        intervalBase === 'calendar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      Dias corridos
                    </button>
                    <button
                      onClick={() => setIntervalBase('business')}
                      className={cn(
                        'flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all',
                        intervalBase === 'business' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      Dias comerciais
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Monthly */}
          {repeatType === 'monthly' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">A cada</label>
                  <select
                    value={monthlyEvery}
                    onChange={(e) => setMonthlyEvery(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-secondary/30 border border-transparent focus:bg-background focus:border-primary/50 outline-none transition-all text-foreground text-sm"
                  >
                    <option value={1}>1 mês</option>
                    <option value={2}>2 meses</option>
                    <option value={3}>3 meses</option>
                    <option value={6}>6 meses</option>
                    <option value={12}>12 meses</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Dia do mês</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={monthlyDayOfMonth}
                    onChange={(e) => setMonthlyDayOfMonth(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-secondary/30 border border-transparent focus:bg-background focus:border-primary/50 outline-none transition-all text-foreground text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Base</label>
                <div className="flex rounded-xl bg-secondary/50 p-1 border border-border">
                  <button
                    onClick={() => setMonthlyBase('calendar')}
                    className={cn(
                      'flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all',
                      monthlyBase === 'calendar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    Dias corridos
                  </button>
                  <button
                    onClick={() => setMonthlyBase('business')}
                    className={cn(
                      'flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-all',
                      monthlyBase === 'business' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    Dias comerciais
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Em dias comerciais, se cair em fim de semana, eu empurro para o próximo dia útil.
                </p>
              </div>
            </div>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">De</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-secondary/30 border border-transparent focus:bg-background focus:border-primary/50 outline-none transition-all text-foreground text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Até</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-secondary/30 border border-transparent focus:bg-background focus:border-primary/50 outline-none transition-all text-foreground text-sm"
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

        <div className="p-4 border-t border-border bg-card/60 flex justify-end gap-3">
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
