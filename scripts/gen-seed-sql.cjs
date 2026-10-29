#!/usr/bin/env node
// Legge supabase/seed/exercises.json e riscrive la sezione compresa tra
//   -- <seed-esercizi>   e   -- </seed-esercizi>
// di supabase/update_1_1.sql con un unico INSERT ... ON CONFLICT DO NOTHING.
// Eseguire poi: node scripts/build-setup.cjs
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const jsonPath = path.join(root, 'supabase', 'seed', 'exercises.json');
const sqlPath = path.join(root, 'supabase', 'update_1_1.sql');

const rows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const GROUPS = ['petto','schiena','spalle','trapezi','bicipiti','tricipiti','avambracci','quadricipiti','femorali','glutei','adduttori','abduttori','polpacci','addome','lombari','cardio','total_body','mobilita'];
const CATS = ['forza','funzionale','pliometria','cardio','mobilita','stretching'];
const names = new Set();
for (const r of rows) {
  if (!GROUPS.includes(r.muscle_group)) throw new Error('gruppo non valido: ' + r.name);
  if (!CATS.includes(r.category)) throw new Error('categoria non valida: ' + r.name);
  const k = r.name.toLowerCase();
  if (names.has(k)) throw new Error('nome doppio: ' + r.name);
  names.add(k);
}

const values = rows
  .map((r) => `  (${q(r.name)}, ${q(r.muscle_group)}, ${q(r.category)}, ${r.equipment ? q(r.equipment) : 'null'}, ${r.description ? q(r.description) : 'null'})`)
  .join(',\n');

const block =
  '-- <seed-esercizi>\n' +
  `-- (generato da scripts/gen-seed-sql.cjs: ${rows.length} esercizi di partenza, testi originali; chi esiste già non viene toccato)\n` +
  'insert into exercises (name, muscle_group, category, equipment, description) values\n' +
  values +
  '\non conflict do nothing;\n' +
  '-- </seed-esercizi>';

let sql = fs.readFileSync(sqlPath, 'utf8');
const re = /-- <seed-esercizi>[\s\S]*?-- <\/seed-esercizi>/;
if (!re.test(sql)) throw new Error('segnaposto non trovato in update_1_1.sql');
sql = sql.replace(re, () => block);
fs.writeFileSync(sqlPath, sql);
console.log('scritti', rows.length, 'esercizi in', path.relative(root, sqlPath));
