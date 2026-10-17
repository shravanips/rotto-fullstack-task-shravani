-- Restore the full ranked result set for pagination.
-- The API requests up to 5000 matching candidates.


create or replace function public.search_candidates(
  p_role text default null,
  p_seniority text default null,
  p_city text default null,
  p_skills text[] default null,
  p_open_to_work boolean default null,
  p_company_type text default null,
  p_degree text default null,
  p_school text default null,
  p_min_years_experience numeric default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_roles text[] default null
)
returns table (
  candidate_id text,
  rank_score integer,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with matching as (
    select
      c.id,
      (
        -- Every returned candidate already satisfies the hard filters.
        50

        -- Prefer candidates who are available for new opportunities.
        + case when c.open_to_work then 15 else 0 end

        -- Prefer more experienced candidates within the requested level.
        + least(
            15,
            greatest(0, floor(coalesce(c.years_experience, 0)))::integer
          )

        -- Prefer profiles with richer skills information.
        + least(10, cardinality(coalesce(c.skills, '{}'::text[])))

        -- Prefer profiles with experience history.
        + case
            when jsonb_typeof(c.experiences) = 'array'
              and jsonb_array_length(c.experiences) > 0
            then 5
            else 0
          end

        -- Prefer profiles with education information.
        + case
            when jsonb_typeof(c.education) = 'array'
              and jsonb_array_length(c.education) > 0
            then 5
            else 0
          end
      )::integer as score
    from public.candidates c
    where
      (p_role is null or c.role = p_role)
      and (p_roles is null or c.role = any(p_roles))
      and (p_seniority is null or c.seniority = p_seniority)
      and (
        p_city is null
        or lower(c.location ->> 'city') = lower(p_city)
      )
      and (
        p_skills is null
        or c.skills @> p_skills
      )
      and (
        p_open_to_work is null
        or c.open_to_work = p_open_to_work
      )
      and (
        p_company_type is null
        or exists (
          select 1
          from jsonb_array_elements(c.experiences) as e
          where e ->> 'company_type' = p_company_type
        )
      )
      and (
        p_degree is null
        or exists (
          select 1
          from jsonb_array_elements(c.education) as e
          where e ->> 'degree' = p_degree
        )
      )
      and (
        p_school is null
        or exists (
          select 1
          from jsonb_array_elements(c.education) as e
          where lower(e ->> 'school') like
            '%' || lower(p_school) || '%'
        )
      )
      and (
        p_min_years_experience is null
        or c.years_experience >= p_min_years_experience
      )
  )
  select
    m.id as candidate_id,
    m.score as rank_score,
    count(*) over () as total_count
  from matching m
  order by m.score desc, m.id asc
  limit greatest(0, least(p_limit, 5000))
  offset greatest(0, p_offset);
$$;
