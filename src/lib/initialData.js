export const initialTags = [
  { id: 'tag-holiday', name: 'Feriado Nacional', color: '#2E8B57', user_id: 'offline-user-id' }, 
  { id: 'tag-cedav', name: 'Plantão CEDAV', color: '#F87171', user_id: 'offline-user-id' },
  { id: 'tag-sugisawa', name: 'Plantão Sugisawa', color: '#A78BFA', user_id: 'offline-user-id' }
];

const year = 2026;

// Feriados Fixos
const fixedHolidays = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Dia da Consciência Negra',
  '12-25': 'Natal'
};

// Feriados Móveis 2026
const mobileHolidays = {
  '02-17': 'Carnaval',
  '04-03': 'Sexta-feira Santa',
  '04-05': 'Páscoa',
  '06-04': 'Corpus Christi'
};

const cedavDates = [
  '01-10', '01-25',
  '02-20', '02-22', '02-28',
  '03-22',
  '04-18', '04-19',
  '05-17',
  '06-06', '06-14', '06-26',
  '07-12', '07-25',
  '08-09',
  '09-06', '09-12',
  '10-04', '10-16', '10-31',
  '11-01',
  '12-06', '12-19'
];

const sugisawaDates = [
  // Feb 5-11
  '02-05', '02-06', '02-07', '02-08', '02-09', '02-10', '02-11',
  // Mar 12-18
  '03-12', '03-13', '03-14', '03-15', '03-16', '03-17', '03-18',
  // May 7-13
  '05-07', '05-08', '05-09', '05-10', '05-11', '05-12', '05-13',
  // Aug 20-26
  '08-20', '08-21', '08-22', '08-23', '08-24', '08-25', '08-26',
  // Sep 17-23
  '09-17', '09-18', '09-19', '09-20', '09-21', '09-22', '09-23'
];

export const initialEvents = [];

// Populate Holidays
Object.entries({...fixedHolidays, ...mobileHolidays}).forEach(([date, title]) => {
  const [month, day] = date.split('-');
  // Note: keys above are MM-DD based on standard ISO YYYY-MM-DD
  initialEvents.push({
    id: crypto.randomUUID(),
    title: title,
    date: `${year}-${date}`,
    tag_id: 'tag-holiday',
    user_id: 'offline-user-id',
    created_at: new Date().toISOString()
  });
});

// Populate CEDAV
cedavDates.forEach(date => {
  initialEvents.push({
    id: crypto.randomUUID(),
    title: 'Plantão CEDAV',
    date: `${year}-${date}`,
    tag_id: 'tag-cedav',
    user_id: 'offline-user-id',
    created_at: new Date().toISOString()
  });
});

// Populate Sugisawa
sugisawaDates.forEach(date => {
  initialEvents.push({
    id: crypto.randomUUID(),
    title: 'Plantão Sugisawa',
    date: `${year}-${date}`,
    tag_id: 'tag-sugisawa',
    user_id: 'offline-user-id',
    created_at: new Date().toISOString()
  });
});
