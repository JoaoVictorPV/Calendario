import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { ChevronLeft, ChevronRight, Copy, MessageSquareText, MousePointerClick, RefreshCcw, Search, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { normalizeText } from '../lib/text';
import { formatWindowLabel, getWindowStart, shiftAnchorDate, tryParseDateQuery, tryParseWeekday } from '../lib/dateSearch';
import { getNotesForEvents } from '../lib/notes';
import { loadUserPrefs, saveUserPrefs } from '../lib/userPrefs';

const MODES = [
  { key: 'day', label: 'Dia' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
];

const NO_TAG_ID = '__no_tag__';

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

export function UpcomingEvents({ events, tags, session }) {
  const [mode, setMode] = useState('week');
  const [anchorDate, setAnchorDate] = useState(startOfToday());

  // Busca + filtros
  const [query, setQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState([]); // acumulativo
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Swipe/drag unificado (mesma lógica do Ensinamentos)
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const minSwipeDistance = 50;

  // Melhora robustez: detecta intenção horizontal vs vertical
  const startYRef = useRef(null);
  const isHorizontalIntentRef = useRef(false);
  const lastXRef = useRef(null);

  const shouldIgnoreGestureTarget = (target) => {
    const el = target instanceof Element ? target : null;
    if (!el) return false;
    // Não capturar swipe iniciando em elementos interativos
    return !!el.closest('input, textarea, select, button, a, [role="button"], [data-no-swipe]');
  };

  const handleSwipe = (distance) => {
    if (distance > minSwipeDistance) setAnchorDate(prev => shiftAnchorDate(prev, mode, +1));
    if (distance < -minSwipeDistance) setAnchorDate(prev => shiftAnchorDate(prev, mode, -1));
  };

  const onTouchStart = (e) => {
    if (shouldIgnoreGestureTarget(e.target)) return;
    const t = e.targetTouches?.[0];
    if (!t) return;
    setTouchEnd(null);
    setTouchStart(t.clientX);
    startYRef.current = t.clientY;
    isHorizontalIntentRef.current = false;
    lastXRef.current = t.clientX;
  };

  const onTouchMove = (e) => {
    const t = e.targetTouches?.[0];
    if (!t || touchStart === null) return;

    const dx = Math.abs(t.clientX - touchStart);
    const dy = Math.abs(t.clientY - (startYRef.current ?? t.clientY));
    // “Trava” quando perceber que a intenção é horizontal
    if (!isHorizontalIntentRef.current && dx > 8 && dx > dy) {
      isHorizontalIntentRef.current = true;
    }

    if (isHorizontalIntentRef.current) {
      setTouchEnd(t.clientX);
      lastXRef.current = t.clientX;
    }
  };

  const onTouchEnd = (e) => {
    if (touchStart === null) return;
    // Fallback: usa changedTouches caso não tenha passado por move
    const endX = (touchEnd ?? lastXRef.current ?? e.changedTouches?.[0]?.clientX);
    const endY = (e.changedTouches?.[0]?.clientY ?? startYRef.current);
    if (endX === null || endX === undefined) {
      setTouchStart(null);
      setTouchEnd(null);
      return;
    }

    const distance = touchStart - endX;
    const dy = Math.abs((endY ?? 0) - (startYRef.current ?? (endY ?? 0)));
    const dx = Math.abs(distance);

    // Se foi um swipe rápido sem onTouchMove suficiente, decide aqui.
    const shouldTreatAsHorizontal = isHorizontalIntentRef.current || (dx > dy);

    // Só navega se a intenção foi horizontal e passou do threshold
    if (shouldTreatAsHorizontal && Math.abs(distance) >= minSwipeDistance) {
      handleSwipe(distance);
    }

    setTouchStart(null);
    setTouchEnd(null);
    startYRef.current = null;
    isHorizontalIntentRef.current = false;
    lastXRef.current = null;
  };

  const onMouseDown = (e) => {
    if (shouldIgnoreGestureTarget(e.target)) return;
    setIsDragging(true);
    setTouchEnd(null);
    setTouchStart(e.clientX);
    startYRef.current = e.clientY;
    isHorizontalIntentRef.current = false;
    lastXRef.current = e.clientX;
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    const dx = Math.abs(e.clientX - (touchStart ?? e.clientX));
    const dy = Math.abs(e.clientY - (startYRef.current ?? e.clientY));
    if (!isHorizontalIntentRef.current && dx > 6 && dx > dy) {
      isHorizontalIntentRef.current = true;
    }
    if (isHorizontalIntentRef.current) {
      setTouchEnd(e.clientX);
      lastXRef.current = e.clientX;
    }
  };

  const onMouseUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (touchStart === null) return;
    const endX = (touchEnd ?? lastXRef.current ?? e?.clientX);
    if (endX === null || endX === undefined) return;
    const distance = touchStart - endX;
    // Para mouse, se arrastou bastante horizontal, considera swipe
    const dy = Math.abs((e?.clientY ?? 0) - (startYRef.current ?? (e?.clientY ?? 0)));
    const dx = Math.abs(distance);
    const shouldTreatAsHorizontal = isHorizontalIntentRef.current || (dx > dy);
    if (shouldTreatAsHorizontal && Math.abs(distance) >= minSwipeDistance) {
      handleSwipe(distance);
    }
    setTouchStart(null);
    setTouchEnd(null);
    startYRef.current = null;
    isHorizontalIntentRef.current = false;
    lastXRef.current = null;
  };

  const onMouseLeave = () => {
    setIsDragging(false);
    setTouchStart(null);
    setTouchEnd(null);
    startYRef.current = null;
    isHorizontalIntentRef.current = false;
    lastXRef.current = null;
  };

  // Ao trocar o modo, "encaixa" o anchor no começo do período pra evitar inconsistência.
  useEffect(() => {
    setAnchorDate((prev) => {
      if (mode === 'day') return prev;
      if (mode === 'week') return startOfWeek(prev, { weekStartsOn: 1 });
      return startOfMonth(prev);
    });
  }, [mode]);

  const tagById = useMemo(() => {
    const map = new Map();
    tags.forEach(t => map.set(t.id, t));
    return map;
  }, [tags]);

  const tagDots = useMemo(() => {
    // Inclui o "Sem tag" como um dot cinza, além das tags do usuário
    const list = [{ id: NO_TAG_ID, name: 'Sem tag', color: '#9CA3AF' }, ...tags];
    return list;
  }, [tags]);

  // Preferências: por padrão, tudo selecionado.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!session?.user?.id) return;
      const prefs = await loadUserPrefs(session.user.id);
      const saved = prefs?.upcoming_selectedTagIds;

      if (!alive) return;
      if (Array.isArray(saved)) {
        // pode ser [] (usuário limpou tudo) => respeitar
        setSelectedTagIds(saved);
      } else {
        // default: todos
        setSelectedTagIds(tagDots.map(t => t.id));
      }
      setPrefsLoaded(true);
    })();
    return () => { alive = false; };
  }, [session?.user?.id, tagDots]);

  useEffect(() => {
    if (!prefsLoaded) return;
    if (!session?.user?.id) return;
    saveUserPrefs(session.user.id, { upcoming_selectedTagIds: selectedTagIds });
  }, [selectedTagIds, prefsLoaded, session?.user?.id]);

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
    // Se nada estiver selecionado, não mostra nada (usuário limpou tudo)
    if (selectedTagIds.length === 0) return [];

    const tagFiltered = inWindow.filter(e => {
      // Tag normal
      if (e.tag_id && selectedTagIds.includes(e.tag_id)) return true;
      // Sem tag
      if (!e.tag_id && selectedTagIds.includes(NO_TAG_ID)) return true;
      return false;
    });

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

  const selectAllTags = () => setSelectedTagIds(tagDots.map(t => t.id));

  const unselectAllTags = () => setSelectedTagIds([]);

  const clearSearch = () => setQuery('');

  const windowLabel = useMemo(() => formatWindowLabel(effectiveAnchorDate, mode), [effectiveAnchorDate, mode]);
  const showBackToToday = useMemo(() => {
    const today = startOfToday();
    const start = getWindowStart(effectiveAnchorDate, mode);
    const { start: wStart, end: wEnd } = buildInterval(start, mode);
    return !isWithinInterval(today, { start: wStart, end: wEnd });
  }, [effectiveAnchorDate, mode]);

  const resetToToday = () => {
    setQuery('');
    setAnchorDate(startOfToday());
    setMode('week');
    selectAllTags();
  };

  // Observações: buscamos as notas dos eventos exibidos (para ícone e modal)
  const [notesByEventId, setNotesByEventId] = useState({});
  const [openNote, setOpenNote] = useState(null); // { title, content }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!session?.user?.id) return;
      const ids = filteredEvents.map(e => e.id);
      const map = await getNotesForEvents({ userId: session.user.id, eventIds: ids });
      if (alive) setNotesByEventId(map);
    })();
    return () => { alive = false; };
  }, [filteredEvents, session?.user?.id]);

  // Reage quando o DayModal salva alguma nota
  useEffect(() => {
    const handler = async () => {
      if (!session?.user?.id) return;
      const ids = filteredEvents.map(e => e.id);
      const map = await getNotesForEvents({ userId: session.user.id, eventIds: ids });
      setNotesByEventId(map);
    };
    window.addEventListener('clepsidra_note_updated', handler);
    return () => window.removeEventListener('clepsidra_note_updated', handler);
  }, [filteredEvents, session?.user?.id]);

  const copyNote = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
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

  return (
    <section
      className="bg-card/80 backdrop-blur-md border border-border shadow-sm rounded-2xl overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-border bg-background/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-foreground truncate">Próximos eventos</h2>
              <span className="text-xs font-medium text-foreground/80 bg-secondary/40 border border-border px-2 py-0.5 rounded-lg whitespace-nowrap">{windowLabel}</span>
            </div>

            {/* Mode selector (centralizado) */}
            <div className="mt-3 w-full flex items-center justify-center">
              <div className="flex rounded-xl bg-secondary/50 p-1 border border-border">
                {MODES.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={cn(
                      'px-4 py-1.5 text-xs font-semibold rounded-lg transition-all',
                      mode === m.key
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tag chips (mais horizontal e menos vertical) */}
            <div className="mt-3 w-full flex items-center justify-center">
              <div className="flex items-center justify-center gap-2 max-w-full overflow-x-auto no-scrollbar py-1">
                <button
                  type="button"
                  data-no-swipe
                  onClick={selectAllTags}
                  title="Selecionar todas"
                  className="w-7 h-7 rounded-full border border-border bg-background hover:bg-secondary/50 transition-all flex items-center justify-center"
                >
                  <MousePointerClick size={14} className="text-foreground" />
                </button>
                <button
                  type="button"
                  data-no-swipe
                  onClick={unselectAllTags}
                  title="Limpar seleção"
                  className="w-7 h-7 rounded-full border border-border bg-background hover:bg-secondary/50 transition-all flex items-center justify-center"
                >
                  <X size={14} className="text-foreground" />
                </button>

                {tagDots.map(tag => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      data-no-swipe
                      onClick={() => toggleTag(tag.id)}
                      title={tag.name}
                      className={cn(
                        'w-7 h-7 rounded-full border transition-all',
                        selected ? 'ring-2 ring-foreground/40 scale-110' : 'opacity-70 hover:opacity-100',
                        'active:scale-95'
                      )}
                      style={{ backgroundColor: tag.color, borderColor: selected ? tag.color : 'rgba(0,0,0,0.15)' }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetToToday}
              className="p-2 rounded-xl hover:bg-secondary/60 border border-border bg-background/60"
              title="Hoje"
              data-no-swipe
            >
              <RefreshCcw size={18} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => setAnchorDate(prev => shiftAnchorDate(prev, mode, -1))}
              className="p-2 rounded-xl hover:bg-secondary/60 border border-border bg-background/60"
              title="Anterior"
              data-no-swipe
            >
              <ChevronLeft size={18} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => setAnchorDate(prev => shiftAnchorDate(prev, mode, +1))}
              className="p-2 rounded-xl hover:bg-secondary/60 border border-border bg-background/60"
              title="Próximo"
              data-no-swipe
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
            className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-background/70 border border-border outline-none focus:border-primary/60 transition-all text-sm select-text"
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
      <div className="p-4 sm:p-5 touch-pan-y select-none">
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
                    const noteContent = notesByEventId?.[ev.id] || '';
                    const hasNote = !!noteContent.trim();
                    return (
                      <div
                        key={ev.id}
                        onClick={() => {
                          if (hasNote) setOpenNote({ title: ev.title, content: noteContent });
                        }}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-xl border border-border bg-background/70 hover:bg-background transition-colors',
                          hasNote && 'cursor-pointer'
                        )}
                      >
                        <div
                          className="w-3 h-3 rounded-full mt-1 shrink-0"
                          style={{ backgroundColor: tag?.color ?? '#E5E5E5' }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-medium text-foreground truncate">{ev.title}</div>
                            {hasNote && (
                              <button
                                type="button"
                                data-no-swipe
                                onClick={() => setOpenNote({ title: ev.title, content: noteContent })}
                                className="p-2 rounded-lg hover:bg-secondary/40 border border-border bg-background/60"
                                title="Ver observação"
                              >
                                <MessageSquareText size={16} className="text-muted-foreground" />
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                            <span>{format(parseISO(ev.date), 'dd/MM/yyyy')}</span>
                            {tag ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                <span className="truncate">{tag.name}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                                <span className="truncate">Sem tag</span>
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

      {/* Modal de Observação */}
      {openNote && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenNote(null);
          }}
          onTouchStart={(e) => {
            if (e.target === e.currentTarget) setOpenNote(null);
          }}
        >
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-border bg-card/60 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{openNote.title}</div>
                <div className="text-[11px] text-muted-foreground">Observação</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyNote(openNote.content)}
                  className="p-2 rounded-lg hover:bg-secondary/40 border border-border bg-background/60"
                  title="Copiar"
                >
                  <Copy size={16} className="text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpenNote(null)}
                  className="p-2 rounded-lg hover:bg-secondary/40 border border-border bg-background/60"
                  title="Fechar"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {openNote.content}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
