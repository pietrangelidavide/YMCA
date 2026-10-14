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

export const MUSCLE: Record<string, string> = {
  petto: 'Petto', schiena: 'Schiena', spalle: 'Spalle', bicipiti: 'Bicipiti', tricipiti: 'Tricipiti', gambe: 'Gambe',
  glutei: 'Glutei', polpacci: 'Polpacci', addome: 'Addome', cardio: 'Cardio', total_body: 'Total body', mobilita: 'Mobilità',
};
export const MUSCLE_KEYS = Object.keys(MUSCLE);

// parole chiave per cercare senza badare a maiuscole e accenti
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function youtubeId(url?: string | null): string | null {
  const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/.exec(url || '');
  return m ? m[1] : null;
}
