
-- Store a search, all its ranked results, and the quota charge
-- in one transaction. A failed statement rolls everything back.

create or replace function public.create_search_atomic(
  p_company_id uuid,
  p_recruiter_id uuid,
  p_brief text,
  p_filters jsonb,
  p_matches jsonb
)
returns table (
  search_id uuid,
  searches_remaining integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_used integer;
  v_limit integer;
  v_search_id uuid;
  v_remaining integer;
  v_match_count integer;
begin
  -- This function is callable only with the server-side service key.
  -- Also verify the recruiter belongs to the supplied company.
  if not exists (
    select 1
    from public.recruiters r
    where r.id = p_recruiter_id
      and r.company_id = p_company_id
  ) then
    raise exception 'Recruiter does not belong to company';
  end if;

  if p_brief is null
     or length(trim(p_brief)) not between 1 and 2000 then
    raise exception 'Invalid search brief';
  end if;

  if p_filters is null
     or jsonb_typeof(p_filters) <> 'object'
     or p_matches is null
     or jsonb_typeof(p_matches) <> 'array' then
    raise exception 'Invalid search payload';
  end if;

  v_match_count := jsonb_array_length(p_matches);

  if v_match_count > 5000 then
    raise exception 'Too many search results';
  end if;

  -- Lock this company's quota row until the transaction ends.
  select cp.plan, cp.searches_used, cp.free_search_limit
    into v_plan, v_used, v_limit
  from public.company_plans cp
  where cp.company_id = p_company_id
  for update;

  if not found then
    raise exception 'Company plan not found';
  end if;

  if v_plan = 'free' and v_used >= v_limit then
    -- Return a quota response without changing any data.
    search_id := null;
    searches_remaining := 0;
    return next;
    return;
  end if;

  insert into public.searches (
    company_id,
    recruiter_id,
    brief,
    filters,
    total
  )
  values (
    p_company_id,
    p_recruiter_id,
    trim(p_brief),
    p_filters,
    v_match_count
  )
  returning id into v_search_id;

  -- WITH ORDINALITY preserves the deterministic ranking order.
  insert into public.search_results (
    search_id,
    candidate_id,
    position,
    rank_score
  )
  select
    v_search_id,
    m.candidate_id,
    (m.ordinality - 1)::integer,
    m.rank_score
    from rows from (
    jsonb_to_recordset(p_matches) as (
        candidate_id text,
        rank_score integer
    )
    ) with ordinality as m;

  if v_plan = 'free' then
    update public.company_plans cp
    set searches_used = cp.searches_used + 1
    where cp.company_id = p_company_id;

    v_remaining := v_limit - v_used - 1;
  else
    v_remaining := null;
  end if;

  search_id := v_search_id;
  searches_remaining := v_remaining;
  return next;
end;
$$;

revoke all on function public.create_search_atomic(
  uuid, uuid, text, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.create_search_atomic(
  uuid, uuid, text, jsonb, jsonb
) to service_role;
