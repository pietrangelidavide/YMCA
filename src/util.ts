// Funzioni di servizio: identificatori, date in italiano, numeri.

export function uuid(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';
    else if (i === 14) s += '4';
    else if (i === 19) s += h[(Math.random() * 4) | 8];
    else s += h[(Math.random() * 16) | 0];
  }
  return s;
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const GIORNI_LUNGHI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
export const WEEKDAYS_MON = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

export const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
// lunedì della settimana di d
export const startOfWeek = (d: Date) => { const x = startOfDay(d); const k = (x.getDay() + 6) % 7; return addDays(x, -k); };
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseDay = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

export const fmtDate = (d: Date | string) => { const x = typeof d === 'string' ? new Date(d) : d; return `${x.getDate()} ${MESI[x.getMonth()]}`; };
export const fmtDateLong = (d: Date | string) => { const x = typeof d === 'string' ? new Date(d) : d; return `${GIORNI_LUNGHI[x.getDay()]} ${x.getDate()} ${MESI_LUNGHI[x.getMonth()]}`; };
export const fmtDateShortY = (d: Date | string) => { const x = typeof d === 'string' ? (d.length === 10 ? parseDay(d) : new Date(d)) : d; return `${x.getDate()} ${MESI[x.getMonth()]} ${x.getFullYear()}`; };
// «ott 26» per i grafici mensili
export const fmtMonthShort = (d: Date | string) => { const x = typeof d === 'string' ? parseDay(d) : d; return `${MESI[x.getMonth()]} ${String(x.getFullYear()).slice(2)}`; };
export const fmtMonthLong = (d: Date) => `${MESI_LUNGHI[d.getMonth()]} ${d.getFullYear()}`;
export const isDayStr = (s?: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDay(s).getTime());
export const fmtWeekday = (d: Date | string) => { const x = typeof d === 'string' ? new Date(d) : d; return GIORNI[x.getDay()]; };
export const fmtTime = (d: Date | string) => { const x = typeof d === 'string' ? new Date(d) : d; return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };

// "oggi", "ieri", "3 giorni fa", "2 settimane fa"
export function ago(iso?: string | null, now = new Date()): string {
  if (!iso) return 'mai';
  const n = Math.round((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / 86400000);
  if (n <= 0) return 'oggi';
  if (n === 1) return 'ieri';
  if (n < 14) return `${n} giorni fa`;
  if (n < 60) return `${Math.round(n / 7)} settimane fa`;
  return `${Math.round(n / 30)} mesi fa`;
}
export const daysSince = (iso?: string | null, now = new Date()) => (iso ? Math.round((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / 86400000) : null);

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 6 ? 'Buonanotte' : h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
}

export const fmtClock = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, '0')}`;
export const fmtRest = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}${s % 60 ? ':' + String(s % 60).padStart(2, '0') : ''} min` : `${s} s`);

