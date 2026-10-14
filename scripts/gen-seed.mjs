// Genera il blocco SQL con gli esercizi di partenza (da supabase/seed/exercises.json) e lo aggiunge a setup.sql.
// Uso: node scripts/gen-seed.mjs   (si può rilanciare: sostituisce il blocco precedente)
import { readFileSync, writeFileSync } from 'node:fs';
const ex = JSON.parse(readFileSync(new URL('../supabase/seed/exercises.json', import.meta.url), 'utf8'));
const q = (s) => (s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'");
const MARK = '-- ───────── Esercizi di partenza ─────────';
const rows = ex.map((e) => `  (${q(e.name)}, ${q(e.muscle_group)}, ${q(e.equipment)}, ${q(e.description)})`).join(',\n');
const block = `${MARK}\n-- ${ex.length} esercizi comuni. Il PT può modificarli, aggiungere il link a un video e crearne di nuovi dall'app.\ninsert into exercises (name, muscle_group, equipment, description) values\n${rows}\non conflict do nothing;\n\n`;
const f = new URL('../supabase/setup.sql', import.meta.url);
let sql = readFileSync(f, 'utf8');
const i = sql.indexOf(MARK);
if (i >= 0) { const j = sql.indexOf('-- ───────── Dopo l\'esecuzione', i); sql = sql.slice(0, i) + sql.slice(j); }
const k = sql.indexOf('-- ───────── Dopo l\'esecuzione');
sql = sql.slice(0, k) + block + sql.slice(k);
writeFileSync(f, sql);
console.log('Esercizi inseriti:', ex.length);
