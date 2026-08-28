// Genererer SQL-seed til den virtuelle standardbruger + 26 ugers vægt- og madlog.
// Kør: node gen-seed.js > seed-standard-user.sql

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(42);
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
function esc(s) { return s.replace(/'/g, "''"); }

const USER_ID = 'seed-std-user';
const TODAY = new Date('2026-08-28T00:00:00Z');
const DAYS = 182; // ~26 uger
const START = new Date(TODAY.getTime() - DAYS * 86400000);

function fmtDate(d) { return d.toISOString().slice(0, 19).replace('T', ' '); }
function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }

let sql = [];
sql.push('-- Auto-genereret seed: virtuel standardbruger til Hello Cal');
sql.push('-- Bruger: mand, 50 år, 186 cm, 120 kg nu, tabt 5 kg over 26 uger, mål 90 kg om 1 år.');
sql.push('BEGIN;');

// --- Bruger ---
sql.push(`INSERT INTO users (id, email, "displayName", role, "weightKg", "heightCm", "birthYear", sex, "defaultBedtime", "defaultWakeTime", "createdAt")
VALUES ('${USER_ID}', 'standard@hellocal.test', 'Standardbruger', 'USER', 120, 186, 1976, 'MALE', '22:00', '05:45', '${fmtDate(START)}')
ON CONFLICT (id) DO NOTHING;`);

// --- Søvnmønster: weekend vågner kl 07:00 (samme sengetid) ---
sql.push(`INSERT INTO sleep_schedules (id, "userId", weekday, bedtime, "wakeTime") VALUES
('seed-sleep-5', '${USER_ID}', 5, '22:00', '07:00'),
('seed-sleep-6', '${USER_ID}', 6, '22:00', '07:00')
ON CONFLICT ("userId", weekday) DO NOTHING;`);

// --- Vægtdata: 2x ugentligt (mandag+torsdag), fastende morgenvejning ---
// Lineær trend 125.0 -> 120.0 kg over 182 dage, plus realistisk støj (op og ned i løbet af ugerne).
const startWeight = 125.0;
const endWeight = 120.0;
let weightRows = [];
let wIdx = 0;
for (let day = 0; day <= DAYS; day++) {
  const date = addDays(START, day);
  const weekday = date.getUTCDay(); // 0=søn
  if (weekday === 1 || weekday === 4) { // mandag, torsdag
    const t = day / DAYS;
    const trend = startWeight + (endWeight - startWeight) * t;
    const noise = (rnd() - 0.5) * 1.0; // +/-0.5 kg udsving
    let w = Math.round((trend + noise) * 10) / 10;
    wIdx++;
    weightRows.push(`('seed-weight-${wIdx}', '${USER_ID}', ${w}, false, 'AFTER', 'BEFORE', 'MORNING', '${fmtDate(date)}')`);
  }
}
// Sidste vejning tvinges til nøjagtig 120.0 kg (matcher users.weightKg)
weightRows[weightRows.length - 1] = weightRows[weightRows.length - 1].replace(/, [0-9.]+, false/, `, 120.0, false`);
sql.push(`INSERT INTO weight_entries (id, "userId", "weightKg", clothed, toilet, meal, "timeOfDay", "weighedAt") VALUES\n${weightRows.join(',\n')}\nON CONFLICT (id) DO NOTHING;`);

// --- Mad-log: dummy danske måltider, ramt til at give et gennemsnitligt underskud der matcher -5 kg over 182 dage ---
// Målgennemsnit ~2735 kcal/dag (Mifflin-St Jeor, let aktiv, gennemsnitsvægt 122.5 kg) => 211.5 kcal/dags underskud => 5 kg over 182 dage.
const breakfasts = [
  { n: 'Havregrød med mælk og banan', k: 430, p: 14, c: 68, f: 10, g: 400 },
  { n: 'Rugbrød med leverpostej og bacon', k: 520, p: 20, c: 45, f: 28, g: 220 },
  { n: 'Skyr med müesli og honning', k: 360, p: 28, c: 45, f: 6, g: 350 },
  { n: 'Æg og bacon', k: 480, p: 26, c: 4, f: 40, g: 220 },
];
const lunches = [
  { n: 'Rugbrød med kylling og remoulade', k: 610, p: 32, c: 55, f: 26, g: 350 },
  { n: 'Pastasalat med tun og mayo', k: 650, p: 28, c: 70, f: 26, g: 400 },
  { n: 'Burger og pommes frites', k: 980, p: 32, c: 90, f: 52, g: 450 },
  { n: 'Club sandwich', k: 720, p: 30, c: 60, f: 38, g: 380 },
];
const dinners = [
  { n: 'Kylling, ris og bearnaisesovs', k: 820, p: 45, c: 75, f: 34, g: 500 },
  { n: 'Frikadeller, kartofler og sovs', k: 760, p: 35, c: 60, f: 38, g: 450 },
  { n: 'Pizza (halv, hjemmebragt)', k: 900, p: 32, c: 95, f: 42, g: 400 },
  { n: 'Laks med kartofler og smør', k: 700, p: 40, c: 45, f: 38, g: 400 },
  { n: 'Flæskesteg med kartofler og rødkål', k: 950, p: 42, c: 70, f: 52, g: 500 },
];
const snacks = [
  { n: 'Proteinbar', k: 210, p: 20, c: 20, f: 7, g: 60 },
  { n: 'Håndfuld nødder', k: 260, p: 8, c: 8, f: 22, g: 40 },
  { n: 'Chokolade', k: 300, p: 4, c: 32, f: 17, g: 55 },
  { n: '2 øl', k: 300, p: 2, c: 20, f: 0, g: 660 },
  { n: 'Frugt', k: 90, p: 1, c: 22, f: 0, g: 180 },
];

let regRows = [];
let rIdx = 0;
let totalKcal = 0, dayCount = 0;
for (let day = 0; day < DAYS; day++) {
  const date = addDays(START, day);
  const weekday = date.getUTCDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const target = (isWeekend ? 2950 : 2650) + (rnd() - 0.5) * 400;

  const b = pick(breakfasts), l = pick(lunches), d = pick(dinners);
  const s = pick(snacks);
  const useSnack = rnd() < 0.7; // ikke snack hver dag
  let meals = [
    { slot: 'Morgenmad', time: '07:30:00', item: b },
    { slot: 'Frokost', time: '12:00:00', item: l },
    { slot: 'Aftensmad', time: '18:30:00', item: d },
  ];
  if (useSnack) meals.push({ slot: 'Snack', time: '20:30:00', item: s });
  const base = meals.reduce((sum, m) => sum + m.item.k, 0);

  // Skalér dagens portioner op/ned så det samlede indtag rammer dagens mål
  // (bevarer madvalgets naturlige variation, men styrer det daglige gennemsnit).
  const scale = Math.min(1.35, Math.max(0.75, target / base));

  let sum = 0;
  for (const m of meals) {
    rIdx++;
    const ts = `${date.toISOString().slice(0, 10)} ${m.time}`;
    const k = Math.round(m.item.k * scale);
    const p = Math.round(m.item.p * scale);
    const c = Math.round(m.item.c * scale);
    const f = Math.round(m.item.f * scale);
    const g = Math.round(m.item.g * scale);
    sum += k;
    regRows.push(`('seed-reg-${rIdx}', '${USER_ID}', '${esc(m.item.n)}', ${k}, ${p}, ${c}, ${f}, ${g}, '${ts}')`);
  }
  totalKcal += sum;
  dayCount++;
}
sql.push(`INSERT INTO registrations (id, "userId", "titleSnapshot", "kcalSnapshot", "proteinSnapshot", "carbsSnapshot", "fatSnapshot", "amountGrams", "createdAt") VALUES\n${regRows.join(',\n')}\nON CONFLICT (id) DO NOTHING;`);

sql.push('COMMIT;');

console.error(`# Rows: ${weightRows.length} vægtregistreringer, ${regRows.length} madregistreringer over ${dayCount} dage.`);
console.error(`# Gennemsnitligt dagligt kalorieindtag i seed-data: ${Math.round(totalKcal / dayCount)} kcal/dag.`);
console.log(sql.join('\n\n'));
