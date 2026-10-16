
create or replace function public.consume_search_quota(
  p_company_id uuid
)
returns table (
  allowed boolean,
  current_plan text,
  remaining integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_used integer;
  v_limit integer;
begin
  select cp.plan, cp.searches_used, cp.free_search_limit
  into v_plan, v_used, v_limit
  from public.company_plans cp
  where cp.company_id = p_company_id
  for update;

  if not found then
    raise exception 'Company plan not found';
  end if;

  if v_plan = 'paid' then
    return query select true, v_plan, null::integer;
    return;
  end if;

  if v_used >= v_limit then
    return query select false, v_plan, 0;
    return;
  end if;

  update public.company_plans
  set searches_used = searches_used + 1,
      updated_at = now()
  where company_id = p_company_id;

  return query
  select true, v_plan, v_limit - v_used - 1;
end;
$$;

-- This function must not be callable directly by recruiters.
-- Only trusted server-side code can execute it.
revoke all on function public.consume_search_quota(uuid)
from public, anon, authenticated;

grant execute on function public.consume_search_quota(uuid)
to service_role;
