-- Schede palestra: setup completo Supabase (v1.0)
-- Per un progetto Supabase NUOVO e vuoto (regione UE, per i dati dei soci): incolla tutto nel SQL Editor ed esegui una volta.
-- In fondo: elenco esercizi di partenza e, in commento, i passaggi da fare dopo (titolare, codice palestra).

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
