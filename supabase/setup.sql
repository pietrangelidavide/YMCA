-- YMCA Prime Training: setup completo del database Supabase (versione 1.1)
-- FILE GENERATO da scripts/build-setup.cjs (base_1_0.sql + update_1_1.sql): non modificarlo a mano.
-- Per un progetto Supabase NUOVO e vuoto (regione UE, per i dati dei soci): incolla tutto nel SQL Editor ed esegui una volta.
-- Chi ha già eseguito la versione 1.0 non deve rifarlo: gli basta supabase/update_1_1.sql.
-- In fondo: i passaggi da fare dopo (titolare, codice palestra).

create type user_role as enum ('member', 'trainer', 'owner');
create type program_status as enum ('draft', 'active', 'archived');

-- ───────── Tabelle ─────────

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  full_name text generated always as (btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) stored,
  phone text,
  email text,
  role user_role not null default 'member',
  trainer_id uuid references profiles(id) on delete set null,   -- il PT di riferimento del socio
  goal text,                                                   -- obiettivo dichiarato dal socio
  height_cm int check (height_cm is null or height_cm between 100 and 250),
  active boolean not null default true,                         -- false = socio non più attivo (nascosto dagli elenchi)
  created_at timestamptz not null default now()
);
create index on profiles (role, active);
create index on profiles (trainer_id);

-- Impostazioni della palestra (una sola riga). join_code: se compilato, chi si registra deve inserirlo.
create table gym_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'La tua palestra',
  join_code text
);
insert into gym_settings (id) values (1);

-- Catalogo esercizi. Non si cancella un esercizio già usato: lo si disattiva (active = false).
create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text not null check (muscle_group in
    ('petto','schiena','spalle','bicipiti','tricipiti','gambe','glutei','polpacci','addome','cardio','total_body','mobilita')),
  equipment text,
  description text,
  video_url text,        -- link a un video (YouTube non in elenco, Vimeo...) che si apre dall'app
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index exercises_name_uq on exercises (lower(name));
create index on exercises (muscle_group) where active;

-- Schede. member_id nullo + is_template = modello riutilizzabile.
create table programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text,
  member_id uuid references profiles(id) on delete cascade,
  trainer_id uuid references profiles(id) on delete set null,
  status program_status not null default 'draft',
  is_template boolean not null default false,
  starts_on date,
  weeks int not null default 4 check (weeks between 1 and 52),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_template and member_id is null) or (not is_template and member_id is not null))
);
create unique index programs_one_active on programs (member_id) where status = 'active';   -- una sola scheda attiva per socio
create index on programs (member_id, status);
create index on programs (is_template) where is_template;

create table program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  position int not null,
  name text not null,          -- "Giorno A"
  focus text                   -- "Petto e tricipiti"
);
create index on program_days (program_id, position);

create table program_items (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references program_days(id) on delete cascade,
  position int not null,
  exercise_id uuid not null references exercises(id),
  sets int not null default 3 check (sets between 1 and 30),
  reps text not null default '10',      -- "10", "8-10", "30 sec", "12 minuti"
  load_hint text,                       -- "20 kg", "70%", "RPE 8"
  rest_sec int not null default 60 check (rest_sec between 0 and 900),
  tempo text,                           -- "3-1-1"
  note text,
  superset text                         -- stessa lettera = esercizi in superserie
);
create index on program_items (day_id, position);

-- Allenamenti svolti dai soci (uno per sessione) e relative serie.
create table workouts (
  id uuid primary key,                  -- generato dall'app: se l'invio si ripete non si crea un doppione
  member_id uuid not null references profiles(id) on delete cascade,
  program_id uuid references programs(id) on delete set null,
  day_id uuid references program_days(id) on delete set null,
  day_name text,                        -- copia del nome del giorno, resta anche se la scheda cambia
  started_at timestamptz not null,
  finished_at timestamptz,
  note text,
  rpe int check (rpe is null or rpe between 1 and 10),
  created_at timestamptz not null default now()
);
create index on workouts (member_id, started_at desc);

create table set_logs (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  item_id uuid references program_items(id) on delete set null,
  set_no int not null check (set_no > 0),
  reps int check (reps is null or reps between 0 and 500),
  weight_kg numeric(6,2) check (weight_kg is null or weight_kg between 0 and 1000),
  created_at timestamptz not null default now()
);
create index on set_logs (member_id, exercise_id, created_at desc);
create index on set_logs (workout_id);

create table measurements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5,2) check (weight_kg is null or weight_kg between 20 and 400),
  body_fat_pct numeric(4,1) check (body_fat_pct is null or body_fat_pct between 2 and 70),
  waist_cm numeric(5,1),
  chest_cm numeric(5,1),
  hips_cm numeric(5,1),
  arm_cm numeric(5,1),
  thigh_cm numeric(5,1),
  note text,
  created_by uuid references profiles(id) on delete set null,
  unique (member_id, measured_on)
);

-- Messaggi tra socio e PT, uno per scheda
create table program_comments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null check (length(btrim(body)) > 0 and length(body) <= 2000),
  created_at timestamptz not null default now()
);
create index on program_comments (program_id, created_at);

-- Note riservate allo staff sul socio (il socio non le vede)
create table staff_notes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);
create index on staff_notes (member_id, created_at desc);

-- Token dei dispositivi per le notifiche push
create table push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);

-- ───────── Funzioni di supporto per i permessi ─────────

create function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('trainer', 'owner') from profiles where id = auth.uid()), false)
$$;

create function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'owner' from profiles where id = auth.uid()), false)
$$;

-- Nomi dello staff (PT e titolare), visibili a tutti i soci: servono per mostrare chi ha scritto una scheda o un messaggio
create function staff_directory() returns table (id uuid, full_name text, role user_role)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.role from profiles p where p.role in ('trainer', 'owner') and auth.uid() is not null
$$;

-- Lo staff vede tutte le schede; il socio solo le proprie, e non le bozze
create function can_see_program(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from programs p
    where p.id = p_id and (is_staff() or (p.member_id = auth.uid() and p.status <> 'draft'))
  )
$$;

-- ───────── Profilo creato alla registrazione ─────────

create function check_join_code(p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(join_code), ''), '') = '' or lower(btrim(join_code)) = lower(btrim(coalesce(p_code, '')))
  from gym_settings where id = 1
