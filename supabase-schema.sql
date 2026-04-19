create table if not exists public.rooms (
  room_key text primary key,
  admin_id text not null,
  admin_name text not null,
  created_at timestamp with time zone default now()
);

alter table public.rooms enable row level security;

drop policy if exists "allow public room read" on public.rooms;
create policy "allow public room read"
  on public.rooms
  for select
  to anon, authenticated
  using (true);

drop policy if exists "allow auth room create" on public.rooms;
create policy "allow auth room create"
  on public.rooms
  for insert
  to authenticated
  with check (true);
