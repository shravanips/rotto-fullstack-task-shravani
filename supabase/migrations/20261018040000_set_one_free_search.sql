-- Rotto assessment: each free company receives exactly one search.

ALTER TABLE public.company_plans
  ALTER COLUMN free_search_limit SET DEFAULT 1;

UPDATE public.company_plans
SET free_search_limit = 1;
