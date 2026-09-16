\set ON_ERROR_STOP on
begin;

insert into public.clinics (id, name, slug) values
  ('d1000000-0000-4000-8000-000000000001', 'Interaction QA A', 'interaction-qa-a'),
  ('d1000000-0000-4000-8000-000000000002', 'Interaction QA B', 'interaction-qa-b');
insert into auth.users (id, email, role, aud) values
  ('d2000000-0000-4000-8000-000000000001', 'interaction-a@example.test', 'authenticated', 'authenticated'),
  ('d2000000-0000-4000-8000-000000000002', 'interaction-b@example.test', 'authenticated', 'authenticated');
insert into public.profiles (id, clinic_id, full_name, email, role, active) values
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'Reception A', 'interaction-a@example.test', 'receptionist', true),
  ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'Reception B', 'interaction-b@example.test', 'receptionist', true);
insert into public.contacts (id, clinic_id, name, phone, phone_plus, phone_key) values
  ('d3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'Contact A', '0981111111', '+595981111111', '595981111111'),
  ('d3000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'Contact B', '0982222222', '+595982222222', '595982222222');
insert into public.leads (id, clinic_id, contact_id, name, phone, phone_plus, treatment, status, next_action, next_followup_at, assigned_to) values
  ('d4000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', 'Contact A', '0981111111', '+595981111111', 'Implantes', 'Nuevo', 'Contactar', now() + interval '1 day', 'd2000000-0000-4000-8000-000000000001'),
  ('d4000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'd3000000-0000-4000-8000-000000000002', 'Contact B', '0982222222', '+595982222222', 'Ortodoncia', 'Nuevo', 'Contactar', now() + interval '1 day', 'd2000000-0000-4000-8000-000000000002');

select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $test$
declare
  summary_count integer;
  event_count integer;
begin
  select count(*) into summary_count
  from public.get_contact_operating_summary_v1(
    'd1000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000001'
  );
  if summary_count <> 1 then raise exception 'Own contact summary missing'; end if;

  perform public.register_contact_interaction_v1(
    'd1000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000001',
    'd4000000-0000-4000-8000-000000000001',
    'note', 'note', 'Nota QA inmutable', null, null, null
  );
  perform public.register_contact_interaction_v1(
    'd1000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000001',
    'd4000000-0000-4000-8000-000000000001',
    'note', 'note', 'Nota QA inmutable', null, null, null
  );
  select count(*) into event_count
  from public.list_contact_timeline_v1(
    'd1000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000001', 25, null, null
  ) where event_type = 'administrative_note';
  if event_count <> 1 then raise exception 'Duplicate interaction event: %', event_count; end if;

  begin
    perform public.get_contact_operating_summary_v1(
      'd1000000-0000-4000-8000-000000000002',
      'd3000000-0000-4000-8000-000000000002'
    );
    raise exception 'Cross-tenant summary accepted';
  exception when insufficient_privilege then null; end;

  begin
    perform public.register_contact_interaction_v1(
      'd1000000-0000-4000-8000-000000000001',
      'd3000000-0000-4000-8000-000000000001',
      'd4000000-0000-4000-8000-000000000001',
      'whatsapp', 'sql_injection', null, null, null, null
    );
    raise exception 'Invalid outcome accepted';
  exception when invalid_parameter_value then null; end;

  begin
    perform public.register_contact_interaction_v1(
      'd1000000-0000-4000-8000-000000000001',
      'd3000000-0000-4000-8000-000000000001',
      'd4000000-0000-4000-8000-000000000001',
      'note', 'note', 'Manipulated assignee', null, null,
      'd2000000-0000-4000-8000-000000000002'
    );
    raise exception 'Manipulated assignee accepted';
  exception when insufficient_privilege then null; end;

  if exists (select 1 from public.contacts where clinic_id = 'd1000000-0000-4000-8000-000000000002') then
    raise exception 'Direct RLS contact leak';
  end if;
end;
$test$;

reset role;
rollback;
select 'contact-interactions-rls: PASS' as result;
