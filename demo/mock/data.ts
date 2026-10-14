// Dati di prova della demo: una palestra con soci, PT, schede, allenamenti già fatti, misure e messaggi.
import SEED from '../../supabase/seed/exercises.json';
import { addDays, isoDay, startOfWeek } from '../../src/util';

export type Row = Record<string, any>;
export const GYM = new URLSearchParams(location.search).get('gym') || 'Palestra Aurora';
export const JOIN_CODE = 'AURORA';
export const uid = (): string => (crypto as any).randomUUID();

const T0 = new Date();
const at = (dayOff: number, h: number, m = 0) => { const d = addDays(T0, dayOff); d.setHours(h, m, 0, 0); return d.toISOString(); };
const dayStr = (dayOff: number) => isoDay(addDays(T0, dayOff));

// ───────── Esercizi (gli stessi 73 del database, con qualche video) ─────────
const VIDEO = new Set(['Panca piana con bilanciere', 'Squat con bilanciere', 'Stacco da terra', 'Goblet squat', 'Hip thrust', 'Lat machine presa larga', 'Chest press', 'Leg press',
  'Stacco rumeno', 'Rematore con manubrio', 'Lento avanti con manubri', 'Affondi con manubri', 'Plank', 'Kettlebell swing', 'Face pull', 'Trazioni alla sbarra']);
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const exercises: Row[] = (SEED as Row[]).map((e, i) => ({
  id: `ex${i + 1}`, name: e.name, muscle_group: e.muscle_group, equipment: e.equipment, description: e.description,
  video_url: VIDEO.has(e.name) ? `https://example.com/video/${slug(e.name)}` : null, image_url: null, active: true, created_at: at(-200, 9),
}));
const EX = (name: string): Row => { const e = exercises.find((x) => x.name === name); if (!e) throw new Error('Esercizio mancante: ' + name); return e; };

// ───────── Persone ─────────
const person = (id: string, first: string, last: string, role: string, extra: Row = {}): Row => ({
  id, first_name: first, last_name: last, full_name: `${first} ${last}`, phone: null, email: `${first.toLowerCase()}.${last.toLowerCase()}@esempio.it`, role,
  trainer_id: null, goal: null, height_cm: null, active: true, created_at: at(-120, 10), ...extra,
});
const profiles: Row[] = [
  person('u-owner', 'Laura', 'Conti', 'owner', { email: 'titolare@demo.it', phone: '333 7001122' }),
  person('u-trainer', 'Marco', 'Bellini', 'trainer', { email: 'pt@demo.it', phone: '347 5550101' }),
  person('u-trainer2', 'Silvia', 'Marchetti', 'trainer', { phone: '349 5550102' }),
  person('u-member', 'Giulia', 'Ferri', 'member', { email: 'socio@demo.it', phone: '338 4412345', trainer_id: 'u-trainer', goal: 'Tornare in forma dopo l\'estate e rinforzare le gambe.', height_cm: 168, created_at: at(-75, 18) }),
  person('m2', 'Alessandro', 'Greco', 'member', { trainer_id: 'u-trainer', goal: 'Aumentare la forza su panca e squat.', phone: '339 1100221', created_at: at(-200, 12) }),
  person('m3', 'Sara', 'Mancini', 'member', { trainer_id: null, phone: '320 8890033', created_at: at(-5, 17) }),
  person('m4', 'Davide', 'Rinaldi', 'member', { trainer_id: 'u-trainer2', goal: 'Perdere 6 kg entro Natale.', created_at: at(-160, 19) }),
  person('m5', 'Chiara', 'Bruno', 'member', { trainer_id: 'u-trainer2', goal: 'Massa muscolare.', phone: '333 2200456', created_at: at(-300, 11) }),
  person('m6', 'Luca', 'Moretti', 'member', { trainer_id: null, created_at: at(-2, 20) }),
  person('m7', 'Elena', 'Costa', 'member', { trainer_id: 'u-trainer', phone: '328 6677001', created_at: at(-95, 9) }),
  person('m8', 'Matteo', 'Fontana', 'member', { trainer_id: 'u-trainer', goal: 'Ripresa dopo un infortunio alla spalla.', created_at: at(-140, 18) }),
  person('m9', 'Federica', 'Serra', 'member', { trainer_id: 'u-trainer2', created_at: at(-60, 13) }),
  person('m10', 'Paolo', 'Gentile', 'member', { trainer_id: 'u-trainer', phone: '335 9900112', created_at: at(-410, 8) }),
  person('m11', 'Valentina', 'Rizzo', 'member', { trainer_id: 'u-trainer', goal: 'Tonificare gambe e glutei.', created_at: at(-12, 16) }),
  person('m12', 'Simone', 'Caruso', 'member', { trainer_id: 'u-trainer2', created_at: at(-45, 19) }),
  person('m13', 'Martina', 'Lombardi', 'member', { trainer_id: 'u-trainer', created_at: at(-30, 12) }),
  person('m14', 'Andrea', 'Barbieri', 'member', { trainer_id: 'u-trainer2', phone: '347 1239876', created_at: at(-220, 17) }),
  person('m15', 'Francesca', 'Galli', 'member', { trainer_id: null, active: false, created_at: at(-380, 10) }),
];

