// Compone supabase/setup.sql = base_1_0.sql (database della versione 1.0) + update_1_1.sql + update_1_2.sql (novità) + passaggi finali.
// Uso: node scripts/build-setup.cjs   (dopo aver modificato uno dei due file sorgente)
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'supabase');
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

const header = `-- YMCA Prime Training: setup completo del database Supabase (versione 1.2)
-- FILE GENERATO da scripts/build-setup.cjs (base_1_0.sql + update_1_1.sql + update_1_2.sql): non modificarlo a mano.
-- Per un progetto Supabase NUOVO e vuoto (regione UE, per i dati dei soci): incolla tutto nel SQL Editor ed esegui una volta.
-- Chi ha già eseguito una versione precedente non deve rifarlo: gli bastano gli aggiornamenti (supabase/update_1_1.sql, poi update_1_2.sql).
-- In fondo: i passaggi da fare dopo (titolare, codice palestra).

`;
// il vecchio file iniziava con tre righe di commento: le sostituisce l'intestazione nuova
const base = read('base_1_0.sql').split('\n').filter((l, i) => !(i < 3 && l.startsWith('--'))).join('\n').replace(/^\n+/, '');
const update = read('update_1_1.sql');
const update2 = read('update_1_2.sql');
const trailer = `
-- ───────── Dopo l'esecuzione ─────────
-- 1. Registrati dall'app con la tua email, poi nomina te stesso titolare (sostituisci l'email):
--      update profiles set role = 'owner' where email = 'EMAIL-TITOLARE';
-- 2. Per limitare le registrazioni ai soci della palestra scegli un codice (poi comunicalo ai soci):
--      update gym_settings set name = 'NOME PALESTRA', join_code = 'CODICE';
--    Con join_code vuoto chiunque può registrarsi (vede solo il catalogo esercizi, mai i dati degli altri soci).
-- 3. Nell'app, dalla scheda Altro > Collaboratori, il titolare può promuovere un socio a PT.
-- 4. Verifica in Storage che esistano i contenitori «documents» (privato) e «exercise-media» (pubblico): li crea questo script.
`;
fs.writeFileSync(path.join(dir, 'setup.sql'), header + base.replace(/\s+$/, '') + '\n\n-- ═════════ Aggiornamento 1.1 (identico a update_1_1.sql) ═════════\n\n' + update.replace(/\s+$/, '') + '\n\n-- ═════════ Aggiornamento 1.2 (identico a update_1_2.sql) ═════════\n\n' + update2.replace(/\s+$/, '') + '\n' + trailer);
console.log('supabase/setup.sql generato');