// numeri all'italiana: "62,5" -> 62.5
export function parseNum(s: any): number | null {
  if (s === null || s === undefined) return null;
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  const t = String(s).trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
export function fmtNum(n: number | null | undefined, max = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  const r = Math.round(n * 10 ** max) / 10 ** max;
  return String(r).replace('.', ',');
}
export const fmtSize = (b?: number | null) => (!b ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${fmtNum(b / 1048576, 1)} MB`);
export const fmtKg = (n: number | null | undefined) => (n ? `${fmtNum(n, 2)} kg` : 'corpo libero');

// "10" o "8-10" -> prima cifra (per proporre le ripetizioni); "30 sec" -> null
export function firstReps(reps?: string | null): number | null {
  const m = /^\s*(\d{1,3})(?:\s*[-–/]\s*\d{1,3})?\s*(?:rip|ripetizioni)?\s*$/i.exec(reps || '');
  return m ? Number(m[1]) : null;
}
// "20 kg", "20", "RPE 8" -> 20 oppure null
export function loadNumber(hint?: string | null): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*$/i.exec(hint || '');
  return m ? parseNum(m[1]) : null;
}

export const initials = (name?: string | null) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';

// Categorie muscolari (stessi valori del database, vedi supabase/update_1_1.sql)
export const MUSCLE: Record<string, string> = {
  petto: 'Pettorali', schiena: 'Dorsali', spalle: 'Spalle', trapezi: 'Trapezi', bicipiti: 'Bicipiti', tricipiti: 'Tricipiti', avambracci: 'Avambracci',
  quadricipiti: 'Quadricipiti', femorali: 'Femorali', glutei: 'Glutei', adduttori: 'Adduttori', abduttori: 'Abduttori', polpacci: 'Polpacci',
  addome: 'Addominali', lombari: 'Lombari', cardio: 'Cardio', total_body: 'Total body', mobilita: 'Mobilità',
};
export const MUSCLE_KEYS = Object.keys(MUSCLE);
export const muscleLabel = (g?: string | null) => (g && MUSCLE[g]) || g || '';

// Categorie degli esercizi (che tipo di lavoro è, a prescindere dal muscolo)
export const CATEGORY: Record<string, string> = {
  forza: 'Forza', funzionale: 'Funzionale', pliometria: 'Pliometria', cardio: 'Cardio', mobilita: 'Mobilità', stretching: 'Stretching',
};
export const CATEGORY_KEYS = Object.keys(CATEGORY);
// «senza attrezzo» = corpo libero oppure nessun attrezzo indicato
export const noEquipment = (equipment?: string | null) => !equipment || /^corpo libero$/i.test(equipment.trim());

// Dati delle schede
export const OBJECTIVE: Record<string, string> = {
  mantenimento: 'Mantenimento', forza: 'Aumento forza', dimagrimento: 'Dimagrimento', massa: 'Aumento massa', definizione: 'Definizione', tonificazione: 'Tonificazione',
};
export const OBJECTIVE_KEYS = Object.keys(OBJECTIVE);
export const LEVEL: Record<string, string> = { facile: 'Facile', medio: 'Medio', avanzato: 'Avanzato' };
export const LEVEL_KEYS = Object.keys(LEVEL);
export const TARGET: Record<string, string> = { tutti: 'Uomo e donna', uomo: 'Uomo', donna: 'Donna' };
export const TARGET_KEYS = Object.keys(TARGET);

// Età in anni compiuti da una data di nascita «2000-05-17»
export function ageOf(birth?: string | null, now = new Date()): number | null {
  if (!birth) return null;
  const b = parseDay(birth);
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return a >= 0 && a < 120 ? a : null;
}

// Indice di massa corporea
export const bmi = (kg?: number | null, cm?: number | null) => (kg && cm ? kg / ((cm / 100) ** 2) : null);

// Percentuale di grasso dalle pliche: Jackson-Pollock a 3 punti + equazione di Siri.
// Uomo: petto, addome, coscia. Donna: tricipite, soprailiaca, coscia (millimetri).
export const SKINFOLD_SITES: Record<'m' | 'f', [string, string][]> = {
  m: [['chest_mm', 'Petto'], ['abdominal_mm', 'Addome'], ['thigh_mm', 'Coscia']],
  f: [['triceps_mm', 'Tricipite'], ['suprailiac_mm', 'Soprailiaca'], ['thigh_mm', 'Coscia']],
};
export function jacksonPollock3(sex: 'm' | 'f' | null | undefined, age: number | null, folds: Record<string, number | null | undefined>): { bf: number; density: number } | null {
  if (!sex || age === null) return null;
  const sites = SKINFOLD_SITES[sex].map(([k]) => folds[k]);
  if (sites.some((v) => v === null || v === undefined || !(v > 0))) return null;
  const s = (sites as number[]).reduce((a, b) => a + b, 0);
  const density = sex === 'm'
    ? 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * age
    : 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * age;
  const bf = 495 / density - 450;
  return bf > 1 && bf < 70 ? { bf: Math.round(bf * 10) / 10, density } : null;
}

// Tabella per Excel italiano: separatore «;» e segno di codifica all'inizio
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: any) => { const s = v === null || v === undefined ? '' : String(v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

// parole chiave per cercare senza badare a maiuscole e accenti
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function youtubeId(url?: string | null): string | null {
  const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/.exec(url || '');
  return m ? m[1] : null;
}
