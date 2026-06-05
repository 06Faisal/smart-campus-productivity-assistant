-- Smart Campus Productivity Assistant
-- SQL Schema to initialize tables in Supabase
-- Copy and run this script in your Supabase project SQL Editor (https://supabase.com)

-- 1. Calendar Events Table
create table if not exists public.events (
  id text primary key,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  description text,
  type text not null check (type in ('class', 'exam', 'assignment', 'study_session', 'other')),
  course text,
  created_at timestamptz default now()
);

-- Enable read/write access for everyone (or configure policies as needed)
alter table public.events enable row level security;
create policy "Allow public read access to events" on public.events for select using (true);
create policy "Allow public insert to events" on public.events for insert with check (true);
create policy "Allow public update to events" on public.events for update using (true);
create policy "Allow public delete to events" on public.events for delete using (true);


-- 2. Tasks Table
create table if not exists public.tasks (
  id text primary key,
  title text not null,
  completed boolean not null default false,
  due_date timestamptz,
  priority text not null check (priority in ('urgent_important', 'not_urgent_important', 'urgent_not_important', 'not_urgent_not_important')),
  pomodoro_count integer not null default 0,
  created_at timestamptz default now()
);

alter table public.tasks enable row level security;
create policy "Allow public read access to tasks" on public.tasks for select using (true);
create policy "Allow public insert to tasks" on public.tasks for insert with check (true);
create policy "Allow public update to tasks" on public.tasks for update using (true);
create policy "Allow public delete to tasks" on public.tasks for delete using (true);


-- 3. Lecture Summaries Table
create table if not exists public.lectures (
  id text primary key,
  title text not null,
  created_at timestamptz not null default now(),
  summary text not null,
  transcript text,
  flashcards jsonb not null default '[]'::jsonb,
  quiz jsonb not null default '[]'::jsonb
);

alter table public.lectures enable row level security;
create policy "Allow public read access to lectures" on public.lectures for select using (true);
create policy "Allow public insert to lectures" on public.lectures for insert with check (true);
create policy "Allow public update to lectures" on public.lectures for update using (true);
create policy "Allow public delete to lectures" on public.lectures for delete using (true);


-- 4. Study Plans Table
create table if not exists public.study_plans (
  id text primary key,
  title text not null,
  created_at timestamptz not null default now(),
  content text not null,
  schedule_applied boolean not null default false
);

alter table public.study_plans enable row level security;
create policy "Allow public read access to study_plans" on public.study_plans for select using (true);
create policy "Allow public insert to study_plans" on public.study_plans for insert with check (true);
create policy "Allow public update to study_plans" on public.study_plans for update using (true);
create policy "Allow public delete to study_plans" on public.study_plans for delete using (true);