$$;
grant execute on function check_join_code(text) to anon, authenticated;

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not check_join_code(new.raw_user_meta_data->>'join_code') then
    raise exception 'codice_palestra_non_valido';
  end if;
  insert into profiles (id, first_name, last_name, phone, email)
  values (new.id, nullif(btrim(new.raw_user_meta_data->>'first_name'), ''), nullif(btrim(new.raw_user_meta_data->>'last_name'), ''),
          nullif(btrim(new.raw_user_meta_data->>'phone'), ''), new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Ruolo, PT di riferimento e stato "attivo" li cambia solo lo staff (il ruolo solo il titolare).
-- Dal SQL Editor (auth.uid() nullo) tutto è consentito: serve per nominare il primo titolare.
create function profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.role is distinct from old.role and not is_owner() then
    raise exception 'solo il titolare può cambiare i ruoli';
  end if;
  if (new.trainer_id is distinct from old.trainer_id or new.active is distinct from old.active) and not is_staff() then
    raise exception 'operazione riservata allo staff';
  end if;
  new.id := old.id; new.created_at := old.created_at; new.email := old.email;
  return new;
end $$;

create trigger profiles_guard before update on profiles
  for each row execute function profiles_guard();

create function touch_program() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger programs_touch before update on programs for each row execute function touch_program();

-- ───────── Permessi (RLS) ─────────

alter table profiles enable row level security;
alter table gym_settings enable row level security;
alter table exercises enable row level security;
alter table programs enable row level security;
alter table program_days enable row level security;
alter table program_items enable row level security;
alter table workouts enable row level security;
alter table set_logs enable row level security;
alter table measurements enable row level security;
alter table program_comments enable row level security;
alter table staff_notes enable row level security;
alter table push_tokens enable row level security;   -- nessuna policy: si scrive solo con register_push_token

create policy "profilo: il socio vede se stesso, lo staff tutti" on profiles for select
  using (id = auth.uid() or is_staff());
create policy "profilo: ognuno modifica il proprio, lo staff quelli dei soci" on profiles for update
  using (id = auth.uid() or is_staff()) with check (id = auth.uid() or is_staff());

create policy "palestra: solo staff" on gym_settings for select using (is_staff());
create policy "palestra: modifica titolare" on gym_settings for update using (is_owner()) with check (is_owner());

create policy "esercizi: tutti leggono" on exercises for select using (auth.uid() is not null);
create policy "esercizi: staff scrive" on exercises for insert with check (is_staff());
create policy "esercizi: staff modifica" on exercises for update using (is_staff()) with check (is_staff());

create policy "schede: lettura" on programs for select using (can_see_program(id));
create policy "schede: staff scrive" on programs for insert with check (is_staff());
create policy "schede: staff modifica" on programs for update using (is_staff()) with check (is_staff());
create policy "schede: staff elimina" on programs for delete using (is_staff());

create policy "giorni: lettura" on program_days for select using (can_see_program(program_id));
create policy "giorni: staff" on program_days for all using (is_staff()) with check (is_staff());

create policy "voci: lettura" on program_items for select
  using (can_see_program((select d.program_id from program_days d where d.id = day_id)));
create policy "voci: staff" on program_items for all using (is_staff()) with check (is_staff());

create policy "allenamenti: socio e staff leggono" on workouts for select using (member_id = auth.uid() or is_staff());
create policy "allenamenti: il socio inserisce i propri" on workouts for insert with check (member_id = auth.uid());
create policy "allenamenti: il socio corregge i propri" on workouts for update using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy "allenamenti: il socio elimina i propri" on workouts for delete using (member_id = auth.uid());

create policy "serie: socio e staff leggono" on set_logs for select using (member_id = auth.uid() or is_staff());
create policy "serie: il socio inserisce le proprie" on set_logs for insert with check (member_id = auth.uid());
create policy "serie: il socio corregge le proprie" on set_logs for update using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy "serie: il socio elimina le proprie" on set_logs for delete using (member_id = auth.uid());

create policy "misure: socio e staff leggono" on measurements for select using (member_id = auth.uid() or is_staff());
create policy "misure: socio e staff inseriscono" on measurements for insert with check (member_id = auth.uid() or is_staff());
create policy "misure: socio e staff correggono" on measurements for update using (member_id = auth.uid() or is_staff()) with check (member_id = auth.uid() or is_staff());
create policy "misure: socio e staff eliminano" on measurements for delete using (member_id = auth.uid() or is_staff());

create policy "messaggi: lettura" on program_comments for select using (can_see_program(program_id));
create policy "messaggi: scrive chi vede la scheda" on program_comments for insert
  with check (author_id = auth.uid() and can_see_program(program_id));

create policy "note staff: solo staff" on staff_notes for all using (is_staff()) with check (is_staff() and author_id = auth.uid());

-- ───────── Schede: lettura e salvataggio in una sola chiamata ─────────

-- Scheda completa (giorni, esercizi con i loro dati) come un unico JSON
create function program_json(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not can_see_program(p_id) then return null; end if;
  select to_jsonb(p) || jsonb_build_object('days', coalesce((
    select jsonb_agg(to_jsonb(d) || jsonb_build_object('items', coalesce((
      select jsonb_agg(to_jsonb(i) || jsonb_build_object('exercise', jsonb_build_object(
        'id', e.id, 'name', e.name, 'muscle_group', e.muscle_group, 'equipment', e.equipment,
        'description', e.description, 'video_url', e.video_url, 'image_url', e.image_url)) order by i.position)
      from program_items i join exercises e on e.id = i.exercise_id where i.day_id = d.id), '[]'::jsonb)) order by d.position)
    from program_days d where d.program_id = p.id), '[]'::jsonb))
  into v from programs p where p.id = p_id;
  return v;
end $$;

create function my_active_program() returns jsonb
language sql stable security definer set search_path = public as $$
  select program_json(id) from programs where member_id = auth.uid() and status = 'active' limit 1
$$;

-- Crea o aggiorna una scheda con tutti i suoi giorni ed esercizi.
-- Giorni ed esercizi con id vengono aggiornati, quelli senza id creati, quelli non più presenti eliminati.
-- Lo storico degli allenamenti non si perde: le serie restano legate all'esercizio, non alla riga della scheda.
create function save_program(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  d jsonb; it jsonb;
  v_day uuid; v_item uuid;
  di int := 0; ii int;
  keep_days uuid[] := '{}'; keep_items uuid[] := '{}';
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if btrim(coalesce(p->>'name', '')) = '' then raise exception 'name_required'; end if;

  if v_id is null then
    insert into programs (name, goal, member_id, trainer_id, is_template, starts_on, weeks, notes)
    values (btrim(p->>'name'), nullif(btrim(p->>'goal'), ''), nullif(p->>'member_id', '')::uuid, auth.uid(),
            coalesce((p->>'is_template')::boolean, false), nullif(p->>'starts_on', '')::date,
            coalesce(nullif(p->>'weeks', '')::int, 4), nullif(btrim(p->>'notes'), ''))
    returning id into v_id;
  else
    update programs set name = btrim(p->>'name'), goal = nullif(btrim(p->>'goal'), ''),
      starts_on = nullif(p->>'starts_on', '')::date, weeks = coalesce(nullif(p->>'weeks', '')::int, weeks),
      notes = nullif(btrim(p->>'notes'), '')
    where id = v_id;
    if not found then raise exception 'not_found'; end if;
  end if;

  for d in select * from jsonb_array_elements(coalesce(p->'days', '[]'::jsonb)) loop
    di := di + 1;
    v_day := nullif(d->>'id', '')::uuid;
    if v_day is not null and exists (select 1 from program_days where id = v_day and program_id = v_id) then
      update program_days set position = di, name = coalesce(nullif(btrim(d->>'name'), ''), 'Giorno ' || di), focus = nullif(btrim(d->>'focus'), '')
      where id = v_day;
    else
      insert into program_days (program_id, position, name, focus)
      values (v_id, di, coalesce(nullif(btrim(d->>'name'), ''), 'Giorno ' || di), nullif(btrim(d->>'focus'), ''))
      returning id into v_day;
    end if;
    keep_days := keep_days || v_day;

    ii := 0;
    for it in select * from jsonb_array_elements(coalesce(d->'items', '[]'::jsonb)) loop
      ii := ii + 1;
      v_item := nullif(it->>'id', '')::uuid;
      if v_item is not null and exists (
        select 1 from program_items pi join program_days pd on pd.id = pi.day_id where pi.id = v_item and pd.program_id = v_id
      ) then
        update program_items set day_id = v_day, position = ii, exercise_id = (it->>'exercise_id')::uuid,
          sets = coalesce(nullif(it->>'sets', '')::int, 3), reps = coalesce(nullif(btrim(it->>'reps'), ''), '10'),
          load_hint = nullif(btrim(it->>'load_hint'), ''), rest_sec = coalesce(nullif(it->>'rest_sec', '')::int, 60),
          tempo = nullif(btrim(it->>'tempo'), ''), note = nullif(btrim(it->>'note'), ''), superset = nullif(btrim(it->>'superset'), '')
        where id = v_item;
      else
        insert into program_items (day_id, position, exercise_id, sets, reps, load_hint, rest_sec, tempo, note, superset)
        values (v_day, ii, (it->>'exercise_id')::uuid, coalesce(nullif(it->>'sets', '')::int, 3),
                coalesce(nullif(btrim(it->>'reps'), ''), '10'), nullif(btrim(it->>'load_hint'), ''),
                coalesce(nullif(it->>'rest_sec', '')::int, 60), nullif(btrim(it->>'tempo'), ''),
                nullif(btrim(it->>'note'), ''), nullif(btrim(it->>'superset'), ''))
        returning id into v_item;
      end if;
      keep_items := keep_items || v_item;
    end loop;
  end loop;

  delete from program_items where day_id in (select id from program_days where program_id = v_id) and id <> all (keep_items);
  delete from program_days where program_id = v_id and id <> all (keep_days);
  return v_id;
end $$;

-- Copia una scheda (o un modello) per un socio oppure come nuovo modello. La copia nasce in bozza.
create function copy_program(p_source uuid, p_member uuid, p_as_template boolean default false, p_name text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_new uuid; v_day uuid; d record;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if (p_member is null) = (not coalesce(p_as_template, false)) then
    raise exception 'serve un socio oppure is_template';
  end if;

  insert into programs (name, goal, member_id, trainer_id, is_template, weeks, notes)
  select coalesce(nullif(btrim(p_name), ''), s.name), s.goal, p_member, auth.uid(), coalesce(p_as_template, false), s.weeks, s.notes
  from programs s where s.id = p_source
  returning id into v_new;
  if v_new is null then raise exception 'not_found'; end if;

  for d in select * from program_days where program_id = p_source order by position loop
    insert into program_days (program_id, position, name, focus) values (v_new, d.position, d.name, d.focus) returning id into v_day;
    insert into program_items (day_id, position, exercise_id, sets, reps, load_hint, rest_sec, tempo, note, superset)
    select v_day, position, exercise_id, sets, reps, load_hint, rest_sec, tempo, note, superset
    from program_items where day_id = d.id;
  end loop;
  return v_new;
end $$;

-- Rende attiva una scheda del socio: la precedente va in archivio
create function activate_program(p_id uuid, p_starts_on date default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_member uuid;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select member_id into v_member from programs where id = p_id and not is_template;
  if v_member is null then raise exception 'not_found'; end if;
  update programs set status = 'archived' where member_id = v_member and status = 'active' and id <> p_id;
  update programs set status = 'active', starts_on = coalesce(p_starts_on, starts_on, current_date) where id = p_id;
end $$;

create function archive_program(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  update programs set status = 'archived' where id = p_id and not is_template;
end $$;

-- ───────── Allenamenti: un solo invio a fine sessione ─────────

-- p = { id, program_id, day_id, day_name, started_at, finished_at, note, rpe, sets: [{ exercise_id, item_id, set_no, reps, weight_kg }] }
-- Se lo stesso allenamento arriva due volte (rete instabile) il secondo invio non fa nulla.
create function save_workout(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := (p->>'id')::uuid; v_rows int;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  insert into workouts (id, member_id, program_id, day_id, day_name, started_at, finished_at, note, rpe)
  values (v_id, auth.uid(),
          (select id from programs where id = nullif(p->>'program_id', '')::uuid and member_id = auth.uid()),
          (select pd.id from program_days pd join programs pr on pr.id = pd.program_id
            where pd.id = nullif(p->>'day_id', '')::uuid and pr.member_id = auth.uid()),
          nullif(btrim(p->>'day_name'), ''), (p->>'started_at')::timestamptz, nullif(p->>'finished_at', '')::timestamptz,
          nullif(btrim(p->>'note'), ''), nullif(p->>'rpe', '')::int)
  on conflict (id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return v_id; end if;

  insert into set_logs (workout_id, member_id, exercise_id, item_id, set_no, reps, weight_kg)
  select v_id, auth.uid(), (s->>'exercise_id')::uuid,
         (select pi.id from program_items pi where pi.id = nullif(s->>'item_id', '')::uuid),
         (s->>'set_no')::int, nullif(s->>'reps', '')::int, nullif(s->>'weight_kg', '')::numeric
  from jsonb_array_elements(coalesce(p->'sets', '[]'::jsonb)) s;
  return v_id;
end $$;

-- Serie dell'ultimo allenamento per ciascun esercizio: l'app le mostra come riferimento e le propone come valori di partenza
create function last_sets(p_exercises uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('exercise_id', s.exercise_id, 'set_no', s.set_no, 'reps', s.reps, 'weight_kg', s.weight_kg, 'at', w.started_at)
                            order by s.exercise_id, s.set_no), '[]'::jsonb)
  from set_logs s join workouts w on w.id = s.workout_id
  where s.member_id = auth.uid() and s.exercise_id = any (p_exercises)
    and s.workout_id = (select s2.workout_id from set_logs s2 join workouts w2 on w2.id = s2.workout_id
                        where s2.member_id = auth.uid() and s2.exercise_id = s.exercise_id
                        order by w2.started_at desc limit 1)
$$;

-- Andamento per esercizio: ultime 12 sedute (carico massimo e ripetizioni), record e 1RM stimato (formula di Epley)
create function progress_summary(p_member uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_m uuid := coalesce(p_member, auth.uid()); v jsonb;
begin
  if v_m is distinct from auth.uid() and not is_staff() then raise exception 'forbidden'; end if;
  with per as (
    select s.exercise_id, s.workout_id, w.started_at,
           max(coalesce(s.weight_kg, 0)) as best_w,
           (array_agg(s.reps order by coalesce(s.weight_kg, 0) desc, s.reps desc))[1] as reps_at_best,
           max(coalesce(s.weight_kg, 0) * (1 + s.reps / 30.0)) as e1rm
    from set_logs s join workouts w on w.id = s.workout_id
    where s.member_id = v_m and s.reps > 0
    group by s.exercise_id, s.workout_id, w.started_at
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.last_at desc), '[]'::jsonb) into v
  from (
    select e.id as exercise_id, e.name, e.muscle_group, count(*)::int as sessions, max(p.started_at) as last_at,
           max(p.best_w) as pr_weight, round(max(p.e1rm), 1) as pr_e1rm,
           (select jsonb_agg(jsonb_build_object('at', r.started_at, 'w', r.best_w, 'reps', r.reps_at_best) order by r.started_at)
            from (select * from per p2 where p2.exercise_id = e.id order by p2.started_at desc limit 12) r) as series
    from per p join exercises e on e.id = p.exercise_id
    group by e.id, e.name, e.muscle_group
  ) x;
  return v;
end $$;

-- ───────── Staff: elenco soci e numeri della palestra ─────────

create function members_overview() returns table (
  id uuid, full_name text, phone text, email text, active boolean, goal text,
  trainer_id uuid, trainer_name text,
  program_id uuid, program_name text, program_ends_on date,
  last_workout_at timestamptz, workouts_30d int, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select m.id, m.full_name, m.phone, m.email, m.active, m.goal, m.trainer_id, t.full_name,
         p.id, p.name, case when p.starts_on is not null then p.starts_on + p.weeks * 7 end,
         lw.last_at, lw.n30::int, m.created_at
  from profiles m
  left join profiles t on t.id = m.trainer_id
  left join programs p on p.member_id = m.id and p.status = 'active'
  left join lateral (
    select max(w.started_at) as last_at, count(*) filter (where w.started_at > now() - interval '30 days') as n30
    from workouts w where w.member_id = m.id
  ) lw on true
  where is_staff() and m.role = 'member'
  order by m.full_name
$$;

create function gym_stats(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'members_active', (select count(*) from profiles where role = 'member' and active),
    'members_new', (select count(*) from profiles where role = 'member' and created_at > now() - make_interval(days => p_days)),
    'members_training', (select count(distinct member_id) from workouts where started_at > now() - make_interval(days => p_days)),
    'workouts', (select count(*) from workouts where started_at > now() - make_interval(days => p_days)),
    'without_program', (select count(*) from profiles m where m.role = 'member' and m.active
                        and not exists (select 1 from programs p where p.member_id = m.id and p.status = 'active')),
    'expiring', (select count(*) from programs p where p.status = 'active' and p.starts_on is not null
                 and p.starts_on + p.weeks * 7 <= current_date + 7),
    'weekly', (select coalesce(jsonb_agg(jsonb_build_object('week', w.wk, 'workouts', w.n) order by w.wk), '[]'::jsonb)
               from (select date_trunc('week', started_at)::date as wk, count(*) as n
                     from workouts where started_at > now() - interval '8 weeks' group by 1) w),
    'trainers', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.full_name, 'members', t.n) order by t.n desc), '[]'::jsonb)
                 from (select tr.id, tr.full_name, (select count(*) from profiles m where m.trainer_id = tr.id and m.active) as n
                       from profiles tr where tr.role in ('trainer', 'owner')) t)
  ) into v;
  return v;
end $$;

-- ───────── Notifiche push e account ─────────

create function register_push_token(p_token text, p_platform text) returns void
language sql security definer set search_path = public as $$
  insert into push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now()
$$;

-- Eliminazione account (richiesta da Apple): cancella il profilo e tutti i dati del socio
create function delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if (select role from profiles where id = auth.uid()) = 'owner'
     and (select count(*) from profiles where role = 'owner') = 1 then
    raise exception 'owner_required';   -- l'ultimo titolare non può eliminarsi
  end if;
  delete from auth.users where id = auth.uid();
end $$;

-- Avvisi al socio (nuova scheda, messaggio del PT) e al PT (messaggio del socio).
-- Non bloccano mai l'operazione che li ha generati.
create extension if not exists pg_net;

create function send_push(p_users uuid[], p_title text, p_body text, p_data jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_msgs jsonb;
begin
  select jsonb_agg(jsonb_build_object('to', token, 'sound', 'default', 'title', p_title, 'body', p_body, 'data', p_data))
  into v_msgs from push_tokens where user_id = any (p_users);
  if v_msgs is null then return; end if;
  perform net.http_post(url := 'https://exp.host/--/api/v2/push/send', body := v_msgs);
exception when others then
  null;
end $$;
revoke execute on function send_push(uuid[], text, text, jsonb) from public, anon, authenticated;

create function notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_member uuid; v_trainer uuid; v_name text;
begin
  select pr.member_id, coalesce(pr.trainer_id, m.trainer_id), a.first_name
    into v_member, v_trainer, v_name
  from programs pr
  left join profiles m on m.id = pr.member_id
  left join profiles a on a.id = new.author_id
  where pr.id = new.program_id;
  if v_member is null then return new; end if;
  if new.author_id = v_member then
    if v_trainer is not null then
      perform send_push(array[v_trainer], coalesce(v_name, 'Un socio'), left(new.body, 120), jsonb_build_object('type', 'comment', 'programId', new.program_id));
    end if;
  else
    perform send_push(array[v_member], coalesce(v_name, 'Il tuo PT'), left(new.body, 120), jsonb_build_object('type', 'comment', 'programId', new.program_id));
  end if;
  return new;
exception when others then
  return new;
end $$;
create trigger program_comments_notify after insert on program_comments
  for each row execute function notify_comment();

create function notify_program_active() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' and new.member_id is not null then
    perform send_push(array[new.member_id], 'Nuova scheda', new.name, jsonb_build_object('type', 'program', 'programId', new.id));
  end if;
  return new;
exception when others then
  return new;
end $$;
create trigger programs_notify after update of status on programs
  for each row execute function notify_program_active();

-- ───────── Esercizi di partenza ─────────
-- 73 esercizi comuni. Il PT può modificarli, aggiungere il link a un video e crearne di nuovi dall'app.
insert into exercises (name, muscle_group, equipment, description) values
  ('Panca piana con bilanciere', 'petto', 'bilanciere', 'Sdraiato sulla panca, scapole addotte e piedi a terra. Scendi con controllo fino al petto e spingi fino a braccia quasi distese.'),
  ('Panca piana con manubri', 'petto', 'manubri', 'Come la panca col bilanciere ma con i manubri: maggiore escursione, i gomiti restano a circa 45° dal busto.'),
  ('Panca inclinata con manubri', 'petto', 'manubri', 'Panca a 30°. Spingi i manubri in alto avvicinandoli senza farli battere; scendi fino a sentire lo stiramento dei pettorali.'),
  ('Chest press', 'petto', 'macchina', 'Schiena aderente allo schienale, impugnature all''altezza del petto. Spingi in avanti senza staccare le spalle.'),
  ('Croci ai cavi', 'petto', 'cavi', 'Braccia leggermente flesse, porta le mani davanti al petto stringendo i pettorali; torna lentamente.'),
  ('Croci con manubri su panca', 'petto', 'manubri', 'Apri le braccia ad arco con i gomiti morbidi fino allo stiramento, poi richiudi come per abbracciare.'),
  ('Piegamenti sulle braccia', 'petto', 'corpo libero', 'Corpo in linea dalla testa ai talloni, addome contratto. Scendi con il petto verso il pavimento e risali.'),
  ('Dip alle parallele', 'petto', 'corpo libero', 'Busto leggermente in avanti per coinvolgere il petto. Scendi finché le spalle sono all''altezza dei gomiti.'),
  ('Lat machine presa larga', 'schiena', 'macchina', 'Tira la barra al petto portando i gomiti verso i fianchi, petto in fuori, senza dondolare con il busto.'),
  ('Lat machine presa stretta', 'schiena', 'macchina', 'Presa neutra o stretta: tira verso lo sterno tenendo i gomiti vicini al corpo.'),
  ('Trazioni alla sbarra', 'schiena', 'corpo libero', 'Parti a braccia distese, porta il mento sopra la sbarra guidando con i gomiti. Scendi in modo controllato.'),
  ('Rematore con bilanciere', 'schiena', 'bilanciere', 'Busto inclinato a circa 45°, schiena neutra. Porta la barra verso l''ombelico stringendo le scapole.'),
  ('Rematore con manubrio', 'schiena', 'manubri', 'Un ginocchio e una mano sulla panca. Tira il manubrio verso l''anca, gomito vicino al corpo.'),
  ('Pulley basso', 'schiena', 'cavi', 'Seduto, busto fermo. Tira l''impugnatura verso l''addome portando indietro i gomiti e stringendo le scapole.'),
  ('Pulldown a braccia tese', 'schiena', 'cavi', 'Braccia quasi distese, abbassa la barra fino alle cosce usando i dorsali, senza piegare i gomiti.'),
  ('Stacco da terra', 'schiena', 'bilanciere', 'Barra vicino alle tibie, schiena neutra. Spingi il pavimento con le gambe e distendi le anche fino alla posizione eretta.'),
  ('Iperestensioni', 'schiena', 'panca', 'Sulla panca a 45°, scendi con la schiena neutra e risali fino ad allineare il corpo, senza iperestendere.'),
  ('Lento avanti con manubri', 'spalle', 'manubri', 'Da seduto o in piedi, spingi i manubri sopra la testa senza inarcare la schiena; scendi fino all''altezza delle orecchie.'),
  ('Military press con bilanciere', 'spalle', 'bilanciere', 'In piedi, glutei e addome contratti. Spingi la barra sopra la testa passando vicino al viso.'),
  ('Alzate laterali', 'spalle', 'manubri', 'Gomiti leggermente flessi, alza i manubri di lato fino all''altezza delle spalle e scendi lentamente.'),
  ('Alzate frontali', 'spalle', 'manubri', 'Alza i manubri davanti a te fino all''altezza delle spalle, senza usare lo slancio.'),
  ('Alzate posteriori', 'spalle', 'manubri', 'Busto inclinato in avanti, apri le braccia di lato stringendo le scapole per lavorare sui deltoidi posteriori.'),
  ('Face pull', 'spalle', 'cavi', 'Cavo all''altezza del viso, tira la corda verso la fronte aprendo i gomiti. Ottimo per la postura delle spalle.'),
  ('Scrollate con manubri', 'spalle', 'manubri', 'Braccia lungo i fianchi, alza le spalle verso le orecchie e fai una breve pausa in alto.'),
  ('Curl con bilanciere', 'bicipiti', 'bilanciere', 'Gomiti fermi lungo i fianchi, porta la barra verso le spalle e scendi lentamente.'),
  ('Curl con manubri alternato', 'bicipiti', 'manubri', 'Ruota il polso verso l''alto durante la salita; alterna le braccia senza dondolare.'),
  ('Curl a martello', 'bicipiti', 'manubri', 'Presa neutra (pollici in alto): lavora anche sull''avambraccio e sul brachiale.'),
  ('Curl ai cavi', 'bicipiti', 'cavi', 'Tensione continua dal basso: porta l''impugnatura alle spalle con i gomiti fermi.'),
  ('Curl alla panca Scott', 'bicipiti', 'bilanciere', 'Braccia appoggiate al cuscino: isola il bicipite, scendi fino quasi a distendere il gomito.'),
  ('French press con bilanciere EZ', 'tricipiti', 'bilanciere', 'Sdraiato, porta la barra verso la fronte piegando solo i gomiti, poi distendi.'),
  ('Push down ai cavi', 'tricipiti', 'cavi', 'Gomiti attaccati ai fianchi, spingi la barra o la corda verso il basso fino alla distensione completa.'),
  ('Estensioni sopra la testa con manubrio', 'tricipiti', 'manubri', 'Manubrio dietro la testa, gomiti stretti: distendi le braccia verso l''alto.'),
  ('Panca presa stretta', 'tricipiti', 'bilanciere', 'Mani poco più strette delle spalle, gomiti vicini al busto: spingi con i tricipiti.'),
  ('Kickback con manubrio', 'tricipiti', 'manubri', 'Busto inclinato, gomito alto e fermo: distendi l''avambraccio all''indietro.'),
  ('Squat con bilanciere', 'gambe', 'bilanciere', 'Barra sui trapezi, piedi larghi come le spalle. Scendi con le anche indietro fino almeno al parallelo, ginocchia in linea con i piedi.'),
  ('Goblet squat', 'gambe', 'manubri', 'Un manubrio o kettlebell davanti al petto: scendi in squat tenendo il busto eretto. Ideale per imparare il movimento.'),
  ('Squat al multipower', 'gambe', 'macchina', 'Piedi leggermente avanti rispetto alla barra, scendi con controllo e spingi sui talloni.'),
  ('Leg press', 'gambe', 'macchina', 'Schiena e glutei aderenti allo schienale. Scendi finché le ginocchia sono a circa 90° senza staccare il bacino.'),
  ('Hack squat', 'gambe', 'macchina', 'Schiena sul supporto, piedi a metà pedana: scendi con controllo e spingi con tutto il piede.'),
  ('Affondi con manubri', 'gambe', 'manubri', 'Passo lungo in avanti o indietro, busto eretto: ginocchio posteriore vicino al pavimento, spingi sul tallone.'),
  ('Affondi bulgari', 'gambe', 'manubri', 'Piede posteriore appoggiato su una panca: scendi con il ginocchio anteriore in linea con il piede.'),
  ('Step-up su panca', 'gambe', 'manubri', 'Sali su una panca spingendo con la gamba di appoggio, senza darti slancio con l''altra.'),
  ('Leg extension', 'gambe', 'macchina', 'Distendi le ginocchia contraendo i quadricipiti, pausa in alto e discesa lenta.'),
  ('Leg curl sdraiato', 'gambe', 'macchina', 'Porta i talloni verso i glutei senza sollevare il bacino; scendi lentamente.'),
  ('Stacco rumeno', 'gambe', 'bilanciere', 'Ginocchia appena flesse, spingi il bacino indietro facendo scendere la barra lungo le gambe fino a sentire i femorali.'),
  ('Hip thrust', 'glutei', 'bilanciere', 'Schiena alta su una panca, barra sulle anche: spingi il bacino in alto contraendo i glutei, mento verso il petto.'),
  ('Ponte glutei', 'glutei', 'corpo libero', 'Sdraiato, piedi vicini ai glutei: solleva il bacino fino ad allineare ginocchia, anche e spalle.'),
  ('Abduzioni alla macchina', 'glutei', 'macchina', 'Seduto, apri le gambe contro la resistenza senza spostare il busto.'),
  ('Kickback glutei ai cavi', 'glutei', 'cavi', 'Cavigliera ai cavi: porta la gamba indietro contraendo il gluteo, senza inarcare la schiena.'),
  ('Calf in piedi', 'polpacci', 'macchina', 'Sali sulle punte il più possibile, pausa in alto e discesa completa fino allo stiramento.'),
  ('Calf seduto', 'polpacci', 'macchina', 'Ginocchia a 90°: lavora sul soleo con salite lente e discesa completa.'),
  ('Crunch', 'addome', 'corpo libero', 'Sdraiato, solleva spalle e scapole dal pavimento contraendo l''addome; non tirare il collo con le mani.'),
  ('Crunch ai cavi', 'addome', 'cavi', 'In ginocchio, corda dietro la testa: arrotola il busto verso il bacino contraendo l''addome.'),
  ('Plank', 'addome', 'corpo libero', 'Appoggio sugli avambracci, corpo in linea, glutei e addome contratti. Tenuta isometrica: indica i secondi nelle ripetizioni.'),
  ('Plank laterale', 'addome', 'corpo libero', 'Appoggio su un avambraccio, anche alte e corpo in linea. Tieni la posizione e cambia lato.'),
  ('Sollevamento gambe alla sbarra', 'addome', 'corpo libero', 'Appeso alla sbarra, porta le gambe verso l''alto arrotolando il bacino, senza dondolare.'),
  ('Russian twist', 'addome', 'palla medica', 'Seduto con busto inclinato e piedi sollevati, ruota il busto da lato a lato con un peso tra le mani.'),
  ('Ab wheel', 'addome', 'ruota', 'In ginocchio, fai rotolare la ruota in avanti mantenendo la schiena neutra e torna con l''addome.'),
  ('Mountain climber', 'addome', 'corpo libero', 'In appoggio come per un piegamento, porta alternativamente le ginocchia al petto a ritmo sostenuto.'),
  ('Tapis roulant', 'cardio', 'tapis roulant', 'Camminata o corsa a velocità e pendenza indicate dal programma. Indica i minuti nelle ripetizioni.'),
  ('Cyclette', 'cardio', 'cyclette', 'Pedalata a intensità costante o a intervalli, come da programma.'),
  ('Ellittica', 'cardio', 'ellittica', 'Movimento fluido a basso impatto; mantieni il busto eretto e l''intensità indicata.'),
  ('Vogatore', 'cardio', 'vogatore', 'Spingi con le gambe, poi tira con il busto e le braccia; ritorna in ordine inverso.'),
  ('Corda per saltare', 'cardio', 'corda', 'Salti leggeri sull''avampiede, polsi che ruotano la corda, ritmo regolare.'),
  ('Kettlebell swing', 'total_body', 'kettlebell', 'Spingi le anche indietro e poi in avanti con forza: la kettlebell sale per la spinta del bacino, non delle braccia.'),
  ('Burpees', 'total_body', 'corpo libero', 'Piegamento a terra, ritorno in piedi e salto con le braccia in alto, in sequenza continua.'),
  ('Thruster con manubri', 'total_body', 'manubri', 'Squat profondo e, risalendo, spinta dei manubri sopra la testa in un unico movimento.'),
  ('Farmer''s walk', 'total_body', 'manubri', 'Cammina con un manubrio per mano, busto alto e spalle basse. Indica i metri o i secondi.'),
  ('Mobilità anche 90/90', 'mobilita', 'corpo libero', 'Seduto a terra con le gambe a 90°, ruota le ginocchia da un lato all''altro mantenendo il busto alto.'),
  ('Cat-camel', 'mobilita', 'corpo libero', 'In quadrupedia, alterna schiena inarcata e schiena arrotondata con respiro lento.'),
  ('Stretching ischiocrurali', 'mobilita', 'corpo libero', 'Da seduto o in piedi, allunga la gamba e porta il busto in avanti con la schiena lunga. Tieni 30 secondi.'),
  ('Mobilità spalle con bastone', 'mobilita', 'bastone', 'Con un bastone a presa larga, porta le braccia dall''alto all''indietro con i gomiti distesi.'),
  ('Stretching pettorali', 'mobilita', 'corpo libero', 'Avambraccio appoggiato a uno stipite, ruota il busto in direzione opposta fino a sentire lo stiramento.')
on conflict do nothing;

-- ═════════ Aggiornamento 1.1 (identico a update_1_1.sql) ═════════

-- YMCA Prime Training: aggiornamento del database alla versione 1.1
-- Chi ha già eseguito la 1.0 lo incolla nel SQL Editor di Supabase ed esegue UNA volta sola.
-- Chi parte da zero non deve farlo: setup.sql contiene già tutto (questo file è in fondo, identico).
--
-- Novità: anamnesi (riservata allo staff), preferenze di allenamento, documenti PDF, corsi, plicometria e BIA,
-- calendario delle attività, avvisi push dallo staff, nuovi campi delle schede (obiettivo, livello, scadenza,
-- corsi consigliati), voci di scheda «tecnica», «lezione» e «riposo», gruppi muscolari più precisi, categorie
-- degli esercizi, numeri della bacheca e report degli allenamenti.

-- ───────── Profili: data di nascita e sesso (servono alla plicometria e all'elenco soci) ─────────

alter table profiles add column if not exists birth_date date check (birth_date is null or birth_date >= date '1900-01-01');
alter table profiles add column if not exists sex text check (sex in ('m', 'f'));

-- ───────── Esercizi: gruppi muscolari più precisi e categoria ─────────

alter table exercises drop constraint if exists exercises_muscle_group_check;
alter table exercises add column if not exists category text not null default 'forza';

update exercises set muscle_group = case
    when name in ('Leg curl sdraiato', 'Stacco rumeno') then 'femorali'
    else 'quadricipiti' end
  where muscle_group = 'gambe';
update exercises set muscle_group = 'abduttori' where name = 'Abduzioni alla macchina' and muscle_group = 'glutei';
update exercises set muscle_group = 'trapezi' where name = 'Scrollate con manubri' and muscle_group = 'spalle';
update exercises set muscle_group = 'lombari' where name = 'Iperestensioni' and muscle_group = 'schiena';
update exercises set category = case
    when muscle_group = 'cardio' then 'cardio'
    when muscle_group = 'mobilita' and name ilike 'stretching%' then 'stretching'
    when muscle_group = 'mobilita' then 'mobilita'
    when muscle_group = 'total_body' then 'funzionale'
    else 'forza' end
  where category = 'forza';

alter table exercises add constraint exercises_muscle_group_check check (muscle_group in
  ('petto', 'schiena', 'spalle', 'trapezi', 'bicipiti', 'tricipiti', 'avambracci', 'quadricipiti', 'femorali', 'glutei', 'adduttori', 'abduttori',
   'polpacci', 'addome', 'lombari', 'cardio', 'total_body', 'mobilita'));
alter table exercises drop constraint if exists exercises_category_check;
alter table exercises add constraint exercises_category_check check (category in ('forza', 'funzionale', 'pliometria', 'cardio', 'mobilita', 'stretching'));
create index if not exists exercises_category_idx on exercises (category) where active;

-- ───────── Corsi (lezioni di gruppo della palestra) ─────────

create table courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  duration_min int check (duration_min is null or duration_min between 5 and 300),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index courses_name_uq on courses (lower(name));
alter table courses enable row level security;
create policy "corsi: tutti leggono" on courses for select using (auth.uid() is not null);
create policy "corsi: staff scrive" on courses for insert with check (is_staff());
create policy "corsi: staff modifica" on courses for update using (is_staff()) with check (is_staff());
create policy "corsi: staff elimina" on courses for delete using (is_staff());

-- ───────── Schede: campi nuovi e voci di tipo tecnica / lezione / riposo ─────────

alter table programs add column if not exists objective text check (objective in ('mantenimento', 'forza', 'dimagrimento', 'massa', 'definizione', 'tonificazione'));
alter table programs add column if not exists level text check (level in ('facile', 'medio', 'avanzato'));
alter table programs add column if not exists target text not null default 'tutti' check (target in ('tutti', 'uomo', 'donna'));
alter table programs add column if not exists auto_archive boolean not null default false;   -- true = alla scadenza il socio non la vede più
alter table programs add column if not exists course_ids uuid[] not null default '{}';        -- corsi consigliati
alter table programs add column if not exists template_id uuid references programs(id) on delete set null;   -- modello da cui nasce
alter table programs drop constraint if exists programs_notes_len;
alter table programs add constraint programs_notes_len check (notes is null or length(notes) <= 1500) not valid;

alter table program_items add column if not exists kind text not null default 'exercise' check (kind in ('exercise', 'technique', 'lesson', 'rest'));
alter table program_items add column if not exists title text;     -- nome della tecnica / della lezione / del riposo
alter table program_items add column if not exists course_id uuid references courses(id) on delete set null;
alter table program_items alter column exercise_id drop not null;
alter table program_items drop constraint if exists program_items_kind_chk;
alter table program_items add constraint program_items_kind_chk check (kind <> 'exercise' or exercise_id is not null);

-- ───────── Anamnesi (dati sanitari: solo staff) e preferenze di allenamento ─────────

create table anamnesis (
  member_id uuid primary key references profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  consent_on date,                                        -- data del consenso al trattamento dei dati sulla salute
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);
alter table anamnesis enable row level security;
create policy "anamnesi: solo staff" on anamnesis for all using (is_staff()) with check (is_staff());

create table training_prefs (
  member_id uuid primary key references profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);
alter table training_prefs enable row level security;
create policy "preferenze: socio e staff leggono" on training_prefs for select using (member_id = auth.uid() or is_staff());
create policy "preferenze: socio e staff inseriscono" on training_prefs for insert with check (member_id = auth.uid() or is_staff());
create policy "preferenze: socio e staff correggono" on training_prefs for update using (member_id = auth.uid() or is_staff()) with check (member_id = auth.uid() or is_staff());

create function touch_row() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger anamnesis_touch before update on anamnesis for each row execute function touch_row();
create trigger training_prefs_touch before update on training_prefs for each row execute function touch_row();

-- ───────── Documenti PDF assegnati ai soci ─────────

create table documents (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  storage_path text not null unique,                      -- percorso del file nel contenitore «documents»
  visible_to_member boolean not null default true,        -- false = lo vede solo lo staff
  size_bytes int check (size_bytes is null or size_bytes <= 2097152),
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table document_members (
  document_id uuid not null references documents(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  primary key (document_id, member_id)
);
create index on document_members (member_id);
alter table documents enable row level security;
alter table document_members enable row level security;
create policy "documenti: staff tutto" on documents for all using (is_staff()) with check (is_staff());
create policy "documenti: il socio legge i propri" on documents for select
  using (visible_to_member and exists (select 1 from document_members m where m.document_id = documents.id and m.member_id = auth.uid()));
create policy "assegnazioni: staff tutto" on document_members for all using (is_staff()) with check (is_staff());
create policy "assegnazioni: il socio legge le proprie" on document_members for select using (member_id = auth.uid());

-- File veri e propri: contenitori di Supabase Storage (sui Postgres senza Storage, per esempio i test, questo passaggio viene saltato)
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
    ('documents', 'documents', false, 2097152, array['application/pdf']),
    ('exercise-media', 'exercise-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  execute $p$create policy "documenti: lo staff gestisce i file" on storage.objects for all
    using (bucket_id = 'documents' and public.is_staff()) with check (bucket_id = 'documents' and public.is_staff())$p$;
  execute $p$create policy "documenti: il socio legge i propri file" on storage.objects for select
    using (bucket_id = 'documents' and exists (
      select 1 from public.documents d join public.document_members m on m.document_id = d.id
      where d.storage_path = storage.objects.name and d.visible_to_member and m.member_id = auth.uid()))$p$;
  execute $p$create policy "immagini esercizi: lo staff le gestisce" on storage.objects for all
    using (bucket_id = 'exercise-media' and public.is_staff()) with check (bucket_id = 'exercise-media' and public.is_staff())$p$;
end $$;

-- ───────── Misure, plicometria e BIA ─────────

alter table measurements add column if not exists height_cm numeric(5,1) check (height_cm is null or height_cm between 100 and 250);
alter table measurements add column if not exists neck_cm numeric(5,1);
alter table measurements add column if not exists shoulders_cm numeric(5,1);
alter table measurements add column if not exists calf_cm numeric(5,1);

create table skinfolds (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles(id) on delete cascade,
  measured_on date not null default current_date,
  chest_mm numeric(4,1), abdominal_mm numeric(4,1), thigh_mm numeric(4,1),
  triceps_mm numeric(4,1), subscapular_mm numeric(4,1), suprailiac_mm numeric(4,1), midaxillary_mm numeric(4,1),
  bf_pct numeric(4,1) check (bf_pct is null or bf_pct between 2 and 70),    -- percentuale di grasso stimata (calcolata dall'app)
  method text,                                                               -- formula usata, per esempio «Jackson-Pollock 3 pliche»
  note text,
  created_by uuid references profiles(id) on delete set null,
  unique (member_id, measured_on)
);
create table bia_scans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5,2), fat_pct numeric(4,1), fat_kg numeric(5,2), lean_kg numeric(5,2),
  water_pct numeric(4,1), muscle_kg numeric(5,2), bone_kg numeric(4,2),
  visceral_fat numeric(4,1), bmr_kcal int, metabolic_age int,
  note text,
  created_by uuid references profiles(id) on delete set null,
  unique (member_id, measured_on)
);
alter table skinfolds enable row level security;
alter table bia_scans enable row level security;
create policy "plicometria: socio e staff leggono" on skinfolds for select using (member_id = auth.uid() or is_staff());
create policy "plicometria: scrive lo staff" on skinfolds for all using (is_staff()) with check (is_staff());
create policy "bia: socio e staff leggono" on bia_scans for select using (member_id = auth.uid() or is_staff());
create policy "bia: scrive lo staff" on bia_scans for all using (is_staff()) with check (is_staff());

-- ───────── Calendario delle attività ─────────

create table activities (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'appuntamento' check (kind in ('appuntamento', 'lezione', 'altro')),
  title text not null check (length(btrim(title)) > 0),
  member_id uuid references profiles(id) on delete cascade,
  trainer_id uuid references profiles(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index on activities (starts_at);
alter table activities enable row level security;
create policy "attività: staff tutto" on activities for all using (is_staff()) with check (is_staff());
create policy "attività: il socio legge le proprie" on activities for select using (member_id = auth.uid());

-- Allenamenti svolti, schede in scadenza e attività in un periodo (solo staff)
create function calendar_events(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select coalesce(jsonb_agg(e order by e->>'at'), '[]'::jsonb) into v from (
    select jsonb_build_object('kind', 'workout', 'id', w.id, 'at', w.started_at, 'end_at', w.finished_at,
                              'member_id', w.member_id, 'member_name', m.full_name, 'title', coalesce(w.day_name, 'Allenamento')) as e
    from workouts w join profiles m on m.id = w.member_id
    where w.started_at >= p_from::timestamptz and w.started_at < (p_to + 1)::timestamptz
    union all
    select jsonb_build_object('kind', 'renewal', 'id', p.id, 'at', ((p.starts_on + p.weeks * 7)::timestamp + interval '12 hours') at time zone 'Europe/Rome',
                              'member_id', p.member_id, 'member_name', m.full_name, 'title', p.name)
    from programs p join profiles m on m.id = p.member_id
    where p.status = 'active' and not p.is_template and p.starts_on is not null
      and p.starts_on + p.weeks * 7 between p_from and p_to
    union all
    select jsonb_build_object('kind', 'activity', 'id', a.id, 'at', a.starts_at, 'end_at', a.ends_at, 'member_id', a.member_id,
                              'member_name', m.full_name, 'title', a.title, 'type', a.kind, 'note', a.note)
    from activities a left join profiles m on m.id = a.member_id
    where a.starts_at >= p_from::timestamptz and a.starts_at < (p_to + 1)::timestamptz
  ) x;
  return v;
end $$;

-- ───────── Avvisi push dallo staff ─────────

create table push_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 80),
  body text not null check (length(btrim(body)) between 1 and 300),
  audience text not null check (audience in ('all', 'members', 'staff', 'selected')),
  member_ids uuid[] not null default '{}',
  targets int not null default 0,        -- persone a cui era destinato
  recipients int not null default 0,     -- persone con un telefono registrato per le notifiche
  sent_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table push_announcements enable row level security;
create policy "avvisi: lo staff li legge" on push_announcements for select using (is_staff());   -- si creano solo con send_announcement

create function send_announcement(p_title text, p_body text, p_audience text, p_members uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_users uuid[]; v_tokens uuid[]; v_id uuid;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if btrim(coalesce(p_title, '')) = '' or btrim(coalesce(p_body, '')) = '' then raise exception 'message_required'; end if;
  if p_audience is null or p_audience not in ('all', 'members', 'staff', 'selected') then raise exception 'audience_invalid'; end if;
  select coalesce(array_agg(id), '{}') into v_users from profiles
  where case p_audience
      when 'all' then active or role <> 'member'
      when 'members' then role = 'member' and active
      when 'staff' then role <> 'member'
      when 'selected' then id = any (coalesce(p_members, '{}')) and active
      else false end;
  select coalesce(array_agg(distinct user_id), '{}') into v_tokens from push_tokens where user_id = any (v_users);
  insert into push_announcements (title, body, audience, member_ids, targets, recipients, sent_by)
  values (btrim(p_title), btrim(p_body), p_audience, case when p_audience = 'selected' then coalesce(p_members, '{}') else '{}' end,
          cardinality(v_users), cardinality(v_tokens), auth.uid())
  returning id into v_id;
  if cardinality(v_tokens) > 0 then
    perform send_push(v_tokens, btrim(p_title), left(btrim(p_body), 300), jsonb_build_object('type', 'announcement', 'id', v_id));
  end if;
  return jsonb_build_object('id', v_id, 'targets', cardinality(v_users), 'recipients', cardinality(v_tokens));
end $$;

-- ───────── Schede: lettura, salvataggio e copia con i campi nuovi ─────────

create or replace function program_json(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not can_see_program(p_id) then return null; end if;
  select to_jsonb(p) || jsonb_build_object('days', coalesce((
    select jsonb_agg(to_jsonb(d) || jsonb_build_object('items', coalesce((
      select jsonb_agg(to_jsonb(i) || jsonb_build_object(
        'exercise', case when e.id is null then null else jsonb_build_object(
          'id', e.id, 'name', e.name, 'muscle_group', e.muscle_group, 'equipment', e.equipment,
          'description', e.description, 'video_url', e.video_url, 'image_url', e.image_url) end,
        'course', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name, 'category', c.category, 'duration_min', c.duration_min) end
      ) order by i.position)
      from program_items i left join exercises e on e.id = i.exercise_id left join courses c on c.id = i.course_id
      where i.day_id = d.id), '[]'::jsonb)) order by d.position)
    from program_days d where d.program_id = p.id), '[]'::jsonb))
  into v from programs p where p.id = p_id;
  return v;
end $$;

-- Con «disattiva alla scadenza» il socio non vede più la scheda dal giorno in cui finisce
create or replace function my_active_program() returns jsonb
language sql stable security definer set search_path = public as $$
  select program_json(id) from programs
  where member_id = auth.uid() and status = 'active'
    and not (auto_archive and starts_on is not null and starts_on + weeks * 7 <= current_date)
  limit 1
$$;

create or replace function save_program(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_trainer uuid := nullif(p->>'trainer_id', '')::uuid;
  v_courses uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p->'course_ids', '[]'::jsonb)) x), '{}');
  d jsonb; it jsonb;
  v_day uuid; v_item uuid; v_kind text;
  di int := 0; ii int;
  keep_days uuid[] := '{}'; keep_items uuid[] := '{}';
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if btrim(coalesce(p->>'name', '')) = '' then raise exception 'name_required'; end if;

  if v_id is null then
    insert into programs (name, goal, member_id, trainer_id, is_template, starts_on, weeks, notes, objective, level, target, auto_archive, course_ids)
    values (btrim(p->>'name'), nullif(btrim(p->>'goal'), ''), nullif(p->>'member_id', '')::uuid, coalesce(v_trainer, auth.uid()),
            coalesce((p->>'is_template')::boolean, false), nullif(p->>'starts_on', '')::date,
            coalesce(nullif(p->>'weeks', '')::int, 4), nullif(btrim(p->>'notes'), ''),
            nullif(p->>'objective', ''), nullif(p->>'level', ''), coalesce(nullif(p->>'target', ''), 'tutti'),
            coalesce((p->>'auto_archive')::boolean, false), v_courses)
    returning id into v_id;
  else
    update programs set name = btrim(p->>'name'), goal = nullif(btrim(p->>'goal'), ''),
      starts_on = nullif(p->>'starts_on', '')::date, weeks = coalesce(nullif(p->>'weeks', '')::int, weeks),
      notes = nullif(btrim(p->>'notes'), ''), trainer_id = coalesce(v_trainer, trainer_id),
      objective = nullif(p->>'objective', ''), level = nullif(p->>'level', ''), target = coalesce(nullif(p->>'target', ''), 'tutti'),
      auto_archive = coalesce((p->>'auto_archive')::boolean, auto_archive), course_ids = v_courses
    where id = v_id;
    if not found then raise exception 'not_found'; end if;
  end if;

  for d in select * from jsonb_array_elements(coalesce(p->'days', '[]'::jsonb)) loop
    di := di + 1;
    v_day := nullif(d->>'id', '')::uuid;
    if v_day is not null and exists (select 1 from program_days where id = v_day and program_id = v_id) then
      update program_days set position = di, name = coalesce(nullif(btrim(d->>'name'), ''), 'Giorno ' || di), focus = nullif(btrim(d->>'focus'), '')
      where id = v_day;
    else
      insert into program_days (program_id, position, name, focus)
      values (v_id, di, coalesce(nullif(btrim(d->>'name'), ''), 'Giorno ' || di), nullif(btrim(d->>'focus'), ''))
      returning id into v_day;
    end if;
    keep_days := keep_days || v_day;

    ii := 0;
    for it in select * from jsonb_array_elements(coalesce(d->'items', '[]'::jsonb)) loop
      ii := ii + 1;
      v_kind := coalesce(nullif(it->>'kind', ''), 'exercise');
      if v_kind not in ('exercise', 'technique', 'lesson', 'rest') then raise exception 'kind_invalid'; end if;
      if v_kind = 'exercise' and nullif(it->>'exercise_id', '') is null then raise exception 'exercise_required'; end if;
      v_item := nullif(it->>'id', '')::uuid;
      if v_item is not null and exists (
        select 1 from program_items pi join program_days pd on pd.id = pi.day_id where pi.id = v_item and pd.program_id = v_id
      ) then
        update program_items set day_id = v_day, position = ii, kind = v_kind, title = nullif(btrim(it->>'title'), ''),
          course_id = nullif(it->>'course_id', '')::uuid, exercise_id = nullif(it->>'exercise_id', '')::uuid,
          sets = coalesce(nullif(it->>'sets', '')::int, case when v_kind = 'exercise' then 3 else 1 end),
          reps = case when v_kind = 'exercise' then coalesce(nullif(btrim(it->>'reps'), ''), '10') else coalesce(btrim(it->>'reps'), '') end,
          load_hint = nullif(btrim(it->>'load_hint'), ''), rest_sec = coalesce(nullif(it->>'rest_sec', '')::int, 60),
          tempo = nullif(btrim(it->>'tempo'), ''), note = nullif(btrim(it->>'note'), ''), superset = nullif(btrim(it->>'superset'), '')
        where id = v_item;
      else
        insert into program_items (day_id, position, kind, title, course_id, exercise_id, sets, reps, load_hint, rest_sec, tempo, note, superset)
        values (v_day, ii, v_kind, nullif(btrim(it->>'title'), ''), nullif(it->>'course_id', '')::uuid, nullif(it->>'exercise_id', '')::uuid,
                coalesce(nullif(it->>'sets', '')::int, case when v_kind = 'exercise' then 3 else 1 end),
                case when v_kind = 'exercise' then coalesce(nullif(btrim(it->>'reps'), ''), '10') else coalesce(btrim(it->>'reps'), '') end,
                nullif(btrim(it->>'load_hint'), ''), coalesce(nullif(it->>'rest_sec', '')::int, 60), nullif(btrim(it->>'tempo'), ''),
                nullif(btrim(it->>'note'), ''), nullif(btrim(it->>'superset'), ''))
        returning id into v_item;
      end if;
      keep_items := keep_items || v_item;
    end loop;
  end loop;

  delete from program_items where day_id in (select id from program_days where program_id = v_id) and id <> all (keep_items);
  delete from program_days where program_id = v_id and id <> all (keep_days);
  return v_id;
end $$;

create or replace function copy_program(p_source uuid, p_member uuid, p_as_template boolean default false, p_name text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_new uuid; v_day uuid; d record;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if (p_member is null) = (not coalesce(p_as_template, false)) then
    raise exception 'serve un socio oppure is_template';
  end if;

  insert into programs (name, goal, member_id, trainer_id, is_template, weeks, notes, objective, level, target, auto_archive, course_ids, template_id)
  select coalesce(nullif(btrim(p_name), ''), s.name), s.goal, p_member, auth.uid(), coalesce(p_as_template, false), s.weeks, s.notes,
         s.objective, s.level, s.target, s.auto_archive, s.course_ids,
         case when coalesce(p_as_template, false) then null else coalesce(case when s.is_template then s.id end, s.template_id) end
  from programs s where s.id = p_source
  returning id into v_new;
  if v_new is null then raise exception 'not_found'; end if;

  for d in select * from program_days where program_id = p_source order by position loop
    insert into program_days (program_id, position, name, focus) values (v_new, d.position, d.name, d.focus) returning id into v_day;
    insert into program_items (day_id, position, kind, title, course_id, exercise_id, sets, reps, load_hint, rest_sec, tempo, note, superset)
    select v_day, position, kind, title, course_id, exercise_id, sets, reps, load_hint, rest_sec, tempo, note, superset
    from program_items where day_id = d.id;
  end loop;
  return v_new;
end $$;

-- Elenco schede per lo staff (assegnate ai soci oppure modelli), con giorni ed esercizi contati
create function programs_overview(p_templates boolean default false)
returns table (
  id uuid, name text, goal text, objective text, level text, target text, status program_status,
  member_id uuid, member_name text, trainer_id uuid, trainer_name text, template_name text,
  starts_on date, ends_on date, weeks int, auto_archive boolean, days_count int, items_count int, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.goal, p.objective, p.level, p.target, p.status,
         p.member_id, m.full_name, p.trainer_id, t.full_name, tp.name,
         p.starts_on, case when p.starts_on is not null then p.starts_on + p.weeks * 7 end, p.weeks, p.auto_archive,
         (select count(*)::int from program_days d where d.program_id = p.id),
         (select count(*)::int from program_items i join program_days d on d.id = i.day_id where d.program_id = p.id),
         p.created_at
  from programs p
  left join profiles m on m.id = p.member_id
  left join profiles t on t.id = p.trainer_id
  left join programs tp on tp.id = p.template_id
  where is_staff() and p.is_template = coalesce(p_templates, false)
  order by p.created_at desc
$$;

-- ───────── Staff: elenco soci con data di nascita, bacheca e report ─────────

drop function if exists members_overview();
create function members_overview() returns table (
  id uuid, full_name text, phone text, email text, active boolean, goal text,
  trainer_id uuid, trainer_name text,
  program_id uuid, program_name text, program_ends_on date,
  last_workout_at timestamptz, workouts_30d int, created_at timestamptz,
  birth_date date, sex text, has_anamnesis boolean
)
language sql stable security definer set search_path = public as $$
  select m.id, m.full_name, m.phone, m.email, m.active, m.goal, m.trainer_id, t.full_name,
         p.id, p.name, case when p.starts_on is not null then p.starts_on + p.weeks * 7 end,
         lw.last_at, lw.n30::int, m.created_at,
         m.birth_date, m.sex, exists (select 1 from anamnesis a where a.member_id = m.id)
  from profiles m
  left join profiles t on t.id = m.trainer_id
  left join programs p on p.member_id = m.id and p.status = 'active'
  left join lateral (
    select max(w.started_at) as last_at, count(*) filter (where w.started_at > now() - interval '30 days') as n30
    from workouts w where w.member_id = m.id
  ) lw on true
  where is_staff() and m.role = 'member'
  order by m.full_name
$$;

create or replace function gym_stats(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'members_active', (select count(*) from profiles where role = 'member' and active),
    'members_new', (select count(*) from profiles where role = 'member' and created_at > now() - make_interval(days => p_days)),
    'members_training', (select count(distinct member_id) from workouts where started_at > now() - make_interval(days => p_days)),
    'workouts', (select count(*) from workouts where started_at > now() - make_interval(days => p_days)),
    'without_program', (select count(*) from profiles m where m.role = 'member' and m.active
                        and not exists (select 1 from programs p where p.member_id = m.id and p.status = 'active')),
    'expiring', (select count(*) from programs p where p.status = 'active' and p.starts_on is not null
                 and p.starts_on + p.weeks * 7 <= current_date + 7),
    'weekly', (select coalesce(jsonb_agg(jsonb_build_object('week', w.wk, 'workouts', w.n) order by w.wk), '[]'::jsonb)
               from (select date_trunc('week', started_at)::date as wk, count(*) as n
                     from workouts where started_at > now() - interval '8 weeks' group by 1) w),
    'trainers', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.full_name, 'members', t.n) order by t.n desc), '[]'::jsonb)
                 from (select tr.id, tr.full_name, (select count(*) from profiles m where m.trainer_id = tr.id and m.active) as n
                       from profiles tr where tr.role in ('trainer', 'owner')) t),
    'counts', jsonb_build_object(
      'members', (select count(*) from profiles where role = 'member'),
      'programs', (select count(*) from programs where not is_template),
      'exercises', (select count(*) from exercises where active),
      'templates', (select count(*) from programs where is_template),
      'courses', (select count(*) from courses where active)),
    'latest_members', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select id, full_name, birth_date, created_at from profiles where role = 'member' order by created_at desc limit 5) x),
    'latest_staff', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select id, full_name, role, created_at from profiles where role <> 'member' order by created_at desc limit 5) x),
    'latest_programs', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select p.id, p.name, p.status, p.starts_on, case when p.starts_on is not null then p.starts_on + p.weeks * 7 end as ends_on,
               m.full_name as member_name, t.full_name as trainer_name
        from programs p left join profiles m on m.id = p.member_id left join profiles t on t.id = p.trainer_id
        where not p.is_template order by p.created_at desc limit 5) x)
  ) into v;
  return v;
