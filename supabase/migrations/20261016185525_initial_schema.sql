
-- Rotto initial database schema
-- Migration 1: Companies and recruiters

create extension if not exists pgcrypto;

-- Companies are the security boundary for recruiter-owned data.
create table public.companies (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null,
    created_at timestamptz not null default now()
);

-- Each authenticated recruiter belongs to one company.
create table public.recruiters (
    id uuid primary key references auth.users(id) on delete cascade,
    company_id uuid not null references public.companies(id),
    email text not null,
    created_at timestamptz not null default now()
);

create index recruiters_company_id_idx
    on public.recruiters(company_id);

-- Enable RLS immediately.
alter table public.companies enable row level security;
alter table public.recruiters enable row level security;

-- Recruiters can read only their own membership record.
create policy "Recruiters can view their own profile"
on public.recruiters
for select
to authenticated
using (id = (select auth.uid()));

-- Recruiters can view only their own company.
create policy "Recruiters can view their own company"
on public.companies
for select
to authenticated
using (
    exists (
        select 1
        from public.recruiters r
        where r.company_id = companies.id
          and r.id = (select auth.uid())
    )
);
