-- Rotto local development seed data

insert into public.companies (slug, name)
values
  ('acme', 'Acme'),
  ('globex', 'Globex')
on conflict (slug) do update
set name = excluded.name;
