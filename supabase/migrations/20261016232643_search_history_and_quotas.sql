
-- Company subscriptions and free-search quotas
create table public.company_plans (
  company_id uuid primary key
    references public.companies(id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free', 'paid')),
  searches_used integer not null default 0
    check (searches_used >= 0),
  free_search_limit integer not null default 5
    check (free_search_limit >= 0),
  updated_at timestamptz not null default now()
);

-- Initialize a free plan for each existing company
insert into public.company_plans (company_id)
select id from public.companies
on conflict (company_id) do nothing;

-- Automatically initialize plans for future companies
create function public.create_company_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.company_plans (company_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_company_created
after insert on public.companies
for each row
execute function public.create_company_plan();

-- Saved searches
create table public.searches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null
    references public.companies(id) on delete cascade,
  recruiter_id uuid not null
    references auth.users(id) on delete cascade,
  brief text not null,
  filters jsonb not null,
  total integer not null default 0,
  created_at timestamptz not null default now()
);

create index searches_company_created_idx
on public.searches (company_id, created_at desc);

-- Snapshot the ordered candidate IDs for stable pagination
create table public.search_results (
  search_id uuid not null
    references public.searches(id) on delete cascade,
  candidate_id text not null
    references public.candidates(id) on delete cascade,
  position integer not null,
  rank_score integer not null default 0,
  primary key (search_id, candidate_id),
  unique (search_id, position)
);

create index search_results_pagination_idx
on public.search_results (search_id, position);

-- Restrict direct table access
alter table public.company_plans enable row level security;
alter table public.searches enable row level security;
alter table public.search_results enable row level security;

-- Recruiters can read their own company's plan
create policy "Recruiters read company plan"
on public.company_plans
for select to authenticated
using (
  company_id in (
    select company_id from public.recruiters
    where id = (select auth.uid())
  )
);

-- Recruiters can read searches belonging to their company
create policy "Recruiters read company searches"
on public.searches
for select to authenticated
using (
  company_id in (
    select company_id from public.recruiters
    where id = (select auth.uid())
  )
);

-- Recruiters can read results from their company's searches
create policy "Recruiters read company search results"
on public.search_results
for select to authenticated
using (
  search_id in (
    select id from public.searches
    where company_id in (
      select company_id from public.recruiters
      where id = (select auth.uid())
    )
  )
);

-- No direct client insert/update/delete policies.
-- Server-side operations will handle quota consumption and writes.