end $$;

-- Report degli allenamenti di un socio in un periodo (staff, o il socio stesso): medie, mesi, andamento per esercizio
create function workout_report(p_member uuid default null, p_from date default null, p_to date default null, p_program uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_m uuid := coalesce(p_member, auth.uid());
  v_f date := coalesce(p_from, current_date - 90);
  v_t date := coalesce(p_to, current_date);
  v jsonb;
begin
  if v_m is null then raise exception 'login_required'; end if;
  if v_m is distinct from auth.uid() and not is_staff() then raise exception 'forbidden'; end if;
  with w as (
    select id, started_at from workouts
    where member_id = v_m and started_at >= v_f::timestamptz and started_at < (v_t + 1)::timestamptz
      and (p_program is null or program_id = p_program)
  ), per_w as (
    select w.id, count(distinct s.exercise_id) as n from w left join set_logs s on s.workout_id = w.id group by w.id
  ), per as (
    select s.exercise_id, s.workout_id, w.started_at,
           max(coalesce(s.weight_kg, 0)) as best_w,
           (array_agg(s.reps order by coalesce(s.weight_kg, 0) desc, s.reps desc))[1] as reps_at_best
    from set_logs s join w on w.id = s.workout_id
    where s.reps > 0
    group by s.exercise_id, s.workout_id, w.started_at
  )
  select jsonb_build_object(
    'workouts', (select count(*) from w),
    'avg_per_week', round((select count(*) from w) / (greatest(1, v_t - v_f + 1) / 7.0), 1),
    'avg_exercises', coalesce((select round(avg(n), 1) from per_w), 0),
    'monthly', (select coalesce(jsonb_agg(jsonb_build_object('month', m.mo, 'workouts', m.n) order by m.mo), '[]'::jsonb)
                from (select date_trunc('month', started_at)::date as mo, count(*) as n from w group by 1) m),
    'exercises', (select coalesce(jsonb_agg(q.x order by q.x->>'name'), '[]'::jsonb) from (
        select jsonb_build_object('exercise_id', e.id, 'name', e.name, 'muscle_group', e.muscle_group, 'sessions', count(*),
                 'series', jsonb_agg(jsonb_build_object('at', p.started_at, 'w', p.best_w, 'reps', p.reps_at_best) order by p.started_at)) as x
        from per p join exercises e on e.id = p.exercise_id
        group by e.id, e.name, e.muscle_group) q)
  ) into v;
  return v;
end $$;

-- <seed-esercizi>
-- (generato da scripts/gen-seed-sql.cjs: 282 esercizi di partenza, testi originali; chi esiste già non viene toccato)
insert into exercises (name, muscle_group, category, equipment, description) values
  ('Panca piana con bilanciere', 'petto', 'forza', 'bilanciere', 'Sdraiato sulla panca, scapole addotte e piedi a terra. Scendi con controllo fino al petto e spingi fino a braccia quasi distese.'),
  ('Panca piana con manubri', 'petto', 'forza', 'manubri', 'Come la panca col bilanciere ma con i manubri: maggiore escursione, i gomiti restano a circa 45° dal busto.'),
  ('Panca inclinata con manubri', 'petto', 'forza', 'manubri', 'Panca a 30°. Spingi i manubri in alto avvicinandoli senza farli battere; scendi fino a sentire lo stiramento dei pettorali.'),
  ('Chest press', 'petto', 'forza', 'macchina', 'Schiena aderente allo schienale, impugnature all''altezza del petto. Spingi in avanti senza staccare le spalle.'),
  ('Croci ai cavi', 'petto', 'forza', 'cavi', 'Braccia leggermente flesse, porta le mani davanti al petto stringendo i pettorali; torna lentamente.'),
  ('Croci con manubri su panca', 'petto', 'forza', 'manubri', 'Apri le braccia ad arco con i gomiti morbidi fino allo stiramento, poi richiudi come per abbracciare.'),
  ('Piegamenti sulle braccia', 'petto', 'forza', 'corpo libero', 'Corpo in linea dalla testa ai talloni, addome contratto. Scendi con il petto verso il pavimento e risali.'),
  ('Dip alle parallele', 'petto', 'forza', 'corpo libero', 'Busto leggermente in avanti per coinvolgere il petto. Scendi finché le spalle sono all''altezza dei gomiti.'),
  ('Lat machine presa larga', 'schiena', 'forza', 'macchina', 'Tira la barra al petto portando i gomiti verso i fianchi, petto in fuori, senza dondolare con il busto.'),
  ('Lat machine presa stretta', 'schiena', 'forza', 'macchina', 'Presa neutra o stretta: tira verso lo sterno tenendo i gomiti vicini al corpo.'),
  ('Trazioni alla sbarra', 'schiena', 'forza', 'corpo libero', 'Parti a braccia distese, porta il mento sopra la sbarra guidando con i gomiti. Scendi in modo controllato.'),
  ('Rematore con bilanciere', 'schiena', 'forza', 'bilanciere', 'Busto inclinato a circa 45°, schiena neutra. Porta la barra verso l''ombelico stringendo le scapole.'),
  ('Rematore con manubrio', 'schiena', 'forza', 'manubri', 'Un ginocchio e una mano sulla panca. Tira il manubrio verso l''anca, gomito vicino al corpo.'),
  ('Pulley basso', 'schiena', 'forza', 'cavi', 'Seduto, busto fermo. Tira l''impugnatura verso l''addome portando indietro i gomiti e stringendo le scapole.'),
  ('Pulldown a braccia tese', 'schiena', 'forza', 'cavi', 'Braccia quasi distese, abbassa la barra fino alle cosce usando i dorsali, senza piegare i gomiti.'),
  ('Stacco da terra', 'schiena', 'forza', 'bilanciere', 'Barra vicino alle tibie, schiena neutra. Spingi il pavimento con le gambe e distendi le anche fino alla posizione eretta.'),
  ('Iperestensioni', 'lombari', 'forza', 'panca', 'Sulla panca a 45°, scendi con la schiena neutra e risali fino ad allineare il corpo, senza iperestendere.'),
  ('Lento avanti con manubri', 'spalle', 'forza', 'manubri', 'Da seduto o in piedi, spingi i manubri sopra la testa senza inarcare la schiena; scendi fino all''altezza delle orecchie.'),
  ('Military press con bilanciere', 'spalle', 'forza', 'bilanciere', 'In piedi, glutei e addome contratti. Spingi la barra sopra la testa passando vicino al viso.'),
  ('Alzate laterali', 'spalle', 'forza', 'manubri', 'Gomiti leggermente flessi, alza i manubri di lato fino all''altezza delle spalle e scendi lentamente.'),
  ('Alzate frontali', 'spalle', 'forza', 'manubri', 'Alza i manubri davanti a te fino all''altezza delle spalle, senza usare lo slancio.'),
  ('Alzate posteriori', 'spalle', 'forza', 'manubri', 'Busto inclinato in avanti, apri le braccia di lato stringendo le scapole per lavorare sui deltoidi posteriori.'),
  ('Face pull', 'spalle', 'forza', 'cavi', 'Cavo all''altezza del viso, tira la corda verso la fronte aprendo i gomiti. Ottimo per la postura delle spalle.'),
  ('Scrollate con manubri', 'trapezi', 'forza', 'manubri', 'Braccia lungo i fianchi, alza le spalle verso le orecchie e fai una breve pausa in alto.'),
  ('Curl con bilanciere', 'bicipiti', 'forza', 'bilanciere', 'Gomiti fermi lungo i fianchi, porta la barra verso le spalle e scendi lentamente.'),
  ('Curl con manubri alternato', 'bicipiti', 'forza', 'manubri', 'Ruota il polso verso l''alto durante la salita; alterna le braccia senza dondolare.'),
  ('Curl a martello', 'bicipiti', 'forza', 'manubri', 'Presa neutra (pollici in alto): lavora anche sull''avambraccio e sul brachiale.'),
  ('Curl ai cavi', 'bicipiti', 'forza', 'cavi', 'Tensione continua dal basso: porta l''impugnatura alle spalle con i gomiti fermi.'),
  ('Curl alla panca Scott', 'bicipiti', 'forza', 'bilanciere', 'Braccia appoggiate al cuscino: isola il bicipite, scendi fino quasi a distendere il gomito.'),
  ('French press con bilanciere EZ', 'tricipiti', 'forza', 'bilanciere', 'Sdraiato, porta la barra verso la fronte piegando solo i gomiti, poi distendi.'),
  ('Push down ai cavi', 'tricipiti', 'forza', 'cavi', 'Gomiti attaccati ai fianchi, spingi la barra o la corda verso il basso fino alla distensione completa.'),
  ('Estensioni sopra la testa con manubrio', 'tricipiti', 'forza', 'manubri', 'Manubrio dietro la testa, gomiti stretti: distendi le braccia verso l''alto.'),
  ('Panca presa stretta', 'tricipiti', 'forza', 'bilanciere', 'Mani poco più strette delle spalle, gomiti vicini al busto: spingi con i tricipiti.'),
  ('Kickback con manubrio', 'tricipiti', 'forza', 'manubri', 'Busto inclinato, gomito alto e fermo: distendi l''avambraccio all''indietro.'),
  ('Squat con bilanciere', 'quadricipiti', 'forza', 'bilanciere', 'Barra sui trapezi, piedi larghi come le spalle. Scendi con le anche indietro fino almeno al parallelo, ginocchia in linea con i piedi.'),
  ('Goblet squat', 'quadricipiti', 'forza', 'manubri', 'Un manubrio o kettlebell davanti al petto: scendi in squat tenendo il busto eretto. Ideale per imparare il movimento.'),
  ('Squat al multipower', 'quadricipiti', 'forza', 'macchina', 'Piedi leggermente avanti rispetto alla barra, scendi con controllo e spingi sui talloni.'),
  ('Leg press', 'quadricipiti', 'forza', 'macchina', 'Schiena e glutei aderenti allo schienale. Scendi finché le ginocchia sono a circa 90° senza staccare il bacino.'),
  ('Hack squat', 'quadricipiti', 'forza', 'macchina', 'Schiena sul supporto, piedi a metà pedana: scendi con controllo e spingi con tutto il piede.'),
  ('Affondi con manubri', 'quadricipiti', 'forza', 'manubri', 'Passo lungo in avanti o indietro, busto eretto: ginocchio posteriore vicino al pavimento, spingi sul tallone.'),
  ('Affondi bulgari', 'quadricipiti', 'forza', 'manubri', 'Piede posteriore appoggiato su una panca: scendi con il ginocchio anteriore in linea con il piede.'),
  ('Step-up su panca', 'quadricipiti', 'forza', 'manubri', 'Sali su una panca spingendo con la gamba di appoggio, senza darti slancio con l''altra.'),
  ('Leg extension', 'quadricipiti', 'forza', 'macchina', 'Distendi le ginocchia contraendo i quadricipiti, pausa in alto e discesa lenta.'),
  ('Leg curl sdraiato', 'femorali', 'forza', 'macchina', 'Porta i talloni verso i glutei senza sollevare il bacino; scendi lentamente.'),
  ('Stacco rumeno', 'femorali', 'forza', 'bilanciere', 'Ginocchia appena flesse, spingi il bacino indietro facendo scendere la barra lungo le gambe fino a sentire i femorali.'),
  ('Hip thrust', 'glutei', 'forza', 'bilanciere', 'Schiena alta su una panca, barra sulle anche: spingi il bacino in alto contraendo i glutei, mento verso il petto.'),
  ('Ponte glutei', 'glutei', 'forza', 'corpo libero', 'Sdraiato, piedi vicini ai glutei: solleva il bacino fino ad allineare ginocchia, anche e spalle.'),
  ('Abduzioni alla macchina', 'abduttori', 'forza', 'macchina', 'Seduto, apri le gambe contro la resistenza senza spostare il busto.'),
  ('Kickback glutei ai cavi', 'glutei', 'forza', 'cavi', 'Cavigliera ai cavi: porta la gamba indietro contraendo il gluteo, senza inarcare la schiena.'),
  ('Calf in piedi', 'polpacci', 'forza', 'macchina', 'Sali sulle punte il più possibile, pausa in alto e discesa completa fino allo stiramento.'),
  ('Calf seduto', 'polpacci', 'forza', 'macchina', 'Ginocchia a 90°: lavora sul soleo con salite lente e discesa completa.'),
  ('Crunch', 'addome', 'forza', 'corpo libero', 'Sdraiato, solleva spalle e scapole dal pavimento contraendo l''addome; non tirare il collo con le mani.'),
  ('Crunch ai cavi', 'addome', 'forza', 'cavi', 'In ginocchio, corda dietro la testa: arrotola il busto verso il bacino contraendo l''addome.'),
  ('Plank', 'addome', 'forza', 'corpo libero', 'Appoggio sugli avambracci, corpo in linea, glutei e addome contratti. Tenuta isometrica: indica i secondi nelle ripetizioni.'),
  ('Plank laterale', 'addome', 'forza', 'corpo libero', 'Appoggio su un avambraccio, anche alte e corpo in linea. Tieni la posizione e cambia lato.'),
  ('Sollevamento gambe alla sbarra', 'addome', 'forza', 'corpo libero', 'Appeso alla sbarra, porta le gambe verso l''alto arrotolando il bacino, senza dondolare.'),
  ('Russian twist', 'addome', 'forza', 'palla medica', 'Seduto con busto inclinato e piedi sollevati, ruota il busto da lato a lato con un peso tra le mani.'),
  ('Ab wheel', 'addome', 'forza', 'ruota', 'In ginocchio, fai rotolare la ruota in avanti mantenendo la schiena neutra e torna con l''addome.'),
  ('Mountain climber', 'addome', 'forza', 'corpo libero', 'In appoggio come per un piegamento, porta alternativamente le ginocchia al petto a ritmo sostenuto.'),
  ('Tapis roulant', 'cardio', 'cardio', 'tapis roulant', 'Camminata o corsa a velocità e pendenza indicate dal programma. Indica i minuti nelle ripetizioni.'),
  ('Cyclette', 'cardio', 'cardio', 'cyclette', 'Pedalata a intensità costante o a intervalli, come da programma.'),
  ('Ellittica', 'cardio', 'cardio', 'ellittica', 'Movimento fluido a basso impatto; mantieni il busto eretto e l''intensità indicata.'),
  ('Vogatore', 'cardio', 'cardio', 'vogatore', 'Spingi con le gambe, poi tira con il busto e le braccia; ritorna in ordine inverso.'),
  ('Corda per saltare', 'cardio', 'cardio', 'corda', 'Salti leggeri sull''avampiede, polsi che ruotano la corda, ritmo regolare.'),
  ('Kettlebell swing', 'total_body', 'funzionale', 'kettlebell', 'Spingi le anche indietro e poi in avanti con forza: la kettlebell sale per la spinta del bacino, non delle braccia.'),
  ('Burpees', 'total_body', 'funzionale', 'corpo libero', 'Piegamento a terra, ritorno in piedi e salto con le braccia in alto, in sequenza continua.'),
  ('Thruster con manubri', 'total_body', 'funzionale', 'manubri', 'Squat profondo e, risalendo, spinta dei manubri sopra la testa in un unico movimento.'),
  ('Farmer''s walk', 'total_body', 'funzionale', 'manubri', 'Cammina con un manubrio per mano, busto alto e spalle basse. Indica i metri o i secondi.'),
  ('Mobilità anche 90/90', 'mobilita', 'mobilita', 'corpo libero', 'Seduto a terra con le gambe a 90°, ruota le ginocchia da un lato all''altro mantenendo il busto alto.'),
  ('Cat-camel', 'mobilita', 'mobilita', 'corpo libero', 'In quadrupedia, alterna schiena inarcata e schiena arrotondata con respiro lento.'),
  ('Stretching ischiocrurali', 'mobilita', 'stretching', 'corpo libero', 'Da seduto o in piedi, allunga la gamba e porta il busto in avanti con la schiena lunga. Tieni 30 secondi.'),
  ('Mobilità spalle con bastone', 'mobilita', 'mobilita', 'bastone', 'Con un bastone a presa larga, porta le braccia dall''alto all''indietro con i gomiti distesi.'),
  ('Stretching pettorali', 'mobilita', 'stretching', 'corpo libero', 'Avambraccio appoggiato a uno stipite, ruota il busto in direzione opposta fino a sentire lo stiramento.'),
  ('Panca inclinata con bilanciere', 'petto', 'forza', 'bilanciere', 'Panca a 30°, presa poco più larga delle spalle. Scendi alla parte alta del petto e spingi senza staccare i glutei dalla panca.'),
  ('Panca declinata con bilanciere', 'petto', 'forza', 'bilanciere', 'Panca declinata di 15-20° con i piedi bloccati. Porta la barra alla parte bassa del petto e spingi in verticale.'),
  ('Panca declinata con manubri', 'petto', 'forza', 'manubri', 'Sulla panca declinata, spingi i manubri sopra il petto e scendi fino a sentire lo stiramento senza far arretrare le spalle.'),
  ('Pectoral machine', 'petto', 'forza', 'macchina', 'Seduto con i gomiti all''altezza delle spalle, chiudi le braccia davanti al petto stringendo i pettorali e torna lentamente.'),
  ('Chest press inclinata', 'petto', 'forza', 'macchina', 'Schiena aderente allo schienale, impugnature poco sopra il petto: spingi in avanti e in alto senza sollevare le spalle.'),
  ('Croci inclinate con manubri', 'petto', 'forza', 'manubri', 'Panca a 30°, gomiti morbidi: apri le braccia ad arco e richiudi portando i manubri sopra la parte alta del petto.'),
  ('Croci al cavo alto', 'petto', 'forza', 'cavi', 'In piedi tra due carrucole alte, porta le mani davanti al bacino con le braccia leggermente flesse: lavora la parte bassa del petto.'),
  ('Croci al cavo basso', 'petto', 'forza', 'cavi', 'Carrucole in basso, porta le mani davanti al viso dal basso verso l''alto stringendo la parte alta dei pettorali.'),
  ('Spinte con elastico', 'petto', 'forza', 'elastico', 'Elastico fissato dietro la schiena: spingi in avanti distendendo le braccia e torna lentamente. Ottimo come riscaldamento.'),
  ('Piegamenti a mani strette', 'petto', 'forza', 'corpo libero', 'Mani sotto il petto, gomiti vicini al busto: scendi controllando e risali. Coinvolge molto i tricipiti.'),
  ('Piegamenti con piedi sollevati', 'petto', 'forza', 'corpo libero', 'Piedi appoggiati su una panca, corpo in linea: scendi con il petto verso il pavimento e risali. Sposta il carico sulla parte alta.'),
  ('Piegamenti sospesi al TRX', 'petto', 'forza', 'TRX', 'Mani nelle maniglie, corpo teso: scendi portando il petto tra le mani e risali. Più sei inclinato, più è difficile.'),
  ('Piegamenti sulle ginocchia', 'petto', 'forza', 'corpo libero', 'Variante più semplice: appoggio sulle ginocchia, busto in linea con le cosce. Scendi con il petto verso il pavimento.'),
  ('Pullover con manubrio', 'petto', 'forza', 'manubri', 'Sdraiato sulla panca, porta il manubrio dietro la testa con le braccia semi-distese e risali sopra il petto.'),
  ('Trazioni presa supina', 'schiena', 'forza', 'sbarra', 'Palmi verso di te, mani larghe come le spalle: porta il mento sopra la sbarra. Coinvolge molto i bicipiti.'),
  ('Trazioni presa neutra', 'schiena', 'forza', 'sbarra', 'Con le maniglie parallele, tira portando i gomiti ai fianchi. Presa comoda per spalle e polsi.'),
  ('Trazioni assistite alla macchina', 'schiena', 'forza', 'macchina', 'Un contrappeso ti aiuta nella salita: scegli il carico che ti permette di completare le ripetizioni con tecnica pulita.'),
  ('Lat machine presa inversa', 'schiena', 'forza', 'macchina', 'Palmi verso di te: tira la barra al petto alto con i gomiti vicini ai fianchi, senza dondolare.'),
  ('Lat machine monobraccio', 'schiena', 'forza', 'cavi', 'Un braccio alla volta: tira l''impugnatura verso la spalla ruotando leggermente il busto, scapola che scende.'),
  ('Rematore al T-bar', 'schiena', 'forza', 'T-bar', 'Busto inclinato, schiena neutra: porta la barra al petto stringendo le scapole e scendi con controllo.'),
  ('Rematore alla macchina', 'schiena', 'forza', 'macchina', 'Petto appoggiato al cuscino: tira le maniglie verso l''addome e porta i gomiti indietro, senza spingere con il collo.'),
  ('Rematore su panca inclinata con manubri', 'schiena', 'forza', 'manubri', 'Petto appoggiato alla panca inclinata: tira i manubri verso i fianchi. Elimina lo slancio e protegge la schiena.'),
  ('Rematore al TRX', 'schiena', 'forza', 'TRX', 'Corpo in linea, piedi a terra: tira il petto verso le maniglie stringendo le scapole. Più sei inclinato, più è difficile.'),
  ('Rematore con elastico', 'schiena', 'forza', 'elastico', 'Seduto con le gambe distese e l''elastico ai piedi: tira verso l''addome mantenendo il busto alto.'),
  ('Pulley alto con corda', 'schiena', 'forza', 'cavi', 'In ginocchio davanti alla carrucola alta: tira la corda verso il petto e apri i gomiti stringendo le scapole.'),
  ('Rematore Pendlay', 'schiena', 'forza', 'bilanciere', 'Barra a terra a ogni ripetizione, busto parallelo al pavimento: tira esplosivo verso l''ombelico e ripoggia.'),
  ('Pulley presa neutra', 'schiena', 'forza', 'cavi', 'Impugnatura a V: tira verso l''ombelico con i gomiti stretti, pausa breve e ritorno lento.'),
  ('Pullover ai cavi', 'schiena', 'forza', 'cavi', 'In piedi davanti alla carrucola alta, braccia quasi distese: abbassa la barra fino alle cosce usando i dorsali.'),
  ('Stacco con trap bar', 'schiena', 'forza', 'trap bar', 'Dentro la barra esagonale, schiena neutra: spingi il pavimento con le gambe fino alla posizione eretta. Più semplice dello stacco classico.'),
  ('Superman', 'lombari', 'forza', 'corpo libero', 'A pancia in giù, solleva insieme braccia e gambe, pausa di due secondi e rilascia con controllo.'),
  ('Good morning con bilanciere', 'lombari', 'forza', 'bilanciere', 'Barra sui trapezi, ginocchia appena flesse: porta il bacino indietro inclinando il busto finché senti i femorali, poi risali.'),
  ('Estensioni lombari a terra', 'lombari', 'forza', 'corpo libero', 'A pancia in giù con le mani dietro la nuca, solleva il busto di pochi centimetri e scendi lentamente.'),
  ('Bird dog', 'lombari', 'forza', 'corpo libero', 'In quadrupedia, distendi il braccio e la gamba opposti restando fermo sul busto. Cambia lato a ogni ripetizione.'),
  ('Lento avanti alla macchina', 'spalle', 'forza', 'macchina', 'Schiena aderente, impugnature all''altezza delle spalle: spingi in alto senza bloccare del tutto i gomiti.'),
  ('Arnold press', 'spalle', 'forza', 'manubri', 'Parti con i palmi verso di te e ruota i polsi mentre spingi i manubri in alto. Lavora tutte le parti del deltoide.'),
  ('Alzate laterali ai cavi', 'spalle', 'forza', 'cavi', 'Carrucola bassa, braccio opposto: alza il braccio di lato fino alla spalla. La tensione è costante per tutto il movimento.'),
  ('Alzate laterali alla macchina', 'spalle', 'forza', 'macchina', 'Gomiti sotto i cuscinetti: alza le braccia di lato fino all''altezza delle spalle e scendi lentamente.'),
  ('Alzate frontali con disco', 'spalle', 'forza', 'disco', 'Disco tenuto a due mani: alzalo davanti a te fino all''altezza degli occhi e scendi senza dondolare.'),
  ('Alzate frontali ai cavi', 'spalle', 'forza', 'cavi', 'Di spalle alla carrucola bassa: porta la maniglia davanti a te fino alla spalla con il braccio quasi disteso.'),
  ('Alzate posteriori alla macchina', 'spalle', 'forza', 'macchina', 'Petto contro il cuscino: apri le braccia indietro stringendo le scapole per lavorare i deltoidi posteriori.'),
  ('Rotazioni esterne con elastico', 'spalle', 'forza', 'elastico', 'Gomito a 90° vicino al fianco: ruota l''avambraccio verso l''esterno contro la resistenza. Rinforza la cuffia dei rotatori.'),
  ('Rotazioni esterne ai cavi', 'spalle', 'forza', 'cavi', 'Gomito appoggiato al fianco, carico leggero: ruota l''avambraccio verso l''esterno lentamente e torna.'),
  ('Landmine press', 'spalle', 'forza', 'bilanciere', 'Barra fissata a terra da un lato: spingi l''estremità in diagonale verso l''alto. Percorso naturale e comodo per le spalle.'),
  ('Pike push-up', 'spalle', 'forza', 'corpo libero', 'Bacino alto a V rovesciata: piega i gomiti portando la testa verso il pavimento e spingi. Alternativa al lento avanti.'),
  ('Push press', 'spalle', 'forza', 'bilanciere', 'Piccola spinta con le gambe per lanciare la barra sopra la testa, poi controlla la discesa fino alle spalle.'),
  ('Alzate a T al TRX', 'spalle', 'forza', 'TRX', 'Braccia distese davanti a te, inclinato all''indietro: apri le braccia a T stringendo le scapole.'),
  ('Alzate a Y', 'spalle', 'forza', 'manubri', 'Busto inclinato, manubri leggeri: alza le braccia in diagonale a formare una Y. Rinforza i muscoli stabilizzatori della spalla.'),
  ('Shrug con bilanciere', 'trapezi', 'forza', 'bilanciere', 'Barra davanti alle cosce, braccia distese: alza le spalle verso le orecchie, pausa in alto e scendi piano.'),
  ('Shrug alla macchina', 'trapezi', 'forza', 'macchina', 'Impugnature ai lati del corpo: solleva le spalle senza ruotarle, pausa breve e discesa lenta.'),
  ('Tirata al mento', 'trapezi', 'forza', 'bilanciere', 'Presa poco più larga delle spalle: porta la barra vicino al busto fino al petto con i gomiti più alti dei polsi.'),
  ('Curl su panca inclinata', 'bicipiti', 'forza', 'manubri', 'Seduto sulla panca a 45° con le braccia che pendono dietro il busto: il bicipite lavora in massimo allungamento.'),
  ('Curl concentrato', 'bicipiti', 'forza', 'manubri', 'Seduto, gomito appoggiato all''interno della coscia: porta il manubrio alla spalla e scendi lentamente.'),
  ('Curl con corda ai cavi', 'bicipiti', 'forza', 'cavi', 'Tieni la corda a martello e porta le mani alle spalle, gomiti fermi lungo i fianchi.'),
  ('Curl con elastico', 'bicipiti', 'forza', 'elastico', 'In piedi sull''elastico, gomiti fermi: porta le mani alle spalle e torna senza lasciare l''elastico.'),
  ('Curl al TRX', 'bicipiti', 'forza', 'TRX', 'Inclinato all''indietro con le braccia distese: piega i gomiti portando le mani verso la fronte.'),
  ('Curl alla macchina', 'bicipiti', 'forza', 'macchina', 'Braccia sul cuscino: piega i gomiti e porta le impugnature alle spalle, senza staccare i gomiti.'),
  ('Curl 21', 'bicipiti', 'forza', 'bilanciere', 'Sette ripetizioni dalla metà in basso, sette dalla metà in alto, sette complete: una serie che fa bruciare.'),
  ('Curl spider', 'bicipiti', 'forza', 'manubri', 'Petto appoggiato a una panca inclinata, braccia che pendono: fletti i gomiti senza dondolare.'),
  ('Curl a un braccio al cavo basso', 'bicipiti', 'forza', 'cavi', 'Di lato alla carrucola, braccio lontano: porta la maniglia alla spalla ruotando il polso.'),
  ('Dip alla panca', 'tricipiti', 'forza', 'panca', 'Mani sul bordo di una panca, gambe avanti: piega i gomiti all''indietro scendendo con il bacino e risali.'),
  ('Push down con corda', 'tricipiti', 'forza', 'cavi', 'Gomiti attaccati ai fianchi, spingi la corda verso il basso aprendo le mani a fine corsa.'),
  ('Push down presa inversa', 'tricipiti', 'forza', 'cavi', 'Palmi verso l''alto: spingi la barra in basso con i gomiti fermi. Mette in evidenza la parte interna del tricipite.'),
  ('French press con manubri', 'tricipiti', 'forza', 'manubri', 'Sdraiato sulla panca, piega solo i gomiti portando i manubri ai lati della testa e distendi.'),
  ('Estensioni sopra la testa ai cavi', 'tricipiti', 'forza', 'cavi', 'Di spalle alla carrucola, gomiti vicini alle orecchie: distendi le braccia in avanti e in alto.'),
  ('Estensioni al TRX', 'tricipiti', 'forza', 'TRX', 'Corpo inclinato, mani nelle maniglie: piega i gomiti portando la fronte tra le mani e distendi.'),
  ('Estensioni con elastico', 'tricipiti', 'forza', 'elastico', 'Elastico fissato in alto: spingi verso il basso con i gomiti fermi lungo i fianchi.'),
  ('Dip alla macchina', 'tricipiti', 'forza', 'macchina', 'Seduto, spingi le impugnature verso il basso distendendo i gomiti, schiena aderente allo schienale.'),
  ('JM press', 'tricipiti', 'forza', 'bilanciere', 'Variante a metà tra panca stretta e french press: la barra scende verso il mento e risale con una spinta verticale.'),
  ('Kickback ai cavi', 'tricipiti', 'forza', 'cavi', 'Busto inclinato, gomito alto e fermo: distendi il braccio all''indietro contro il cavo.'),
  ('Curl dei polsi con bilanciere', 'avambracci', 'forza', 'bilanciere', 'Avambracci sulle cosce, palmi verso l''alto: fletti i polsi sollevando la barra solo con le mani.'),
  ('Curl inverso con bilanciere', 'avambracci', 'forza', 'bilanciere', 'Presa dall''alto: porta la barra alle spalle con i gomiti fermi. Lavora avambracci e brachiale.'),
  ('Estensioni dei polsi con manubri', 'avambracci', 'forza', 'manubri', 'Avambracci appoggiati, palmi verso il basso: solleva il dorso della mano e scendi lentamente.'),
  ('Rotazioni dei polsi con bastone', 'avambracci', 'forza', 'bastone', 'Con un bastone appesantito a braccia tese, arrotola la corda per sollevare il peso con la forza dei polsi.'),
  ('Appeso alla sbarra', 'avambracci', 'forza', 'sbarra', 'Afferra la sbarra e resta appeso più a lungo possibile. Migliora la presa e decomprime la schiena.'),
  ('Tenuta con manubri', 'avambracci', 'forza', 'manubri', 'Cammina o resta fermo con due manubri pesanti in mano: allena la presa e gli avambracci.'),
  ('Front squat', 'quadricipiti', 'forza', 'bilanciere', 'Barra appoggiata sulle spalle davanti, gomiti alti: scendi con il busto verticale. Lavora molto quadricipiti e addome.'),
  ('Squat a corpo libero', 'quadricipiti', 'forza', 'corpo libero', 'Piedi larghi come le spalle, braccia avanti: scendi con le anche indietro e le ginocchia in linea con i piedi.'),
  ('Squat con elastico', 'quadricipiti', 'forza', 'elastico', 'Elastico sopra le ginocchia: mantieni le ginocchia aperte mentre scendi e risali. Insegna a usare i glutei.'),
  ('Sissy squat', 'quadricipiti', 'forza', 'corpo libero', 'Appoggiato a un sostegno, inclina il corpo all''indietro piegando le ginocchia: isola i quadricipiti.'),
  ('Box squat', 'quadricipiti', 'forza', 'bilanciere', 'Scendi fino a sfiorare una panca dietro di te, poi spingi sui talloni: aiuta a controllare la profondità.'),
  ('Affondi camminati', 'quadricipiti', 'forza', 'manubri', 'Passo lungo in avanti, ginocchio posteriore vicino al pavimento, poi cambia gamba camminando.'),
  ('Affondi indietro', 'quadricipiti', 'forza', 'manubri', 'Fai un passo indietro e scendi con il ginocchio posteriore: più gentile per le ginocchia dell''affondo in avanti.'),
  ('Pressa orizzontale', 'quadricipiti', 'forza', 'macchina', 'Seduto con la schiena aderente, spingi la pedana con tutto il piede e non bloccare le ginocchia a fine corsa.'),
  ('Leg press monopodalica', 'quadricipiti', 'forza', 'macchina', 'Una gamba alla volta sulla pedana: corregge le differenze di forza tra le due gambe.'),
  ('Wall sit', 'quadricipiti', 'forza', 'corpo libero', 'Schiena al muro, cosce parallele al pavimento: resta fermo il tempo indicato (indica i secondi nelle ripetizioni).'),
  ('Squat assistito al TRX', 'quadricipiti', 'forza', 'TRX', 'Reggiti alle maniglie per equilibrio mentre scendi in squat profondo: ottimo per imparare il movimento.'),
  ('Pistol squat assistito', 'quadricipiti', 'forza', 'corpo libero', 'Squat su una gamba sola tenendoti a un sostegno; la gamba libera resta distesa avanti.'),
  ('Squat con fitball al muro', 'quadricipiti', 'forza', 'fitball', 'La palla tra schiena e muro ti guida nel movimento: scendi con il busto verticale e risali.'),
  ('Step-up laterale', 'quadricipiti', 'forza', 'panca', 'Di lato alla panca, sali con la gamba vicina spingendo sul tallone e scendi lentamente dall''altra parte.'),
  ('Leg curl seduto', 'femorali', 'forza', 'macchina', 'Schiena aderente, cuscino sopra le caviglie: porta i talloni sotto il sedile e torna piano.'),
  ('Leg curl in piedi', 'femorali', 'forza', 'macchina', 'Una gamba alla volta: porta il tallone verso il gluteo senza inarcare la schiena.'),
  ('Stacco rumeno monopodalico', 'femorali', 'forza', 'manubri', 'In equilibrio su una gamba, porta il busto in avanti e la gamba libera indietro; torna spingendo il bacino in avanti.'),
  ('Stacco a gambe tese', 'femorali', 'forza', 'bilanciere', 'Gambe quasi distese, schiena neutra: la barra scende lungo le gambe finché senti il massimo stiramento dei femorali.'),
  ('Nordic curl assistito', 'femorali', 'forza', 'corpo libero', 'In ginocchio con i piedi bloccati, lasciati cadere in avanti frenando con i femorali e aiutati con le mani.'),
  ('Curl femorali con fitball', 'femorali', 'forza', 'fitball', 'Sdraiato con i talloni sulla palla, solleva il bacino e porta la palla verso i glutei piegando le ginocchia.'),
  ('Curl femorali con slider', 'femorali', 'forza', 'slider', 'Talloni sugli slider, bacino alto: fai scivolare i piedi verso i glutei e ritorna con controllo.'),
  ('Stacco rumeno con manubri', 'femorali', 'forza', 'manubri', 'Manubri vicini alle cosce, ginocchia appena flesse: spingi il bacino indietro e risali contraendo glutei e femorali.'),
  ('Curl femorali al TRX', 'femorali', 'forza', 'TRX', 'Sdraiato con i talloni nelle maniglie: solleva il bacino e porta i talloni verso i glutei.'),
  ('Stacco alla macchina', 'femorali', 'forza', 'macchina', 'Schiena aderente e impugnature alte: spingi con le gambe fino alla posizione eretta, in modo guidato.'),
  ('Hip thrust monopodalico', 'glutei', 'forza', 'corpo libero', 'Spalle su una panca, una gamba sola in appoggio: spingi il bacino verso l''alto e controlla la discesa.'),
  ('Hip thrust al multipower', 'glutei', 'forza', 'multipower', 'Barra guidata sul bacino, schiena alta su una panca: spingi in alto e stringi i glutei per un secondo.'),
  ('Hip thrust con elastico', 'glutei', 'forza', 'elastico', 'Elastico sopra le ginocchia: spingi il bacino in alto mantenendo le ginocchia aperte.'),
  ('Ponte glutei con elastico', 'glutei', 'forza', 'elastico', 'Sdraiato, elastico sopra le ginocchia: solleva il bacino e premi le ginocchia verso l''esterno.'),
  ('Calci all''indietro in quadrupedia', 'glutei', 'forza', 'corpo libero', 'In quadrupedia, spingi un tallone verso il soffitto con il ginocchio piegato, senza inarcare la schiena.'),
  ('Kickback glutei con cavigliera', 'glutei', 'forza', 'cavi', 'Cavigliera alla carrucola bassa: porta la gamba indietro con il ginocchio quasi disteso e stringi il gluteo.'),
  ('Stacco sumo', 'glutei', 'forza', 'bilanciere', 'Piedi larghi, punte aperte, presa stretta: spingi con le gambe e distendi le anche. Coinvolge glutei e interno coscia.'),
  ('Step-up alto', 'glutei', 'forza', 'panca', 'Su una panca alta, sali spingendo con il tallone della gamba di appoggio e scendi lentamente.'),
  ('Glute kickback alla macchina', 'glutei', 'forza', 'macchina', 'Appoggiato sul petto, spingi la pedana all''indietro con una gamba alla volta.'),
  ('Pull-through ai cavi', 'glutei', 'forza', 'cavi', 'Di spalle alla carrucola bassa, porta il bacino indietro e poi in avanti stringendo i glutei: la corda passa tra le gambe.'),
  ('Affondo con passo lungo', 'glutei', 'forza', 'manubri', 'Passo molto lungo in avanti con il busto leggermente inclinato: aumenta il lavoro dei glutei.'),
  ('Adduzioni alla macchina', 'adduttori', 'forza', 'macchina', 'Seduto, chiudi le gambe contro i cuscinetti in modo controllato, senza scatti.'),
  ('Adduzioni ai cavi', 'adduttori', 'forza', 'cavi', 'Cavigliera alla carrucola bassa: porta la gamba davanti all''altra, in piedi e ben stabile.'),
  ('Squat sumo con manubrio', 'adduttori', 'forza', 'manubri', 'Piedi molto larghi con le punte aperte, manubrio tra le gambe: scendi con il busto eretto.'),
  ('Affondi laterali', 'adduttori', 'forza', 'manubri', 'Fai un passo di lato piegando una gamba mentre l''altra resta distesa; spingi per tornare al centro.'),
  ('Copenhagen plank', 'adduttori', 'forza', 'panca', 'Plank laterale con la gamba alta appoggiata su una panca: stringi la gamba per sollevare l''altra.'),
  ('Adduzioni con elastico', 'adduttori', 'forza', 'elastico', 'Elastico alla caviglia fissato di lato: porta la gamba verso l''altra contro la resistenza.'),
  ('Adduzioni con fitball', 'adduttori', 'forza', 'fitball', 'Sdraiato con una palla tra le ginocchia: schiaccia la palla e mantieni la contrazione per qualche secondo.'),
  ('Abduzioni sdraiato su un fianco', 'abduttori', 'forza', 'corpo libero', 'Sdraiato di lato, solleva la gamba alta con il piede in linea e scendi lentamente.'),
  ('Clamshell con elastico', 'abduttori', 'forza', 'elastico', 'Sdraiato di lato con le ginocchia piegate: apri il ginocchio alto come una conchiglia, tenendo i piedi uniti.'),
  ('Camminata laterale con elastico', 'abduttori', 'forza', 'elastico', 'Elastico sopra le ginocchia, mezzo squat: fai passi laterali mantenendo la tensione.'),
  ('Abduzioni ai cavi', 'abduttori', 'forza', 'cavi', 'Cavigliera alla carrucola bassa: porta la gamba di lato senza ruotare il busto.'),
  ('Fire hydrant', 'abduttori', 'forza', 'corpo libero', 'In quadrupedia, solleva il ginocchio di lato come un cane davanti a un idrante, senza spostare il bacino.'),
  ('Calf alla pressa', 'polpacci', 'forza', 'macchina', 'Sulla pressa, spingi la pedana con la punta dei piedi estendendo le caviglie e torna in massimo allungamento.'),
  ('Calf monopodalico', 'polpacci', 'forza', 'corpo libero', 'Su un gradino, una gamba alla volta: sali sulla punta e scendi sotto il livello del gradino.'),
  ('Calf al multipower', 'polpacci', 'forza', 'multipower', 'Barra sulle spalle, punte su un rialzo: sali con controllo, pausa in alto e discesa completa.'),
  ('Calf su step', 'polpacci', 'forza', 'step', 'Punte sul bordo dello step, talloni nel vuoto: sali e scendi lentamente per tutta l''escursione.'),
  ('Tibiale anteriore con elastico', 'polpacci', 'forza', 'elastico', 'Seduto con l''elastico sul collo del piede: porta la punta verso di te e torna piano. Utile contro i dolori da corsa.'),
  ('Crunch inverso', 'addome', 'forza', 'corpo libero', 'Sdraiato, porta le ginocchia al petto sollevando il bacino dal pavimento e torna piano.'),
  ('Crunch bicicletta', 'addome', 'forza', 'corpo libero', 'Sdraiato, porta alternativamente il gomito al ginocchio opposto pedalando con le gambe.'),
  ('Crunch alla macchina', 'addome', 'forza', 'macchina', 'Seduto, arrotola il busto in avanti contraendo l''addome e torna senza perdere la tensione.'),
  ('V-up', 'addome', 'forza', 'corpo libero', 'Sdraiato, solleva insieme busto e gambe tese per toccare i piedi formando una V.'),
  ('Dead bug', 'addome', 'forza', 'corpo libero', 'Sdraiato con braccia e gambe in alto, distendi braccio e gamba opposti tenendo la schiena aderente al pavimento.'),
  ('Hollow hold', 'addome', 'forza', 'corpo libero', 'Sdraiato, solleva spalle e gambe tese e resta fermo con la zona lombare incollata a terra.'),
  ('Pallof press', 'addome', 'forza', 'cavi', 'Di lato alla carrucola, spingi le mani davanti al petto senza farti ruotare: allena la resistenza alla rotazione.'),
  ('Wood chop ai cavi', 'addome', 'forza', 'cavi', 'Dal cavo alto al basso in diagonale, ruotando il busto e i fianchi come per tagliare la legna.'),
  ('Plank con tocco della spalla', 'addome', 'forza', 'corpo libero', 'In posizione di plank alta, tocca alternativamente la spalla opposta senza far ruotare il bacino.'),
  ('Plank dinamico', 'addome', 'forza', 'corpo libero', 'Passa dagli avambracci alle mani e viceversa tenendo il corpo in linea.'),
  ('Sollevamento ginocchia alla sbarra', 'addome', 'forza', 'sbarra', 'Appeso, porta le ginocchia al petto arrotolando il bacino, senza dondolare.'),
  ('Sit-up', 'addome', 'forza', 'corpo libero', 'Sdraiato con i piedi bloccati, porta il busto fino in verticale e scendi con controllo.'),
  ('Side bend con manubrio', 'addome', 'forza', 'manubri', 'In piedi con un manubrio in una mano, inclinati lateralmente e risali contraendo l''obliquo.'),
  ('Flutter kick', 'addome', 'forza', 'corpo libero', 'Sdraiato con le gambe tese a pochi centimetri da terra, fai piccoli battiti alternati.'),
  ('Toes to bar', 'addome', 'forza', 'sbarra', 'Appeso alla sbarra, porta i piedi fino a toccarla con il controllo del busto.'),
  ('Crunch su fitball', 'addome', 'forza', 'fitball', 'Con la schiena appoggiata alla palla, solleva il busto in un movimento ampio e controllato.'),
  ('Rotazioni con palla medica al muro', 'addome', 'forza', 'palla medica', 'Seduto o in piedi di lato al muro, ruota il busto e lancia la palla contro la parete riprendendola.'),
  ('Body saw sul TRX', 'addome', 'forza', 'TRX', 'In plank con i piedi nelle maniglie, fai oscillare il corpo avanti e indietro con piccoli movimenti.'),
  ('Assault bike', 'cardio', 'cardio', 'assault bike', 'Bicicletta ad aria con braccia e gambe: ottima per intervalli brevi e intensi (indica secondi o calorie).'),
  ('Sci-erg', 'cardio', 'cardio', 'sci-erg', 'Tira le maniglie dall''alto verso il basso come nello sci di fondo, usando busto e braccia.'),
  ('Camminata inclinata', 'cardio', 'cardio', 'tapis roulant', 'Cammina a passo svelto con pendenza elevata: ideale per consumare calorie con poco impatto.'),
  ('Corsa a intervalli', 'cardio', 'cardio', 'tapis roulant', 'Alterna frazioni veloci e frazioni di recupero (per esempio 1 minuto veloce e 2 minuti lenti).'),
  ('Stepper', 'cardio', 'cardio', 'stepper', 'Sali i gradini della macchina a ritmo costante, senza appoggiarti al corrimano.'),
  ('Vogatore a intervalli', 'cardio', 'cardio', 'vogatore', 'Alterna frazioni di vogata intensa a frazioni di recupero attivo.'),
  ('Shadow boxing', 'cardio', 'cardio', 'corpo libero', 'Combinazioni di pugni a vuoto con spostamenti, come in un allenamento di boxe senza avversario.'),
  ('Jumping jack', 'cardio', 'cardio', 'corpo libero', 'Salta aprendo gambe e braccia insieme e richiudile al salto successivo; ritmo regolare.'),
  ('Ginocchia alte sul posto', 'cardio', 'cardio', 'corpo libero', 'Corri sul posto portando le ginocchia all''altezza del bacino, spingendo con le braccia.'),
  ('Turkish get-up', 'total_body', 'funzionale', 'kettlebell', 'Dalla posizione sdraiata alla posizione in piedi con un kettlebell sempre alto sopra la testa, in fasi controllate.'),
  ('Clean con kettlebell', 'total_body', 'funzionale', 'kettlebell', 'Porta il kettlebell dal pavimento all''appoggio sull''avambraccio con un movimento fluido delle anche.'),
  ('Snatch con kettlebell', 'total_body', 'funzionale', 'kettlebell', 'Dal basso a sopra la testa in un unico gesto esplosivo, poi controlla la discesa.'),
  ('Swing a un braccio', 'total_body', 'funzionale', 'kettlebell', 'Come lo swing classico ma con una mano sola: il bacino spinge, il braccio guida soltanto.'),
  ('Spinta della slitta', 'total_body', 'funzionale', 'slitta', 'Busto inclinato, passi corti e potenti: spingi la slitta per la distanza indicata.'),
  ('Trazione della slitta', 'total_body', 'funzionale', 'slitta', 'Cammina all''indietro tirando la slitta con una corda: lavoro intenso per gambe e schiena.'),
  ('Battle rope', 'total_body', 'funzionale', 'corde', 'Onde alternate o simultanee con le due corde, in mezzo squat, per il tempo indicato.'),
  ('Slam ball', 'total_body', 'funzionale', 'palla medica', 'Solleva la palla sopra la testa e schiacciala a terra con forza, poi raccoglila ed esegui di nuovo.'),
  ('Wall ball', 'total_body', 'funzionale', 'palla medica', 'Squat con la palla al petto e, risalendo, lancio contro un bersaglio sul muro; riprendi e ripeti.'),
  ('Man maker', 'total_body', 'funzionale', 'manubri', 'Piegamento, rematore con ciascun manubrio, ritorno in piedi e spinta sopra la testa in sequenza.'),
  ('Bear crawl', 'total_body', 'funzionale', 'corpo libero', 'Cammina a quattro zampe con le ginocchia a pochi centimetri da terra, schiena piatta.'),
  ('Sprawl', 'total_body', 'funzionale', 'corpo libero', 'Da in piedi scendi a terra con le gambe distese all''indietro e ritorna in piedi con una spinta rapida.'),
  ('Clean and press con manubri', 'total_body', 'funzionale', 'manubri', 'Porta i manubri alle spalle con un movimento esplosivo e spingili sopra la testa.'),
  ('Bulgarian bag spin', 'total_body', 'funzionale', 'Bulgarian bag', 'Ruota la sacca attorno alla testa e al busto in cerchi controllati: lavoro di spalle, core e coordinazione.'),
  ('Bulgarian bag clean e squat', 'total_body', 'funzionale', 'Bulgarian bag', 'Porta la sacca sulle spalle con uno strappo e scendi in squat, poi risali e ripeti.'),
  ('Trasporto del sacco in spalla', 'total_body', 'funzionale', 'sacco', 'Carica un sacco sulla spalla e cammina mantenendo il busto stabile; cambia lato a metà distanza.'),
  ('Devil press', 'total_body', 'funzionale', 'manubri', 'Piegamento a terra sui manubri e subito dopo strappo di entrambi sopra la testa.'),
  ('Squat e lancio della palla medica', 'total_body', 'funzionale', 'palla medica', 'Scendi in squat con la palla al petto e lanciala in alto o in avanti con una spinta di tutto il corpo.'),
  ('Box jump', 'quadricipiti', 'pliometria', 'cassone', 'Salto a piedi uniti su un cassone con atterraggio morbido e ginocchia in asse; scendi camminando.'),
  ('Squat jump', 'quadricipiti', 'pliometria', 'corpo libero', 'Scendi in squat e salta più in alto possibile, atterra morbido e ripeti.'),
  ('Salto in lungo da fermo', 'quadricipiti', 'pliometria', 'corpo libero', 'Spingi le braccia avanti, salta il più lontano possibile e atterra stabile sui due piedi.'),
  ('Affondi con salto', 'quadricipiti', 'pliometria', 'corpo libero', 'In affondo, salta cambiando gamba a mezz''aria e atterra di nuovo in affondo.'),
  ('Salto con ginocchia al petto', 'quadricipiti', 'pliometria', 'corpo libero', 'Salta in alto portando le ginocchia verso il petto e atterra ammortizzando.'),
  ('Depth jump', 'quadricipiti', 'pliometria', 'cassone', 'Scendi da un cassone, appena a terra salta subito più in alto possibile. Esercizio avanzato.'),
  ('Hurdle hop', 'quadricipiti', 'pliometria', 'ostacoli', 'Salti consecutivi a piedi uniti sopra una serie di ostacoli bassi, con contatti rapidi a terra.'),
  ('Balzi alternati', 'quadricipiti', 'pliometria', 'corpo libero', 'Passi lunghi e spinti, quasi saltati, da una gamba all''altra per la distanza indicata.'),
  ('Salti laterali dello skater', 'glutei', 'pliometria', 'corpo libero', 'Salta da un lato all''altro atterrando su una gamba sola, con il busto leggermente inclinato in avanti.'),
  ('Piegamenti pliometrici', 'petto', 'pliometria', 'corpo libero', 'Spingi forte fino a staccare le mani dal pavimento e riatterra con i gomiti morbidi.'),
  ('Lancio della palla medica sopra la testa', 'total_body', 'pliometria', 'palla medica', 'Dal basso, lancia la palla in alto e all''indietro con una potente estensione di tutto il corpo.'),
  ('Mobilità caviglia al muro', 'mobilita', 'mobilita', 'corpo libero', 'Piede a pochi centimetri dal muro: porta il ginocchio verso il muro senza staccare il tallone.'),
  ('World''s greatest stretch', 'mobilita', 'mobilita', 'corpo libero', 'In affondo con una mano a terra, ruota il busto aprendo il braccio verso l''alto. Mobilizza anche, busto e spalle.'),
  ('Rotazioni toraciche in quadrupedia', 'mobilita', 'mobilita', 'corpo libero', 'Una mano dietro la nuca, ruota il gomito verso il soffitto e poi verso il braccio d''appoggio.'),
  ('Mobilità delle anche con elastico', 'mobilita', 'mobilita', 'elastico', 'Elastico attorno alla coscia: fai cerchi lenti con il ginocchio, in quadrupedia o a terra.'),
  ('Estensione toracica sul foam roller', 'mobilita', 'mobilita', 'foam roller', 'Con il rullo sotto la parte alta della schiena, estendi il busto all''indietro respirando lentamente.'),
  ('Cerchi con le braccia', 'mobilita', 'mobilita', 'corpo libero', 'Braccia distese ai lati: disegna cerchi piccoli e poi grandi, avanti e indietro.'),
  ('Open book', 'mobilita', 'mobilita', 'corpo libero', 'Sdraiato di lato con le ginocchia piegate, apri il braccio alto come un libro e ruota il busto.'),
  ('Squat profondo con tenuta', 'mobilita', 'mobilita', 'corpo libero', 'Scendi in squat più profondo che puoi con i talloni a terra e resta in posizione respirando.'),
  ('Mobilità dei polsi', 'mobilita', 'mobilita', 'corpo libero', 'In quadrupedia, sposta lentamente il peso avanti e indietro con i palmi o il dorso della mano a terra.'),
  ('Circonduzioni del bacino', 'mobilita', 'mobilita', 'corpo libero', 'In piedi, mani sui fianchi, disegna cerchi ampi con il bacino in entrambe le direzioni.'),
  ('Flessioni scapolari', 'mobilita', 'mobilita', 'corpo libero', 'In posizione di plank, lascia scendere il petto tra le scapole e poi allontana il pavimento senza piegare i gomiti.'),
  ('Pass-through con elastico', 'mobilita', 'mobilita', 'elastico', 'Porta l''elastico dalla pancia dietro la schiena a braccia distese, e ritorna. Apre le spalle.'),
  ('Stretching quadricipiti in piedi', 'mobilita', 'stretching', 'corpo libero', 'In piedi, afferra il piede dietro di te e avvicina il tallone al gluteo tenendo le ginocchia vicine. Tieni 30 secondi.'),
  ('Stretching polpacci al muro', 'mobilita', 'stretching', 'corpo libero', 'Mani al muro, una gamba indietro con il tallone a terra: spingi il bacino in avanti. Tieni 30 secondi.'),
  ('Posizione del bambino', 'mobilita', 'stretching', 'corpo libero', 'In ginocchio, siediti sui talloni e allunga le braccia in avanti; respira e allunga la schiena.'),
  ('Stretching adduttori a farfalla', 'mobilita', 'stretching', 'corpo libero', 'Seduto con le piante dei piedi unite, lascia cadere le ginocchia verso il pavimento. Tieni 30 secondi.'),
  ('Stretching glutei a figura quattro', 'mobilita', 'stretching', 'corpo libero', 'Sdraiato, appoggia una caviglia sul ginocchio opposto e porta la gamba verso il petto.'),
  ('Stretching flessori dell''anca in affondo', 'mobilita', 'stretching', 'corpo libero', 'In affondo con il ginocchio posteriore a terra, spingi il bacino in avanti fino a sentire lo stiramento davanti all''anca.'),
  ('Stretching tricipiti', 'mobilita', 'stretching', 'corpo libero', 'Porta una mano dietro la schiena passando dietro la testa e spingi delicatamente il gomito con l''altra mano.'),
  ('Stretching spalle a braccio incrociato', 'mobilita', 'stretching', 'corpo libero', 'Porta un braccio disteso davanti al petto e tiralo verso di te con l''altra mano.'),
  ('Stretching bicipiti alla parete', 'mobilita', 'stretching', 'corpo libero', 'Mano aperta sul muro all''altezza della spalla, ruota il busto in direzione opposta con il braccio disteso.'),
  ('Stretching laterale del collo', 'mobilita', 'stretching', 'corpo libero', 'Incli la testa di lato e lascia che il peso del braccio opposto aumenti lo stiramento. Senza forzare.'),
  ('Rilascio miofasciale dei dorsali sul foam roller', 'mobilita', 'stretching', 'foam roller', 'Rullo sotto la schiena: fai scorrere lentamente il corpo avanti e indietro sulle zone tese.'),
  ('Rilascio miofasciale dei glutei con pallina', 'mobilita', 'stretching', 'pallina', 'Siediti su una pallina e muovi il bacino finché trovi un punto sensibile; respira e resta qualche secondo.'),
  ('Stretching lombare con ginocchia al petto', 'mobilita', 'stretching', 'corpo libero', 'Sdraiato, porta le ginocchia al petto e abbracciale; dondola dolcemente a destra e a sinistra.'),
  ('Stretching del quadrato dei lombi', 'mobilita', 'stretching', 'corpo libero', 'In piedi o seduto, inclinati lateralmente con un braccio sopra la testa fino a sentire lo stiramento del fianco.')
on conflict do nothing;
-- </seed-esercizi>

-- ───────── Dopo l'esecuzione ─────────
-- 1. Registrati dall'app con la tua email, poi nomina te stesso titolare (sostituisci l'email):
--      update profiles set role = 'owner' where email = 'EMAIL-TITOLARE';
-- 2. Per limitare le registrazioni ai soci della palestra scegli un codice (poi comunicalo ai soci):
--      update gym_settings set name = 'NOME PALESTRA', join_code = 'CODICE';
--    Con join_code vuoto chiunque può registrarsi (vede solo il catalogo esercizi, mai i dati degli altri soci).
-- 3. Nell'app, dalla scheda Altro > Collaboratori, il titolare può promuovere un socio a PT.
-- 4. Verifica in Storage che esistano i contenitori «documents» (privato) e «exercise-media» (pubblico): li crea questo script.