// ───────── Schede ─────────
type ItemDef = [name: string, sets: number, reps: string, rest: number, extra?: { load?: string; note?: string; ss?: string; tempo?: string }];
type DayDef = [name: string, focus: string, items: ItemDef[]];
const programs: Row[] = [], days: Row[] = [], items: Row[] = [];

function addProgram(p: { id?: string; name: string; goal?: string; member?: string | null; trainer?: string; status: string; template?: boolean; startsOn?: string | null; weeks: number; notes?: string; created?: string; days: DayDef[] }) {
  const id = p.id || uid();
  programs.push({ id, name: p.name, goal: p.goal || null, member_id: p.member ?? null, trainer_id: p.trainer || 'u-trainer', status: p.status, is_template: !!p.template, starts_on: p.startsOn ?? null, weeks: p.weeks, notes: p.notes || null, created_at: p.created || at(-30, 10) });
  p.days.forEach(([name, focus, its], di) => {
    const did = uid();
    days.push({ id: did, program_id: id, position: di + 1, name, focus });
    its.forEach(([ex, sets, reps, rest, x], ii) => {
      items.push({ id: uid(), day_id: did, position: ii + 1, exercise_id: EX(ex).id, sets, reps, load_hint: x?.load || null, rest_sec: rest, tempo: x?.tempo || null, note: x?.note || null, superset: x?.ss || null });
    });
  });
  return id;
}

const FULL_A: DayDef = ['Allenamento A', 'Gambe e spinta', [
  ['Leg press', 3, '12', 90], ['Chest press', 3, '12', 75], ['Lat machine presa larga', 3, '12', 75], ['Lento avanti con manubri', 2, '12', 60], ['Plank', 3, '30 sec', 45]]];
const FULL_B: DayDef = ['Allenamento B', 'Glutei e tirata', [
  ['Hip thrust', 3, '12', 90], ['Pulley basso', 3, '12', 75], ['Panca piana con manubri', 3, '10', 75], ['Leg curl sdraiato', 3, '12', 60], ['Crunch', 3, '15', 45]]];
const FULL_C: DayDef = ['Allenamento C', 'Total body', [
  ['Goblet squat', 3, '12', 75], ['Rematore con manubrio', 3, '10', 75], ['Piegamenti sulle braccia', 3, '8', 60, { note: 'Se serve, appoggia le ginocchia.' }], ['Stacco rumeno', 3, '10', 90], ['Cyclette', 1, '10 min', 0]]];

