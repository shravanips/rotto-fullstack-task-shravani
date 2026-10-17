
create table public.saved_briefs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null
    references public.companies(id) on delete cascade,
  recruiter_id uuid not null
    references auth.users(id),
  brief text not null
    check (char_length(trim(brief)) between 1 and 2000),
  filters jsonb not null default '{}'::jsonb
    check (jsonb_typeof(filters) = 'object'),
  created_at timestamptz not null default now()
);

create index saved_briefs_company_idx
on public.saved_briefs (company_id, created_at desc);

alter table public.saved_briefs enable row level security;

create policy "Read company saved briefs"
on public.saved_briefs
for select to authenticated
using (
  company_id in (
    select r.company_id
    from public.recruiters r
    where r.id = (select auth.uid())
  )
);
