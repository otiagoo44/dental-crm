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


insert into public.clinics(id,name,slug) values ('e1000000-0000-0000-0000-000000000002','Other query QA','other-query-qa');
insert into public.contacts (id,clinic_id,name,phone,phone_plus,phone_key,created_at)
select ('e4000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
'e1000000-0000-0000-0000-000000000001', 'Page Patient ' || n, '098199' || lpad(n::text,4,'0'),
'+59598199' || lpad(n::text,4,'0'), '59598199' || lpad(n::text,4,'0'), '2026-01-01T00:00:00Z'
from generate_series(1,61) n;
insert into public.contacts (id,clinic_id,name,phone_key) values
('e4000000-0000-0000-0000-000000000099','e1000000-0000-0000-0000-000000000002','Other tenant','595981991111');
insert into public.leads (clinic_id,name,phone,phone_plus,treatment,status,next_action,next_followup_at)
values ('e1000000-0000-0000-0000-000000000001','Paciente A flujo completo','0981111101','+595981111101','Ortodoncia','Nuevo','Contactar',now()+interval '1 day'),
('e1000000-0000-0000-0000-000000000002','Other tenant','0981991111','+595981991111','Implantes','Nuevo','Contactar',now()+interval '1 day');

select set_config('request.jwt.claim.sub','e2000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $test$
declare
 clinic uuid := 'e1000000-0000-0000-0000-000000000001';
 other_clinic uuid := 'e1000000-0000-0000-0000-000000000002';
 ids uuid[] := '{}';
 page_ids uuid[];
 stamp timestamptz;
 last_id uuid;
 c record;
 previous_id uuid;
 total integer;
begin
 loop
   page_ids := '{}';
   for c in select * from public.list_contacts_page(clinic,25,'Page Patient','all',stamp,last_id) limit 25 loop
     if c.id = any(ids) then raise exception 'duplicate page row'; end if;
     if previous_id is not null and c.id >= previous_id then raise exception 'unstable tied timestamp ordering'; end if;
     ids := array_append(ids,c.id);
     page_ids := array_append(page_ids,c.id);
     stamp := c.created_at; last_id := c.id; previous_id := c.id;
   end loop;
   exit when cardinality(page_ids)<25;
 end loop;
 if cardinality(ids)<>61 then raise exception 'pagination lost rows: %',cardinality(ids); end if;
 select count(*) into total from public.list_contacts_page(clinic,25,'Page Patient 61');
 if total<>1 then raise exception 'server search failed'; end if;
 select count(*) into total from public.list_contacts_page(clinic,25,'Page Patient','active');
 if total<>0 then raise exception 'server active filter failed'; end if;
 select * into c from public.list_contacts_page(clinic,25,'Paciente A','active');
 if c.opportunity_count<>2 then raise exception 'multiple opportunities missing: %',c.opportunity_count; end if;
 if exists(select 1 from public.list_contacts_page(other_clinic)) then raise exception 'cross tenant contact leak'; end if;
 if exists(select 1 from public.list_contacts_page(clinic,25,'','all',null,null,'e4000000-0000-0000-0000-000000000099')) then raise exception 'foreign contact ID leak'; end if;
 if exists(select 1 from public.leads where clinic_id=other_clinic) then raise exception 'cross tenant opportunity leak'; end if;
 if exists(select 1 from public.list_contacts_page(other_clinic,25,'','all',now(),'e4000000-0000-0000-0000-000000000061')) then raise exception 'cursor bypassed RLS'; end if;
 begin
   perform public.list_contacts_page(clinic,101);
   raise exception 'limit accepted';
 exception when invalid_parameter_value then null; end;
 begin
   perform public.list_contacts_page(clinic,25,'','all',now(),null);
   raise exception 'partial cursor accepted';
 exception when invalid_parameter_value then null; end;
 begin
   perform public.list_contacts_page(clinic,25,'','all);drop table contacts');
   raise exception 'filter injection accepted';
 exception when invalid_parameter_value then null; end;
 if exists(select 1 from public.list_contacts_page(clinic,25,'%')) then raise exception 'search wildcard interpreted'; end if;
end;
$test$;
reset role;
rollback;