addProgram({ id: 'tpl-full', name: 'Principianti – full body 3 giorni', goal: 'Imparare i movimenti e costruire una base', template: true, status: 'draft', weeks: 6, notes: 'Tre allenamenti a settimana, mai due giorni di fila. Aumenta il carico solo se chiudi tutte le serie con tecnica pulita.', days: [FULL_A, FULL_B, FULL_C], created: at(-150, 10) });
addProgram({ id: 'tpl-forza', name: 'Forza – alto/basso 4 giorni', goal: 'Aumentare la forza sui fondamentali', template: true, status: 'draft', weeks: 6, days: [
  ['Alto A', 'Panca e tirate', [['Panca piana con bilanciere', 4, '5', 150, { load: 'RPE 8' }], ['Rematore con bilanciere', 4, '6', 120], ['Military press con bilanciere', 3, '6', 120], ['Trazioni alla sbarra', 3, '6-8', 90], ['French press con bilanciere EZ', 3, '10', 60, { ss: 'A' }], ['Curl con bilanciere', 3, '10', 60, { ss: 'A' }]]],
  ['Basso A', 'Squat', [['Squat con bilanciere', 4, '5', 180, { load: 'RPE 8' }], ['Stacco rumeno', 3, '8', 120], ['Affondi bulgari', 3, '8', 90], ['Calf in piedi', 4, '12', 60], ['Plank', 3, '45 sec', 45]]],
  ['Alto B', 'Spinte e tirate leggere', [['Panca inclinata con manubri', 4, '8', 90], ['Lat machine presa stretta', 4, '8', 90], ['Alzate laterali', 4, '12', 45], ['Face pull', 3, '15', 45]]],
  ['Basso B', 'Stacco', [['Stacco da terra', 4, '4', 180, { load: 'RPE 8' }], ['Leg press', 3, '10', 90], ['Leg curl sdraiato', 3, '10', 75], ['Sollevamento gambe alla sbarra', 3, '10', 60]]],
], created: at(-140, 10) });
addProgram({ id: 'tpl-ppl', name: 'Ipertrofia – push/pull/legs', goal: 'Aumentare la massa muscolare', template: true, status: 'draft', weeks: 8, days: [
  ['Push', 'Petto, spalle, tricipiti', [['Panca piana con manubri', 4, '8-10', 90], ['Panca inclinata con manubri', 3, '10-12', 75], ['Lento avanti con manubri', 3, '10', 75], ['Alzate laterali', 4, '15', 45], ['Push down ai cavi', 3, '12', 60]]],
  ['Pull', 'Schiena e bicipiti', [['Trazioni alla sbarra', 4, '6-8', 120], ['Rematore con manubrio', 3, '10', 75], ['Pulley basso', 3, '12', 75], ['Face pull', 3, '15', 45], ['Curl a martello', 3, '12', 60]]],
  ['Legs', 'Gambe e polpacci', [['Squat con bilanciere', 4, '8', 150], ['Stacco rumeno', 3, '10', 120], ['Leg extension', 3, '12', 60], ['Leg curl sdraiato', 3, '12', 60], ['Calf seduto', 4, '15', 45]]],
], created: at(-130, 10) });
addProgram({ id: 'tpl-circ', name: 'Dimagrimento – circuito', goal: 'Consumo energetico e tenuta cardio', template: true, status: 'draft', weeks: 4, days: [
  ['Circuito 1', 'Total body', [['Kettlebell swing', 3, '15', 30], ['Goblet squat', 3, '15', 30], ['Piegamenti sulle braccia', 3, '10', 30], ['Mountain climber', 3, '30 sec', 30], ['Tapis roulant', 1, '15 min', 0]]],
  ['Circuito 2', 'Gambe e core', [['Affondi con manubri', 3, '12', 30], ['Ponte glutei', 3, '15', 30], ['Russian twist', 3, '20', 30], ['Burpees', 3, '10', 45], ['Vogatore', 1, '10 min', 0]]],
], created: at(-100, 10) });

