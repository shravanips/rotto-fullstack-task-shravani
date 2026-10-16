
create table public.candidates (
  id text primary key,
  full_name text not null,
  avatar_url text,
  headline text,
  current_title text,
  current_company text,
  current_company_logo_url text,
  role text not null,
  seniority text not null,
  years_experience numeric not null,
  location jsonb not null,
  open_to_work boolean not null,
  skills text[] not null default '{}',
  experiences jsonb not null default '[]',
  education jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index candidates_role_idx
  on public.candidates (role);

create index candidates_seniority_idx
  on public.candidates (seniority);

create index candidates_years_experience_idx
  on public.candidates (years_experience);

create index candidates_open_to_work_idx
  on public.candidates (open_to_work);

create index candidates_skills_idx
  on public.candidates using gin (skills);

create index candidates_location_idx
  on public.candidates using gin (location);

create index candidates_experiences_idx
  on public.candidates using gin (experiences);

alter table public.candidates enable row level security;

create policy "Authenticated recruiters can read candidates"
on public.candidates
for select
to authenticated
using (
  exists (
    select 1
    from public.recruiters r
    where r.id = (select auth.uid())
  )
);
