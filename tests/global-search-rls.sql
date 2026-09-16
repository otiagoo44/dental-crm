\set ON_ERROR_STOP on
begin;

insert into public.clinics (id, name, slug) values
  ('e1000000-0000-4000-8000-000000000001', 'Search QA A', 'search-qa-a'),
  ('e1000000-0000-4000-8000-000000000002', 'Search QA B', 'search-qa-b');
insert into auth.users (id, email, role, aud) values
  ('e2000000-0000-4000-8000-000000000001', 'search-a@example.test', 'authenticated', 'authenticated'),
  ('e2000000-0000-4000-8000-000000000002', 'search-b@example.test', 'authenticated', 'authenticated');
insert into public.profiles (id, clinic_id, full_name, email, role, active) values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Reception Search A', 'search-a@example.test', 'receptionist', true),
  ('e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', 'Reception Search B', 'search-b@example.test', 'receptionist', true);
insert into public.contacts (id, clinic_id, name, phone, phone_plus, phone_key) values
  ('e3000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Florencia Search', '0981111111', '+595981111111', '595981111111'),
  ('e3000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', 'Florencia Cross Tenant', '0982222222', '+595982222222', '595982222222');
insert into public.leads (id, clinic_id, contact_id, name, phone, phone_plus, treatment, status, assigned_to) values
  ('e4000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', 'Florencia Search', '0981111111', '+595981111111', 'Implantes Search', 'Nuevo', 'e2000000-0000-4000-8000-000000000001'),
  ('e4000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000002', 'Florencia Cross Tenant', '0982222222', '+595982222222', 'Implantes Secretos', 'Nuevo', 'e2000000-0000-4000-8000-000000000002');

select set_config('request.jwt.claim.sub', 'e2000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $test$
declare
  own_count integer;
  leaked_count integer;
begin
  select count(*) into own_count from public.search_dentflow_v1(
    'e1000000-0000-4000-8000-000000000001', 'Florencia', 12
  );
  if own_count <> 1 then raise exception 'Expected one own Contact result, got %', own_count; end if;

  select count(*) into own_count from public.search_dentflow_v1(
    'e1000000-0000-4000-8000-000000000001', 'Implantes', 12
  ) where result_type = 'opportunity' and opportunity_id = 'e4000000-0000-4000-8000-000000000001';
  if own_count <> 1 then raise exception 'Own Opportunity result missing'; end if;

  select count(*) into leaked_count from public.search_dentflow_v1(
    'e1000000-0000-4000-8000-000000000001', 'Secretos', 12
  );
  if leaked_count <> 0 then raise exception 'Cross-tenant search leak'; end if;

  begin
    perform public.search_dentflow_v1('e1000000-0000-4000-8000-000000000002', 'Florencia', 12);
    raise exception 'Cross-tenant clinic accepted';
  exception when insufficient_privilege then null; end;

  begin
    perform public.search_dentflow_v1('e1000000-0000-4000-8000-000000000001', 'x', 12);
    raise exception 'Short query accepted';
  exception when invalid_parameter_value then null; end;

  begin
    perform public.search_dentflow_v1('e1000000-0000-4000-8000-000000000001', 'Florencia', 21);
    raise exception 'Unbounded limit accepted';
  exception when invalid_parameter_value then null; end;
end;
$test$;

reset role;
rollback;
select 'global-search-rls: PASS' as result;
