-- End-to-end domain workflows for a disposable/local database.
-- All fixtures and mutations are rolled back.
begin;

insert into public.clinics (id, name, slug)
values ('e1000000-0000-0000-0000-000000000001', 'Workflow QA', 'workflow-qa');

insert into auth.users (id, email, role, aud)
values
  ('e2000000-0000-0000-0000-000000000001', 'workflow-reception@example.test', 'authenticated', 'authenticated'),
  ('e2000000-0000-0000-0000-000000000002', 'workflow-owner@example.test', 'authenticated', 'authenticated');

insert into public.profiles (id, clinic_id, full_name, email, role, active)
values
  ('e2000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'Recepción Workflow QA', 'workflow-reception@example.test', 'receptionist', true),
  ('e2000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'Owner Workflow QA', 'workflow-owner@example.test', 'owner', true);

insert into public.clinic_public_forms (
  id, clinic_id, clinic_slug, public_token, allowed_origins, is_active
) values (
  'e3000000-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000001',
  'workflow-qa',
  'lf_workflow_qa_0123456789abcdef012345',
  array['https://qa.example.test'],
  true
);

create or replace function pg_temp.assert_open_tasks(
  p_lead_id uuid,
  p_expected_count integer,
  p_expected_type text default null
)
returns void
language plpgsql
set search_path = ''
as $test$
declare
  actual_count integer;
begin
  select count(*)::integer into actual_count
  from public.tasks t
  where t.lead_id = p_lead_id
    and lower(t.status) in ('pendiente', 'vencido', 'vencida');

  if actual_count <> p_expected_count then
    raise exception 'Expected % open tasks for %, got %', p_expected_count, p_lead_id, actual_count;
  end if;

  if p_expected_type is not null and not exists (
    select 1 from public.tasks t
    where t.lead_id = p_lead_id
      and t.type = p_expected_type
      and lower(t.status) in ('pendiente', 'vencido', 'vencida')
  ) then
    raise exception 'Expected open task type % for %', p_expected_type, p_lead_id;
  end if;
end;
$test$;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;

select public.create_public_lead_intake(
  'e3000000-0000-0000-0000-000000000001',
  'workflow-qa',
  'lf_workflow_qa_0123456789abcdef012345',
  'Paciente A flujo completo',
  '0981111101',
  '+595981111101',
  'Implante dental',
  'Hoy',
  95,
  'Lead Caliente',
  'Quiere agendar',
  'No',
  'Flujo completo QA',
  5000000,
  'Responder nueva consulta',
  now(),
  'https://wa.me/595981111101',
  'Formulario QA',
  'qa',
  'Dato sintético',
  now(),
  'workflow-ip-a',
  'workflow-phone-a'
);

reset role;

do $test$
declare
  lead_record public.leads;
begin
  select * into lead_record from public.leads where phone_plus = '+595981111101';
  if lead_record.status <> 'Nuevo'
     or lead_record.assigned_to <> 'e2000000-0000-0000-0000-000000000001'
     or lead_record.next_action is null
     or lead_record.next_followup_at is null
     or not exists (select 1 from public.lead_events where lead_id = lead_record.id and event_type = 'lead_created_from_landing')
     or not exists (select 1 from public.audit_logs where row_id = lead_record.id and action = 'lead_created_from_landing') then
    raise exception 'Flow A intake state is inconsistent';
  end if;
  perform pg_temp.assert_open_tasks(lead_record.id, 1, 'contact');
end;
$test$;

select set_config('request.jwt.claim.sub', 'e2000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $test$
declare
  lead_id uuid;
  saved public.leads;
  attempts integer;
  target text;
begin
  select id, contact_attempts into lead_id, attempts from public.leads where phone_plus = '+595981111101';
  foreach target in array array['Contactado', 'Respondió', 'No Respondió'] loop
    select * into saved from public.save_lead_followup(lead_id, target, 'Seguimiento QA', now() + interval '1 day');
    if saved.last_contact_at is null or saved.contact_attempts <> attempts + 1 then
      raise exception 'DF-009 contact timestamp/attempt regression for %', target;
    end if;
    attempts := saved.contact_attempts;
    select * into saved from public.save_lead_followup(lead_id, target, 'Seguimiento QA', now() + interval '1 day');
    if saved.contact_attempts <> attempts then
      raise exception 'DF-009 duplicate transition increments attempts for %', target;
    end if;
  end loop;
  begin
    perform public.save_lead_followup(lead_id, 'Respondió', 'Invalid date', now() - interval '2 days');
    raise exception 'Expected invalid date rejection';
  exception when invalid_parameter_value then null;
  end;
  if (select contact_attempts from public.leads where id = lead_id) <> attempts then
    raise exception 'DF-009 failed workflow changed attempts';
  end if;
end;
$test$;
rollback;
