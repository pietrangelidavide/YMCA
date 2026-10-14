-- Prove dei permessi e delle funzioni (si lancia con run.sh). Ogni blocco simula un utente e controlla cosa può fare.
\set ON_ERROR_STOP on
\set owner   '''00000000-0000-0000-0000-0000000000a1'''
\set trainer '''00000000-0000-0000-0000-0000000000a2'''
\set alice   '''00000000-0000-0000-0000-0000000000b1'''
\set bob     '''00000000-0000-0000-0000-0000000000b2'''

create function t_as(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true); execute 'set local role authenticated'; end $$;
create function t_fails(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return true; end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  (:owner,   'titolare@x.it', '{"first_name":"Giulia","last_name":"Rossi"}'),
  (:trainer, 'pt@x.it',       '{"first_name":"Marco","last_name":"Bianchi"}'),
  (:alice,   'alice@x.it',    '{"first_name":"Alice","last_name":"Verdi","phone":"333 111"}'),
  (:bob,     'bob@x.it',      '{"first_name":"Bob","last_name":"Neri"}');
update profiles set role = 'owner' where email = 'titolare@x.it';
update profiles set role = 'trainer' where email = 'pt@x.it';
update profiles set trainer_id = :trainer where id in (:alice);
do $$ begin assert (select count(*) from profiles) = 4, 'profili creati dal trigger'; assert (select full_name from profiles where email='alice@x.it') = 'Alice Verdi', 'full_name generato'; end $$;

-- 1. profili
do $$ begin
  perform t_as('00000000-0000-0000-0000-0000000000b1');
  assert (select count(*) from profiles) = 1, 'il socio vede solo se stesso';
  update profiles set phone = '333 999' where id = '00000000-0000-0000-0000-0000000000b1';
  assert (select phone from profiles) = '333 999', 'il socio modifica il proprio telefono';
  assert t_fails($q$ update profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000b1' $q$), 'il socio non si fa titolare';
  assert t_fails($q$ update profiles set trainer_id = null where id = '00000000-0000-0000-0000-0000000000b1' $q$), 'il socio non cambia il PT';
  assert (select count(*) from staff_directory()) = 2, 'il socio vede i nomi dello staff';
end $$;
do $$ begin
  perform t_as('00000000-0000-0000-0000-0000000000a2');
  assert (select count(*) from profiles) = 4, 'il PT vede tutti';
  update profiles set trainer_id = '00000000-0000-0000-0000-0000000000a2' where id = '00000000-0000-0000-0000-0000000000b2';
  assert t_fails($q$ update profiles set role = 'trainer' where id = '00000000-0000-0000-0000-0000000000b2' $q$), 'il PT non cambia i ruoli';
end $$;
do $$ begin
  perform t_as('00000000-0000-0000-0000-0000000000a1');
  update profiles set role = 'trainer' where id = '00000000-0000-0000-0000-0000000000b2';
  update profiles set role = 'member' where id = '00000000-0000-0000-0000-0000000000b2';
end $$;

-- 2. esercizi
do $$ declare n int; begin
  perform t_as('00000000-0000-0000-0000-0000000000b1');
  select count(*) into n from exercises; assert n >= 70, 'il socio legge il catalogo';
  assert t_fails($q$ insert into exercises (name, muscle_group) values ('Mio esercizio','petto') $q$), 'il socio non crea esercizi';
end $$;
do $$ begin
  perform t_as('00000000-0000-0000-0000-0000000000a2');
  insert into exercises (name, muscle_group, equipment, video_url) values ('Panca piana con bilanciere (variante)', 'petto', 'bilanciere', 'https://youtu.be/x');
  assert t_fails($q$ insert into exercises (name, muscle_group) values ('x','nonvalido') $q$), 'gruppo muscolare non valido';
  assert t_fails($q$ insert into exercises (name, muscle_group) values ('PANCA PIANA CON BILANCIERE','petto') $q$), 'nome duplicato';
end $$;

-- 3. schede: creazione, bozza invisibile, attivazione, lettura
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;
do $$ declare pid uuid; e1 uuid; e2 uuid; e3 uuid; j jsonb; begin
  perform t_as('00000000-0000-0000-0000-0000000000a2');
  select id into e1 from exercises where name = 'Squat con bilanciere';
  select id into e2 from exercises where name = 'Leg press';
  select id into e3 from exercises where name = 'Plank';
  pid := save_program(jsonb_build_object('name','Forza base','goal','Più forza','member_id','00000000-0000-0000-0000-0000000000b1','weeks',6,
    'days', jsonb_build_array(
      jsonb_build_object('name','Giorno A','focus','Gambe','items', jsonb_build_array(
        jsonb_build_object('exercise_id',e1,'sets',4,'reps','6-8','rest_sec',120,'load_hint','60 kg'),
        jsonb_build_object('exercise_id',e2,'sets',3,'reps','12'))),
      jsonb_build_object('name','Giorno B','items', jsonb_build_array(jsonb_build_object('exercise_id',e3,'sets',3,'reps','45 sec'))))));
  insert into ids values ('prog', pid), ('e1', e1), ('e2', e2), ('e3', e3);
  j := program_json(pid);
  assert jsonb_array_length(j->'days') = 2, 'due giorni';
  assert j->'days'->0->'items'->0->'exercise'->>'name' = 'Squat con bilanciere', 'esercizio incorporato e in ordine';
  assert (j->>'status') = 'draft', 'nasce in bozza';
end $$;
do $$ declare pid uuid; begin
  select v into pid from ids where k = 'prog';
  perform t_as('00000000-0000-0000-0000-0000000000b1');
  assert program_json(pid) is null, 'il socio non vede la bozza';
  assert my_active_program() is null, 'nessuna scheda attiva';
  assert t_fails(format($q$ select save_program('{"name":"hack","member_id":"00000000-0000-0000-0000-0000000000b1"}'::jsonb) $q$)), 'il socio non crea schede';
end $$;
do $$ declare pid uuid; begin
  select v into pid from ids where k = 'prog';
  perform t_as('00000000-0000-0000-0000-0000000000a2');
  perform activate_program(pid, current_date - 3);
end $$;
do $$ declare pid uuid; j jsonb; begin
  select v into pid from ids where k = 'prog';
  perform t_as('00000000-0000-0000-0000-0000000000b1');
  j := my_active_program();
  assert (j->>'id')::uuid = pid, 'il socio vede la scheda attiva';
  assert (select count(*) from programs) = 1, 'e solo quella';
  assert (select count(*) from program_items) = 3, 'voci visibili';
  assert t_fails($q$ update programs set name = 'x' $q$) = false, 'update silenzioso (0 righe) non è errore';
  assert (select name from programs) = 'Forza base', 'ma non ha cambiato nulla';
end $$;
do $$ begin
  perform t_as('00000000-0000-0000-0000-0000000000b2');
  assert (select count(*) from programs) = 0, 'Bob non vede le schede di Alice';
  assert my_active_program() is null;
end $$;

-- 4. modifica scheda: id conservati, riordino, eliminazioni
do $$ declare pid uuid; j jsonb; old_item uuid; newj jsonb; e1 uuid; e2 uuid; e3 uuid; begin
  select v into pid from ids where k = 'prog'; select v into e1 from ids where k='e1'; select v into e2 from ids where k='e2'; select v into e3 from ids where k='e3';
  perform t_as('00000000-0000-0000-0000-0000000000a2');
  j := program_json(pid);
  old_item := (j->'days'->0->'items'->0->>'id')::uuid;
  -- sposto Leg press per primo, tolgo Giorno B, aggiungo un nuovo esercizio
  newj := jsonb_build_object('id', pid, 'name','Forza base v2','weeks',8,'days', jsonb_build_array(
    jsonb_build_object('id', j->'days'->0->>'id','name','Giorno A','focus','Gambe','items', jsonb_build_array(
      j->'days'->0->'items'->1,
      j->'days'->0->'items'->0,
      jsonb_build_object('exercise_id', e3, 'sets', 2, 'reps', '30 sec')))));
  perform save_program(newj);
  j := program_json(pid);
  assert jsonb_array_length(j->'days') = 1, 'Giorno B eliminato';
  assert j->>'name' = 'Forza base v2' and (j->>'weeks')::int = 8, 'testata aggiornata';
  assert j->'days'->0->'items'->0->'exercise'->>'name' = 'Leg press', 'riordinato';
  assert (j->'days'->0->'items'->1->>'id')::uuid = old_item, 'id della riga conservato';
  assert jsonb_array_length(j->'days'->0->'items') = 3, 'nuovo esercizio aggiunto';
  assert (j->>'status') = 'active', 'resta attiva';
end $$;

-- 5. allenamenti: invio idempotente, ultimi valori, progressi
do $$ declare pid uuid; wid uuid := gen_random_uuid(); day uuid; e1 uuid; payload jsonb; begin
  select v into pid from ids where k = 'prog'; select v into e1 from ids where k='e1';
  perform t_as('00000000-0000-0000-0000-0000000000b1');
  day := (my_active_program()->'days'->0->>'id')::uuid;
  payload := jsonb_build_object('id', wid, 'program_id', pid, 'day_id', day, 'day_name','Giorno A',
     'started_at', now() - interval '2 days', 'finished_at', now() - interval '2 days' + interval '50 minutes', 'rpe', 7,
     'sets', jsonb_build_array(
        jsonb_build_object('exercise_id', e1, 'set_no', 1, 'reps', 8, 'weight_kg', 60),
        jsonb_build_object('exercise_id', e1, 'set_no', 2, 'reps', 7, 'weight_kg', 62.5)));
  perform save_workout(payload); perform save_workout(payload);
  assert (select count(*) from workouts) = 1, 'un solo allenamento anche inviato due volte';
  assert (select count(*) from set_logs) = 2, 'serie non duplicate';
  -- secondo allenamento, più recente
  perform save_workout(jsonb_build_object('id', gen_random_uuid(), 'program_id', pid, 'day_id', day, 'day_name','Giorno A', 'started_at', now() - interval '1 hour',
     'sets', jsonb_build_array(jsonb_build_object('exercise_id', e1, 'set_no', 1, 'reps', 6, 'weight_kg', 65))));
  assert (select count(*) from jsonb_array_elements(last_sets(array[e1]))) = 1, 'ultimo allenamento: 1 serie';
  assert (last_sets(array[e1])->0->>'weight_kg')::numeric = 65, 'peso dell''ultima volta';
  assert (progress_summary()->0->>'name') = 'Squat con bilanciere', 'progressi';
  assert (progress_summary()->0->>'sessions')::int = 2, 'due sedute';
  assert (progress_summary()->0->>'pr_weight')::numeric = 65, 'record 65';
  assert jsonb_array_length(progress_summary()->0->'series') = 2;
  assert t_fails($q$ select progress_summary('00000000-0000-0000-0000-0000000000b2') $q$), 'non si leggono i progressi altrui';
  assert (select count(*) from workouts where member_id <> auth.uid()) = 0;
end $$;
do $$ begin
  perform t_as('00000000-0000-0000-0000-0000000000b2');
  assert (select count(*) from workouts) = 0 and (select count(*) from set_logs) = 0, 'Bob non vede gli allenamenti di Alice';
  assert jsonb_array_length(progress_summary()) = 0;
end $$;
do $$ begin
  perform t_as('00000000-0000-0000-0000-0000000000a2');
  assert (select count(*) from workouts) = 2, 'il PT vede gli allenamenti';
  assert jsonb_array_length(progress_summary('00000000-0000-0000-0000-0000000000b1')) = 1, 'il PT vede i progressi di Alice';
end $$;

-- 6. misure
do $$ begin
  perform t_as('00000000-0000-0000-0000-0000000000b1');
  insert into measurements (member_id, weight_kg, waist_cm) values (auth.uid(), 62.4, 71);
  assert t_fails($q$ insert into measurements (member_id, weight_kg) values ('00000000-0000-0000-0000-0000000000b2', 80) $q$), 'non si scrivono misure per altri';
  assert t_fails($q$ insert into measurements (member_id, weight_kg) values (auth.uid(), 62.0) $q$), 'una misura al giorno';
end $$;
do $$ begin
  perform t_as('00000000-0000-0000-0000-0000000000a2');
  insert into measurements (member_id, measured_on, weight_kg, created_by) values ('00000000-0000-0000-0000-0000000000b1', current_date - 30, 64, auth.uid());
  assert (select count(*) from measurements) = 2, 'il PT legge e aggiunge misure';
end $$;
do $$ begin perform t_as('00000000-0000-0000-0000-0000000000b2'); assert (select count(*) from measurements) = 0; end $$;

-- 7. messaggi e notifiche
do $$ declare pid uuid; begin
  select v into pid from ids where k = 'prog';
  perform t_as('00000000-0000-0000-0000-0000000000b1');
  insert into program_comments (program_id, author_id, body) values (pid, auth.uid(), 'Il giorno B è troppo lungo?');
  assert t_fails(format($q$ insert into program_comments (program_id, author_id, body) values (%L, auth.uid(), '   ') $q$, pid)), 'messaggio vuoto';
  assert t_fails(format($q$ insert into program_comments (program_id, author_id, body) values (%L, '00000000-0000-0000-0000-0000000000a2', 'finto') $q$, pid)), 'non si scrive a nome di altri';
end $$;
do $$ declare pid uuid; begin
  select v into pid from ids where k = 'prog';
  perform t_as('00000000-0000-0000-0000-0000000000b2');
  assert (select count(*) from program_comments) = 0, 'Bob non vede i messaggi';
  assert t_fails(format($q$ insert into program_comments (program_id, author_id, body) values (%L, auth.uid(), 'intruso') $q$, pid)), 'Bob non scrive su una scheda altrui';
end $$;
do $$ declare pid uuid; begin
  select v into pid from ids where k = 'prog';
  perform t_as('00000000-0000-0000-0000-0000000000a2');
  insert into program_comments (program_id, author_id, body) values (pid, auth.uid(), 'Tolgo un esercizio.');
  assert (select count(*) from program_comments) = 2;
end $$;
-- push: token del PT e di Alice, nuovo messaggio dal PT -> avviso ad Alice
insert into push_tokens (token, user_id) values ('ExponentPushToken[pt]', '00000000-0000-0000-0000-0000000000a2'), ('ExponentPushToken[alice]', '00000000-0000-0000-0000-0000000000b1');
do $$ declare pid uuid; begin
  select v into pid from ids where k = 'prog';
  perform t_as('00000000-0000-0000-0000-0000000000a2');
  insert into program_comments (program_id, author_id, body) values (pid, auth.uid(), 'Ci vediamo giovedì.');
end $$;
do $$ begin
  assert (select count(*) from __pushlog) >= 1, 'notifica inviata';
  assert (select body::text from __pushlog order by ctid desc limit 1) like '%ExponentPushToken[alice]%', 'la notifica va ad Alice';
end $$;

-- 8. modelli, copia, nuova scheda attiva (la vecchia va in archivio)
do $$ declare tpl uuid; cp uuid; pid uuid; e1 uuid; begin
  select v into pid from ids where k = 'prog'; select v into e1 from ids where k='e1';
  perform t_as('00000000-0000-0000-0000-0000000000a2');
  tpl := save_program(jsonb_build_object('name','Full body 3 giorni','is_template',true,'weeks',4,'days',jsonb_build_array(
        jsonb_build_object('name','Giorno A','items', jsonb_build_array(jsonb_build_object('exercise_id', e1))))));
  assert (select is_template and member_id is null from programs where id = tpl), 'modello senza socio';
  cp := copy_program(tpl, '00000000-0000-0000-0000-0000000000b1');
  assert (select count(*) from program_items where day_id in (select id from program_days where program_id = cp)) = 1, 'copia con esercizi';
  assert t_fails(format($q$ select copy_program(%L, null, false) $q$, tpl)), 'serve socio o modello';
  perform activate_program(cp);
  assert (select status from programs where id = pid) = 'archived', 'la scheda precedente è archiviata';
  assert (select status from programs where id = cp) = 'active', 'la nuova è attiva';
  assert (select count(*) from programs where member_id = '00000000-0000-0000-0000-0000000000b1' and status = 'active') = 1;
  insert into ids values ('tpl', tpl), ('cp', cp);
end $$;
do $$ begin
  perform t_as('00000000-0000-0000-0000-0000000000b1');
  assert (select count(*) from programs) = 2, 'Alice vede attiva e archiviata (storico)';
  assert (select count(*) from programs where is_template) = 0, 'ma non i modelli';
end $$;

-- 9. staff: elenco soci, statistiche, note riservate
do $$ declare r record; begin
  perform t_as('00000000-0000-0000-0000-0000000000a2');
  assert (select count(*) from members_overview()) = 2, 'due soci in elenco';
  select * into r from members_overview() where full_name = 'Alice Verdi';
  assert r.workouts_30d = 2 and r.program_name = 'Full body 3 giorni' and r.trainer_name = 'Marco Bianchi', 'riga socio';
  assert (gym_stats()->>'members_active')::int = 2, 'statistiche';
  assert (gym_stats()->>'workouts')::int = 2;
  assert (gym_stats()->>'without_program')::int = 1, 'Bob senza scheda';
  insert into staff_notes (member_id, author_id, body) values ('00000000-0000-0000-0000-0000000000b1', auth.uid(), 'Mal di schiena a gennaio, evitare stacchi pesanti.');
end $$;
do $$ begin
  perform t_as('00000000-0000-0000-0000-0000000000b1');
  assert (select count(*) from members_overview()) = 0, 'il socio non vede l''elenco soci';
  assert t_fails($q$ select gym_stats() $q$), 'né le statistiche';
  assert (select count(*) from staff_notes) = 0, 'né le note riservate';
  assert t_fails($q$ select send_push(array[auth.uid()], 'a', 'b') $q$), 'né può inviare notifiche';
end $$;

-- 10. codice palestra
do $$ begin
  assert check_join_code(null), 'registrazione aperta se non c''è codice';
  update gym_settings set join_code = 'FORZA26';
  assert check_join_code('forza26 '), 'codice senza maiuscole e spazi';
  assert not check_join_code('sbagliato') and not check_join_code(null), 'codice sbagliato';
  assert t_fails($q$ insert into auth.users (email, raw_user_meta_data) values ('x@y.it', '{"join_code":"no"}') $q$), 'registrazione bloccata';
  insert into auth.users (email, raw_user_meta_data) values ('ok@y.it', '{"join_code":"FORZA26","first_name":"Ok"}');
  assert (select count(*) from profiles where email = 'ok@y.it') = 1;
  update gym_settings set join_code = null;
end $$;
do $$ begin
  perform t_as('00000000-0000-0000-0000-0000000000b1');
  assert (select count(*) from gym_settings) = 0, 'il socio non legge il codice';
  assert t_fails($q$ update gym_settings set join_code = 'x' $q$) = false;  -- 0 righe
  assert (select join_code from gym_settings) is null;
end $$;

-- 11. eliminazione account
do $$ begin
  perform t_as('00000000-0000-0000-0000-0000000000b1');
  perform delete_my_account();
end $$;
do $$ begin
  assert (select count(*) from profiles where id = '00000000-0000-0000-0000-0000000000b1') = 0, 'profilo eliminato';
  assert (select count(*) from workouts where member_id = '00000000-0000-0000-0000-0000000000b1') = 0, 'e i suoi allenamenti';
  assert (select count(*) from programs where member_id = '00000000-0000-0000-0000-0000000000b1') = 0, 'e le sue schede';
  assert (select count(*) from program_comments) = 0, 'e i messaggi legati alle sue schede';
  assert (select count(*) from exercises) >= 70, 'il catalogo resta';
end $$;
do $$ begin
  perform t_as('00000000-0000-0000-0000-0000000000a1');
  assert t_fails($q$ select delete_my_account() $q$), 'l''ultimo titolare non si elimina';
end $$;

\echo 'TUTTI I TEST SUPERATI'
