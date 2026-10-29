-- Finto ambiente Supabase per provare setup.sql su un Postgres normale (non serve su Supabase vero).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema net;
create function net.http_post(url text, body jsonb default null) returns bigint language plpgsql as $$ begin insert into public.__pushlog(url, body) values (url, body); return 1; end $$;
create schema public_stub;
create table public.__pushlog (url text, body jsonb);
grant usage on schema public, auth to anon, authenticated;
-- come in Supabase: i ruoli anon e authenticated ricevono per default i permessi su ciò che si crea in public
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
grant all on public.__pushlog to anon, authenticated;
grant execute on function net.http_post(text, jsonb) to anon, authenticated;
grant usage on schema net to anon, authenticated;

-- Storage: solo le tabelle che servono alle regole sui file (nel Supabase vero ci sono già)
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects, storage.buckets to authenticated;
