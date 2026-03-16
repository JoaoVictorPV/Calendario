import React, { useMemo, useState } from 'react';
import {
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfToday,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { normalizeText } from '../lib/text';
import { formatWindowLabel, getWindowStart, shiftAnchorDate, tryParseDateQuery, tryParseWeekday } from '../lib/dateSearch';

const MODES = [
  { key: 'day', label: 'Dia' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
];

function buildInterval(anchorDate, mode) {
  if (mode === 'day') {
    const start = anchorDate;
    return { start, end: anchorDate };
  }
  if (mode === 'week') {
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
    const end = endOfWeek(anchorDate, { weekStartsOn: 1 });
    return { start, end };
  }
  // month
  const start = startOfMonth(anchorDate);
  const end = endOfMonth(anchorDate);
  return { start, end };
}

export function UpcomingEvents({ events, tags }) {
  const [mode, setMode] = useState('week');
  const [anchorDate, setAnchorDate] = useState(startOfToday());

  // Busca + filtros
  const [query, setQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState([]); // acumulativo

  // Swipe/drag unificado (mesma lógica do Ensinamentos)
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const minSwipeDistance = 50;

  const handleSwipe = (distance) => {
    if (distance > minSwipeDistance) setAnchorDate(prev => shiftAnchorDate(prev, mode, +1));
    if (distance < -minSwipeDistance) setAnchorDate(prev => shiftAnchorDate(prev, mode, -1));
  };

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    handleSwipe(touchStart - touchEnd);
    setTouchStart(null);
    setTouchEnd(null);
  };

  const onMouseDown = (e) => {
    setIsDragging(true);
    setTouchEnd(null);
    setTouchStart(e.clientX);
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    setTouchEnd(e.clientX);
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (!touchStart || !touchEnd) return;
    handleSwipe(touchStart - touchEnd);
    setTouchStart(null);
    setTouchEnd(null);
  };

  const onMouseLeave = () => {
    setIsDragging(false);
    setTouchStart(null);
    setTouchEnd(null);
  };

  const tagById = useMemo(() => {
    const map = new Map();
    tags.forEach(t => map.set(t.id, t));
    return map;
  }, [tags]);

  const normalizedQuery = useMemo(() => normalizeText(query), [query]);

  // Se a busca for uma data válida, “pula” anchorDate para ela (experiência premium)
  const parsedDateFromQuery = useMemo(() => tryParseDateQuery(normalizedQuery, anchorDate), [normalizedQuery, anchorDate]);
  const parsedWeekdayFromQuery = useMemo(() => tryParseWeekday(normalizedQuery), [normalizedQuery]);

  const effectiveAnchorDate = parsedDateFromQuery ?? anchorDate;
  const effectiveInterval = useMemo(() => buildInterval(effectiveAnchorDate, mode), [effectiveAnchorDate, mode]);

  const filteredEvents = useMemo(() => {
    // 1) Janela temporal
    const inWindow = events.filter(e => {
      // e.date é YYYY-MM-DD (string)
      return e.date >= format(effectiveInterval.start, 'yyyy-MM-dd') && e.date <= format(effectiveInterval.end, 'yyyy-MM-dd');
    });

    // 2) Tags acumulativas
    const tagFiltered = selectedTagIds.length === 0
      ? inWindow
      : inWindow.filter(e => e.tag_id && selectedTagIds.includes(e.tag_id));

    // 3) Busca textual inteligente
    if (!normalizedQuery) {
      return tagFiltered.sort((a, b) => a.date.localeCompare(b.date));
    }

    // Se digitou um dia da semana, filtra por isso também.
    const weekday = parsedWeekdayFromQuery;

    return tagFiltered
      .filter(e => {
        const tag = e.tag_id ? tagById.get(e.tag_id) : null;
        const hay = normalizeText(`${e.title} ${tag?.name ?? ''} ${e.date}`);
        const textMatch = hay.includes(normalizedQuery);

        if (weekday === null) return textMatch;

        // “seg/ter/...” digitado: também exige bater o weekday
        const d = parseISO(e.date);
        const weekdayMatch = isValid(d) ? d.getDay() === weekday : false;
        return textMatch || weekdayMatch;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, effectiveInterval.start, effectiveInterval.end, selectedTagIds, normalizedQuery, parsedWeekdayFromQuery, tagById]);

  const grouped = useMemo(() => {
    const map = new Map();

    for (const e of filteredEvents) {
      const dateObj = parseISO(e.date);
      let groupKey;
      let groupLabel;

      if (mode === 'week') {
        groupKey = e.date;
        groupLabel = format(dateObj, "EEEE, d 'de' MMM", { locale: ptBR });
      } else if (mode === 'month') {
        groupKey = e.date;
        groupLabel = format(dateObj, "d 'de' MMMM, EEEE", { locale: ptBR });
      } else {
        // day
        groupKey = e.date;
        groupLabel = format(dateObj, "EEEE, d 'de' MMMM", { locale: ptBR });
      }

      if (!map.has(groupKey)) map.set(groupKey, { label: groupLabel, items: [] });
      map.get(groupKey).items.push(e);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({ key, ...val }));
  }, [filteredEvents, mode]);

  const toggleTag = (id) => {
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const clearSearch = () => setQuery('');

  const windowLabel = useMemo(() => formatWindowLabel(effectiveAnchorDate, mode), [effectiveAnchorDate, mode]);
  const showBackToToday = useMemo(() => {
    const today = startOfToday();
    const start = getWindowStart(effectiveAnchorDate, mode);
    const { start: wStart, end: wEnd } = buildInterval(start, mode);
    return !isWithinInterval(today, { start: wStart, end: wEnd });
  }, [effectiveAnchorDate, mode]);

  return (
    <section
      className="bg-card/80 backdrop-blur-md border border-border shadow-sm rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-border bg-background/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-foreground truncate">Próximos eventos</h2>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{windowLabel}</span>
            </div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {/* Mode selector */}
              <div className="flex rounded-xl bg-secondary/50 p-1 border border-border">
                {MODES.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                      mode === m.key
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Tag chips (dots) */}
              <div className="flex items-center gap-1.5">
                {tags.map(tag => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      title={tag.name}
                      className={cn(
                        'w-5 h-5 rounded-full border transition-all',
                        selected ? 'ring-2 ring-foreground/40 scale-110' : 'opacity-70 hover:opacity-100',
                        'active:scale-95'
                      )}
                      style={{ backgroundColor: tag.color, borderColor: selected ? tag.color : 'rgba(0,0,0,0.1)' }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showBackToToday && (
              <button
                onClick={() => setAnchorDate(startOfToday())}
                className="hidden sm:inline-flex px-3 py-1.5 rounded-xl text-xs bg-secondary/50 hover:bg-secondary border border-border text-muted-foreground"
              >
                Hoje
              </button>
            )}
            <button
              onClick={() => setAnchorDate(prev => shiftAnchorDate(prev, mode, -1))}
              className="p-2 rounded-xl hover:bg-secondary/60 border border-border bg-background/60"
              title="Anterior"
            >
              <ChevronLeft size={18} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => setAnchorDate(prev => shiftAnchorDate(prev, mode, +1))}
              className="p-2 rounded-xl hover:bg-secondary/60 border border-border bg-background/60"
              title="Próximo"
            >
              <ChevronRight size={18} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, tag, data (15/03) ou dia (seg)…"
            className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-background/70 border border-border outline-none focus:border-primary/60 transition-all text-sm"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-secondary"
              title="Limpar"
            >
              <X size={16} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Body (swipe area) */}
      <div
        className="p-4 sm:p-5 touch-pan-y select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {grouped.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-10">
            Nenhum evento neste intervalo.
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(group => (
              <div key={group.key} className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.items.map(ev => {
                    const tag = ev.tag_id ? tagById.get(ev.tag_id) : null;
                    return (
                      <div
                        key={ev.id}
                        className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background/70 hover:bg-background transition-colors"
                      >
                        <div
                          className="w-3 h-3 rounded-full mt-1 shrink-0"
                          style={{ backgroundColor: tag?.color ?? '#E5E5E5' }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground truncate">{ev.title}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                            <span>{format(parseISO(ev.date), 'dd/MM/yyyy')}</span>
                            {tag && (
                              <span className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                <span className="truncate">{tag.name}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hint (mobile) */}
        <div className="pt-4 text-[11px] text-muted-foreground/80 text-center">
          Dica: arraste para os lados para navegar por {mode === 'day' ? 'dias' : mode === 'week' ? 'semanas' : 'meses'}.
        </div>
      </div>
    </section>
  );
}