const MON = (off: number) => isoDay(addDays(startOfWeek(T0), off));
// Scheda attiva della socia di prova (settimana 3 di 8)
const GIULIA_PROGRAM = addProgram({ id: 'p-giulia', name: 'Tonificazione – fase 2', goal: 'Gambe e glutei più forti, parte alta tonica', member: 'u-member', trainer: 'u-trainer', status: 'active', startsOn: MON(-14), weeks: 8,
  notes: 'Tre allenamenti a settimana. Riscaldati 5 minuti sulla cyclette. Se un carico ti sembra facile, alzalo di 2,5 kg la volta dopo.', created: at(-17, 11), days: [
    ['Gambe e glutei', 'Gambe, glutei, polpacci', [['Leg press', 4, '12', 90, { load: '60 kg' }], ['Hip thrust', 4, '10', 90, { load: '40 kg', note: 'Fermati un secondo in alto.' }], ['Affondi con manubri', 3, '10', 60, { load: '8 kg' }], ['Leg curl sdraiato', 3, '12', 60], ['Abduzioni alla macchina', 3, '15', 45], ['Calf in piedi', 3, '15', 45], ['Plank', 3, '30 sec', 45]]],
    ['Parte alta', 'Petto, schiena, spalle, braccia', [['Chest press', 3, '12', 90], ['Lat machine presa larga', 3, '12', 90], ['Lento avanti con manubri', 3, '10', 75, { load: '6 kg' }], ['Pulley basso', 3, '12', 75], ['Alzate laterali', 3, '15', 45, { ss: 'A' }], ['Face pull', 3, '15', 45, { ss: 'A' }], ['Push down ai cavi', 3, '12', 45, { ss: 'B' }], ['Curl con manubri alternato', 3, '12', 45, { ss: 'B' }]]],
    ['Total body e core', 'Forza funzionale', [['Goblet squat', 3, '12', 75, { load: '12 kg' }], ['Stacco rumeno', 3, '10', 90, { load: '30 kg', note: 'Schiena neutra: porta i fianchi indietro.' }], ['Rematore con manubrio', 3, '10', 75], ['Piegamenti sulle braccia', 3, '8', 60, { note: 'Anche con le ginocchia a terra.' }], ['Kettlebell swing', 3, '15', 60], ['Russian twist', 3, '20', 45], ['Cyclette', 1, '10 min', 0]]],
  ] });
const ARCHIVED = addProgram({ name: 'Ripartenza – full body', goal: 'Rimettersi in moto dopo la pausa estiva', member: 'u-member', trainer: 'u-trainer', status: 'archived', startsOn: MON(-14 - 7 * 6), weeks: 6, created: at(-70, 11), days: [FULL_A, FULL_B, FULL_C] });

// copia di un modello per un socio
function fromTemplate(tplId: string, member: string, trainer: string, status: string, startsOn: string | null, weeks?: number, name?: string) {
  const t = programs.find((p) => p.id === tplId)!;
  const defs: DayDef[] = days.filter((d) => d.program_id === tplId).sort((a, b) => a.position - b.position).map((d) => [d.name, d.focus, items.filter((i) => i.day_id === d.id).sort((a, b) => a.position - b.position).map((i): ItemDef => [exercises.find((e) => e.id === i.exercise_id)!.name, i.sets, i.reps, i.rest_sec, { load: i.load_hint || undefined, note: i.note || undefined, ss: i.superset || undefined, tempo: i.tempo || undefined }])]);
  return addProgram({ name: name || t.name, goal: t.goal, member, trainer, status, startsOn, weeks: weeks ?? t.weeks, created: at(-40, 10), days: defs });
}
const weeksAgo = (n: number, extraDays = 0) => dayStr(-(n * 7 + extraDays));
fromTemplate('tpl-forza', 'm2', 'u-trainer', 'active', weeksAgo(5, 4), 6);           // scade fra pochi giorni
fromTemplate('tpl-circ', 'm4', 'u-trainer2', 'active', weeksAgo(3), 8, 'Dimagrimento – fase 1');
fromTemplate('tpl-ppl', 'm5', 'u-trainer2', 'active', weeksAgo(2), 8);
fromTemplate('tpl-full', 'm7', 'u-trainer', 'active', weeksAgo(4), 6);
fromTemplate('tpl-forza', 'm8', 'u-trainer', 'active', weeksAgo(7), 6, 'Rientro spalla – forza leggera');   // già scaduta
fromTemplate('tpl-full', 'm9', 'u-trainer2', 'active', weeksAgo(1), 6);
fromTemplate('tpl-ppl', 'm10', 'u-trainer', 'active', weeksAgo(6), 12);
fromTemplate('tpl-full', 'm11', 'u-trainer', 'draft', null, 6, 'Gambe e glutei – base');   // bozza da attivare
fromTemplate('tpl-ppl', 'm12', 'u-trainer2', 'active', weeksAgo(3), 8);
fromTemplate('tpl-circ', 'm13', 'u-trainer', 'active', weeksAgo(1), 4);
fromTemplate('tpl-full', 'm14', 'u-trainer2', 'active', weeksAgo(2), 6);

