
-- Track processed events so duplicate deliveries are harmless.
create table public.stripe_events (
  event_id text primary key,
  event_created bigint not null,
  event_type text not null,
  company_id uuid references public.companies(id),
  processed_at timestamptz not null default now()
);

-- Track the latest subscription event applied per company.
alter table public.company_plans
add column stripe_last_event_created bigint not null default 0,
add column stripe_last_event_id text not null default '';

-- Apply a verified Stripe event atomically.
create or replace function public.apply_stripe_subscription_event(
  p_event_id text,
  p_event_created bigint,
  p_event_type text,
  p_company_slug text,
  p_subscription_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_inserted_id text;
  v_current_created bigint;
  v_current_event_id text;
  v_new_plan text;
begin
  -- Serialize billing updates for the same company.
  select id into v_company_id
  from public.companies
  where slug = p_company_slug;

  if v_company_id is null then
    raise exception 'Unknown company';
  end if;

  select stripe_last_event_created, stripe_last_event_id
  into v_current_created, v_current_event_id
  from public.company_plans
  where company_id = v_company_id
  for update;

  if not found then
    raise exception 'Company plan not found';
  end if;

  insert into public.stripe_events (
    event_id, event_created, event_type, company_id
  )
  values (
    p_event_id, p_event_created, p_event_type, v_company_id
  )
  on conflict (event_id) do nothing
  returning event_id into v_inserted_id;

  if v_inserted_id is null then
    return 'duplicate';
  end if;

  -- Do not let older events overwrite newer subscription state.
  if p_event_created < v_current_created
     or (
       p_event_created = v_current_created
       and p_event_id <= v_current_event_id
     ) then
    return 'stale';
  end if;

  v_new_plan := case
    when p_event_type = 'customer.subscription.deleted'
      then 'free'
    when p_subscription_status in ('active', 'trialing')
      then 'paid'
    else 'free'
  end;

  update public.company_plans
  set plan = v_new_plan,
      stripe_last_event_created = p_event_created,
      stripe_last_event_id = p_event_id
  where company_id = v_company_id;

  return 'processed';
end;
$$;

revoke all on function public.apply_stripe_subscription_event(
  text, bigint, text, text, text
) from public, anon, authenticated;

grant execute on function public.apply_stripe_subscription_event(
  text, bigint, text, text, text
) to service_role;
