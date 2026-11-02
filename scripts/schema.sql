-- Paste this whole file into the Supabase SQL editor (SQL Editor -> New query) and press Run.
-- Safe to run more than once.
-- One table holds every collection (tracks, days, progress, ...) as JSON documents, one row per doc.
create table if not exists public.atracker_docs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  collection text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

alter table public.atracker_docs enable row level security;

drop policy if exists "own docs" on public.atracker_docs;
create policy "own docs" on public.atracker_docs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Live sync between phone and laptop.
alter table public.atracker_docs replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'atracker_docs') then
    alter publication supabase_realtime add table public.atracker_docs;
  end if;
end $$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('outlines','outlines',false,20971520,array['application/pdf','text/html'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "own atracker outlines" on storage.objects;
create policy "own atracker outlines" on storage.objects for all to authenticated
using (bucket_id='outlines' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='outlines' and (storage.foldername(name))[1]=auth.uid()::text);


-- Do not rely on project-specific default grants.
grant select, insert, update, delete on public.atracker_docs to authenticated;
grant all on public.atracker_docs to service_role;
revoke all on public.atracker_docs from anon;
-- Keep timestamps correct for CLI/helper writes too.
create or replace function public.atracker_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists atracker_updated_at on public.atracker_docs;
create trigger atracker_updated_at before update on public.atracker_docs
for each row execute function public.atracker_touch_updated_at();