// ───────── Allenamenti già fatti ─────────
const workouts: Row[] = [], set_logs: Row[] = [];
const MULT: Record<string, number> = { gambe: 1.7, glutei: 1.5, schiena: 1.1, petto: 1, spalle: 0.5, bicipiti: 0.45, tricipiti: 0.55, polpacci: 1.2, total_body: 0.8 };
function baseLoad(e: Row): number {
  if (['cardio', 'mobilita', 'addome'].includes(e.muscle_group) || e.equipment === 'corpo libero' || /sbarra|tappetino|ruota/.test(e.equipment || '')) return 0;
  const eq = e.equipment || '';
  const b = /bilanciere|multipower/.test(eq) ? 40 : /manubri|kettlebell/.test(eq) ? 12 : /cavi|macchina|panca/.test(eq) ? 32 : 24;
  return b * (MULT[e.muscle_group] ?? 1);
}
const round = (n: number) => (n <= 0 ? 0 : n < 20 ? Math.round(n * 2) / 2 : Math.round(n / 2.5) * 2.5);
function genWorkouts(member: string, programId: string, dayOffsets: number[], strength: number, startHour = 18) {
  const prog = programs.find((p) => p.id === programId)!;
  const pd = days.filter((d) => d.program_id === programId).sort((a, b) => a.position - b.position);
  const ordered = [...dayOffsets].sort((a, b) => a - b); // dal più vecchio al più recente
  ordered.forEach((off, j) => {
    const d = pd[j % pd.length];
    const w = uid();
    const started = at(off, startHour, (j * 7) % 40);
    const mins = 48 + ((j * 5) % 18);
    workouts.push({ id: w, member_id: member, program_id: prog.status === 'active' || prog.status === 'archived' ? programId : null, day_id: d.id, day_name: d.name, started_at: started, finished_at: new Date(+new Date(started) + mins * 60000).toISOString(), rpe: [7, 8, 7, 9, 8, 7][j % 6], note: j % 5 === 3 ? 'Ginocchio un po\' rigido nel riscaldamento, poi ok.' : null });
    items.filter((i) => i.day_id === d.id).sort((a, b) => a.position - b.position).forEach((it) => {
      const ex = exercises.find((e) => e.id === it.exercise_id)!;
      const growth = 1 + 0.03 * j;
      const hint = parseFloat(String(it.load_hint || '').replace(',', '.'));
      const w0 = hint > 0 ? round(hint * Math.min(1, 0.82 + 0.035 * j)) : round(baseLoad(ex) * strength * growth);
      const fr = parseInt(String(it.reps).split('-')[0], 10) || 10;
      for (let s = 1; s <= it.sets; s++) {
        set_logs.push({ id: uid(), workout_id: w, member_id: member, exercise_id: it.exercise_id, item_id: it.id, set_no: s, reps: s === it.sets && it.sets > 1 && fr > 8 ? fr - 1 : fr, weight_kg: w0 || null });
      }
    });
  });
}
genWorkouts('u-member', ARCHIVED, [-64, -61, -58, -55, -52, -49, -46, -43, -40, -37, -34, -31, -28, -25, -22, -19, -16], 0.5);
genWorkouts('u-member', GIULIA_PROGRAM, [-13, -11, -9, -6, -4, -2], 0.66);
const prog = (m: string) => programs.find((p) => p.member_id === m && p.status === 'active')?.id;
genWorkouts('m2', prog('m2')!, [-33, -31, -28, -26, -24, -21, -19, -17, -14, -12, -10, -7, -5, -2], 1.35, 7);
genWorkouts('m4', prog('m4')!, [-18, -21, -23, -25], 1.05, 20);
genWorkouts('m5', prog('m5')!, [-13, -11, -9, -6, -4, -2, -1], 0.95, 17);
genWorkouts('m7', prog('m7')!, [-27, -24, -20, -17, -13, -10, -6, -3], 0.7, 12);
genWorkouts('m8', prog('m8')!, [-48, -45, -41, -38, -34, -31, -27, -24, -6], 1.0, 19);
genWorkouts('m9', prog('m9')!, [-6, -4, -2], 0.7, 18);
genWorkouts('m10', prog('m10')!, [-70, -66, -60, -50, -40, -30, -22, -16], 1.1, 8);
genWorkouts('m12', prog('m12')!, [-19, -16, -14, -12, -9, -7, -4, -1], 1.2, 19);
genWorkouts('m13', prog('m13')!, [-6, -4, -1], 0.75, 13);
genWorkouts('m14', prog('m14')!, [-13, -10, -8, -6, -3], 1.0, 20);

