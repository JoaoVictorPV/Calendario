import { addDays, addMonths, format, isValid, parse, parseISO, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { normalizeText } from './text';

const WEEKDAY_ALIASES = [
  { keys: ['dom', 'domingo'], value: 0 },
  { keys: ['seg', 'segunda', 'segunda-feira'], value: 1 },
  { keys: ['ter', 'terca', 'terça', 'terca-feira', 'terça-feira'], value: 2 },
  { keys: ['qua', 'quarta', 'quarta-feira'], value: 3 },
  { keys: ['qui', 'quinta', 'quinta-feira'], value: 4 },
  { keys: ['sex', 'sexta', 'sexta-feira'], value: 5 },
  { keys: ['sab', 'sabado', 'sábado'], value: 6 },
];

export function tryParseWeekday(query) {
  const q = normalizeText(query);
  if (!q) return null;

  for (const w of WEEKDAY_ALIASES) {
    if (w.keys.some(k => q === normalizeText(k))) return w.value;
  }

  // Permite “contém” para casos tipo “segunda” dentro de frase curta.
  for (const w of WEEKDAY_ALIASES) {
    if (w.keys.some(k => q.includes(normalizeText(k)))) return w.value;
  }

  return null;
}

export function tryParseDateQuery(query, referenceDate = new Date()) {
  const q = normalizeText(query);
  if (!q) return null;

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) {
    const d = parseISO(q);
    return isValid(d) ? d : null;
  }

  // dd/mm/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(q)) {
    const d = parse(q, 'd/M/yyyy', referenceDate, { locale: ptBR });
    return isValid(d) ? d : null;
  }

  // dd/mm -> assume ano do referenceDate
  if (/^\d{1,2}\/\d{1,2}$/.test(q)) {
    const year = referenceDate.getFullYear();
    const d = parse(`${q}/${year}`, 'd/M/yyyy', referenceDate, { locale: ptBR });
    return isValid(d) ? d : null;
  }

  return null;
}

export function shiftAnchorDate(anchorDate, mode, direction) {
  // direction: -1 (anterior) | +1 (próximo)
  if (mode === 'day') return addDays(anchorDate, direction);
  if (mode === 'week') return addDays(anchorDate, direction * 7);
  return addMonths(anchorDate, direction);
}

export function getWindowStart(anchorDate, mode) {
  if (mode === 'week') return startOfWeek(anchorDate, { weekStartsOn: 1 });
  return anchorDate;
}

export function formatWindowLabel(anchorDate, mode) {
  if (mode === 'day') return format(anchorDate, "d 'de' MMMM", { locale: ptBR });
  if (mode === 'week') {
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
    const end = addDays(start, 6);
    return `${format(start, 'd MMM', { locale: ptBR })} – ${format(end, 'd MMM', { locale: ptBR })}`;
  }
  return format(anchorDate, 'MMMM yyyy', { locale: ptBR });
}
