
-- Shortlists belong to a company.
create table public.shortlists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null
    references public.companies(id) on delete cascade,
  name text not null
    check (char_length(trim(name)) between 1 and 120),
  created_by uuid not null
    references auth.users(id),
  created_at timestamptz not null default now()
);

create index shortlists_company_idx
on public.shortlists (company_id, created_at desc);

-- Candidates saved to a shortlist.
create table public.shortlist_people (
  shortlist_id uuid not null
    references public.shortlists(id) on delete cascade,
  candidate_id text not null
    references public.candidates(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (shortlist_id, candidate_id)
);

create index shortlist_people_candidate_idx
on public.shortlist_people (candidate_id);

-- Enable row-level security.
alter table public.shortlists enable row level security;
alter table public.shortlist_people enable row level security;

-- Recruiters can read shortlists from their own company.
create policy "Read company shortlists"
on public.shortlists
for select to authenticated
using (
  company_id in (
    select company_id
    from public.recruiters
    where id = (select auth.uid())
  )
);

-- Recruiters can read candidates saved in their company's shortlists.
create policy "Read company shortlist people"
on public.shortlist_people
for select to authenticated
using (
  shortlist_id in (
    select s.id
    from public.shortlists s
    where s.company_id in (
      select r.company_id
      from public.recruiters r
      where r.id = (select auth.uid())
    )
  )
);

-- Writes will be handled by authenticated server API routes.
-- No direct client write policies are granted.