// ───────── Misure, note, messaggi ─────────
const meas = (m: string, off: number, o: Row) => ({ id: uid(), member_id: m, measured_on: dayStr(off), weight_kg: null, body_fat_pct: null, waist_cm: null, chest_cm: null, hips_cm: null, arm_cm: null, thigh_cm: null, note: null, ...o });
const measurements: Row[] = [
  meas('u-member', -70, { weight_kg: 66.4, body_fat_pct: 27.5, waist_cm: 75, hips_cm: 99, thigh_cm: 58 }),
  meas('u-member', -56, { weight_kg: 65.8, waist_cm: 74.5, hips_cm: 98.5 }),
  meas('u-member', -42, { weight_kg: 65.1, body_fat_pct: 26.8, waist_cm: 73.5, hips_cm: 98, thigh_cm: 57.5 }),
  meas('u-member', -28, { weight_kg: 64.6, waist_cm: 72.5, hips_cm: 97, note: 'Dopo le vacanze.' }),
  meas('u-member', -14, { weight_kg: 63.9, body_fat_pct: 25.6, waist_cm: 71.5, hips_cm: 96.5, thigh_cm: 57 }),
  meas('u-member', -3, { weight_kg: 63.2, waist_cm: 71, hips_cm: 96 }),
  meas('m2', -30, { weight_kg: 84.5, body_fat_pct: 16 }), meas('m2', -2, { weight_kg: 85.4, body_fat_pct: 15.4 }),
];
const staff_notes: Row[] = [
  { id: uid(), member_id: 'u-member', author_id: 'u-trainer', body: 'Si allena volentieri la sera. Ha fatto un controllo dal medico sportivo a settembre: nulla da segnalare.', created_at: at(-60, 19) },
  { id: uid(), member_id: 'u-member', author_id: 'u-trainer', body: 'Cresce bene su hip thrust e leg press: dalla prossima fase si può salire di 5 kg.', created_at: at(-4, 11) },
  { id: uid(), member_id: 'm8', author_id: 'u-trainer', body: 'Evitare per ora esercizi sopra la testa, riprendere con cautela.', created_at: at(-50, 16) },
];
const program_comments: Row[] = [
  { id: uid(), program_id: GIULIA_PROGRAM, author_id: 'u-trainer', body: 'Ciao Giulia, ecco la scheda nuova! Tre allenamenti a settimana, dimmi se qualche esercizio ti dà fastidio.', created_at: at(-17, 12) },
  { id: uid(), program_id: GIULIA_PROGRAM, author_id: 'u-member', body: 'Grazie Marco! Gli affondi mi stancano molto le ginocchia, posso farli con meno peso?', created_at: at(-9, 20) },
  { id: uid(), program_id: GIULIA_PROGRAM, author_id: 'u-trainer', body: 'Certo, scendi a 6 kg e fermati a metà escursione. Se continua, li sostituiamo con lo step-up.', created_at: at(-9, 21) },
];

export const DB: Record<string, Row[]> = {
  profiles, exercises, programs, program_days: days, program_items: items, workouts, set_logs, measurements, staff_notes, program_comments,
  gym_settings: [{ id: 1, name: GYM, join_code: JOIN_CODE }],
  push_tokens: [],
};
