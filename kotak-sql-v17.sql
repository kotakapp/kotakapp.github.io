-- KotakApp v17: обратная связь (Supabase → SQL Editor → Run)
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bug','idea')),
  text text not null check (char_length(text) between 5 and 1500),
  app_version text,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists "feedback insert own" on public.feedback;
create policy "feedback insert own" on public.feedback
  for insert to authenticated with check (user_id = auth.uid());
-- читать сообщения можно только в Supabase → Table Editor (владелец проекта)
