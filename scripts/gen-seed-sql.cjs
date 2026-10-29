#!/usr/bin/env node
// Riscrive i due blocchi di esercizi di partenza nei file SQL a partire dai JSON in supabase/seed:
//   exercises_1_1.json (i 282 esercizi della versione 1.1, congelati)  ->  update_1_1.sql, tra  -- <seed-esercizi>  e  -- </seed-esercizi>
//   exercises.json (archivio completo, con library_image)               ->  update_1_2.sql, tra  -- <seed-esercizi-1-2>  e  -- </seed-esercizi-1-2>
// Eseguire poi: node scripts/build-setup.cjs
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const GROUPS = ['petto','schiena','spalle','trapezi','bicipiti','tricipiti','avambracci','quadricipiti','femorali','glutei','adduttori','abduttori','polpacci','addome','lombari','cardio','total_body','mobilita'];
const CATS = ['forza','funzionale','pliometria','cardio','mobilita','stretching'];

function load(file) {
  const rows = JSON.parse(fs.readFileSync(path.join(root, 'supabase', 'seed', file), 'utf8'));
  const names = new Set();
  for (const r of rows) {
    if (!GROUPS.includes(r.muscle_group)) throw new Error('gruppo non valido: ' + r.name);
    if (!CATS.includes(r.category)) throw new Error('categoria non valida: ' + r.name);
    if (r.library_image && !/^\d{4}$/.test(r.library_image)) throw new Error('codice immagine non valido: ' + r.name);
    const k = r.name.toLowerCase();
    if (names.has(k)) throw new Error('nome doppio: ' + r.name);
    names.add(k);
  }
  return rows;
}

function replaceBlock(sqlFile, tag, block) {
  const p = path.join(root, 'supabase', sqlFile);
  let sql = fs.readFileSync(p, 'utf8');
  const re = new RegExp(`-- <${tag}>[\\s\\S]*?-- </${tag}>`);
  if (!re.test(sql)) throw new Error(`segnaposto ${tag} non trovato in ${sqlFile}`);
  fs.writeFileSync(p, sql.replace(re, () => block));
}

// 1.1: i 282 esercizi di partenza
const r11 = load('exercises_1_1.json');
replaceBlock('update_1_1.sql', 'seed-esercizi',
  '-- <seed-esercizi>\n' +
  `-- (generato da scripts/gen-seed-sql.cjs: ${r11.length} esercizi di partenza, testi originali; chi esiste già non viene toccato)\n` +
  'insert into exercises (name, muscle_group, category, equipment, description) values\n' +
  r11.map((r) => `  (${q(r.name)}, ${q(r.muscle_group)}, ${q(r.category)}, ${r.equipment ? q(r.equipment) : 'null'}, ${r.description ? q(r.description) : 'null'})`).join(',\n') +
  '\non conflict do nothing;\n' +
  '-- </seed-esercizi>');

// 1.2: archivio completo (i nuovi si aggiungono; i vecchi ricevono solo l'illustrazione se non ce l'hanno)
const all = load('exercises.json');
const have = new Set(r11.map((r) => r.name.toLowerCase()));
for (const r of r11) if (!all.find((x) => x.name === r.name)) throw new Error('manca un esercizio della 1.1: ' + r.name);
const added = all.filter((r) => !have.has(r.name.toLowerCase()));
const withPhoto = all.filter((r) => r.library_image).length;
replaceBlock('update_1_2.sql', 'seed-esercizi-1-2',
  '-- <seed-esercizi-1-2>\n' +
  `-- (generato da scripts/gen-seed-sql.cjs: ${all.length} esercizi in tutto, ${added.length} nuovi; ${withPhoto} con illustrazione)\n` +
  'insert into exercises (name, muscle_group, category, equipment, description, library_image) values\n' +
  all.map((r) => `  (${q(r.name)}, ${q(r.muscle_group)}, ${q(r.category)}, ${r.equipment ? q(r.equipment) : 'null'}, ${r.description ? q(r.description) : 'null'}, ${r.library_image ? q(r.library_image) : 'null'})`).join(',\n') +
  '\non conflict (lower(name)) do update set library_image = coalesce(exercises.library_image, excluded.library_image);\n' +
  '-- </seed-esercizi-1-2>');

console.log(`1.1: ${r11.length} esercizi; 1.2: ${all.length} (${added.length} nuovi, ${withPhoto} con foto)`);
