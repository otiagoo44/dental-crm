-- Creates 100 isolated QA clinics for repeatable local/staging load tests.
-- Never run against production. This script does not delete rows.
--
-- psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 \
--   -v confirm_non_production=YES \
--   -v load_origin=https://load-staging.example.test \
--   -f tests/load/setup-load-fixtures.sql

\set ON_ERROR_STOP on

create or replace function pg_temp.qa_uuid(p_value text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select (
    substr(md5(p_value), 1, 8) || '-' ||
    substr(md5(p_value), 9, 4) || '-' ||
    substr(md5(p_value), 13, 4) || '-' ||
    substr(md5(p_value), 17, 4) || '-' ||
    substr(md5(p_value), 21, 12)
  )::uuid;
$$;

select
  :'confirm_non_production' = 'YES'
  and :'load_origin' ~ '^https?://[^/]+$'
  as load_fixture_inputs_are_safe
\gset

\if :load_fixture_inputs_are_safe
\else
  \echo 'ABORT: require confirm_non_production=YES and an exact load_origin'
  \quit
\endif

insert into public.clinics (id, name, slug, status, is_active)
select
  pg_temp.qa_uuid('dental-crm-load-clinic-' || i),
  'Load QA Clinic ' || lpad(i::text, 3, '0'),
  'load-qa-' || lpad(i::text, 3, '0'),
  'active',
  true
from generate_series(1, 100) as series(i)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  status = 'active',
  is_active = true;

insert into auth.users (id, email, role, aud)
select
  pg_temp.qa_uuid('dental-crm-load-owner-' || i),
  'load-owner-' || lpad(i::text, 3, '0') || '@example.test',
  'authenticated',
  'authenticated'
from generate_series(1, 100) as series(i)
union all
select
  pg_temp.qa_uuid('dental-crm-load-reception-' || i),
  'load-reception-' || lpad(i::text, 3, '0') || '@example.test',
  'authenticated',
  'authenticated'
from generate_series(1, 100) as series(i)
on conflict (id) do nothing;

insert into public.profiles (id, clinic_id, full_name, email, role, active)
select
  pg_temp.qa_uuid('dental-crm-load-owner-' || i),
  pg_temp.qa_uuid('dental-crm-load-clinic-' || i),
  'Load Owner ' || lpad(i::text, 3, '0'),
  'load-owner-' || lpad(i::text, 3, '0') || '@example.test',
  'owner',
  true
from generate_series(1, 100) as series(i)
union all
select
  pg_temp.qa_uuid('dental-crm-load-reception-' || i),
  pg_temp.qa_uuid('dental-crm-load-clinic-' || i),
  'Load Reception ' || lpad(i::text, 3, '0'),
  'load-reception-' || lpad(i::text, 3, '0') || '@example.test',
  'receptionist',
  true
from generate_series(1, 100) as series(i)
on conflict (id) do update set
  clinic_id = excluded.clinic_id,
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  active = true;

insert into public.clinic_public_forms (
  id,
  clinic_id,
  clinic_slug,
  public_token,
  landing_url,
  allowed_origins,
  is_active
)
select
  pg_temp.qa_uuid('dental-crm-load-form-' || i),
  pg_temp.qa_uuid('dental-crm-load-clinic-' || i),
  'load-qa-' || lpad(i::text, 3, '0'),
  'lf_load_' || md5('dental-crm-load-form-' || i),
  :'load_origin',
  array[:'load_origin']::text[],
  true
from generate_series(1, 100) as series(i)
on conflict (id) do update set
  clinic_id = excluded.clinic_id,
  clinic_slug = excluded.clinic_slug,
  public_token = excluded.public_token,
  landing_url = excluded.landing_url,
  allowed_origins = excluded.allowed_origins,
  is_active = true;

select
  count(*) as qa_clinics,
  count(*) filter (where exists (
    select 1 from public.profiles p
    where p.clinic_id = c.id and p.role = 'owner' and p.active is true
  )) as with_owner,
  count(*) filter (where exists (
    select 1 from public.profiles p
    where p.clinic_id = c.id and p.role = 'receptionist' and p.active is true
  )) as with_receptionist,
  count(*) filter (where exists (
    select 1 from public.clinic_public_forms f
    where f.clinic_id = c.id and f.is_active is true
  )) as with_public_form
from public.clinics c
where c.slug like 'load-qa-%';
