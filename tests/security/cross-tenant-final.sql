-- Final cross-tenant gate. Run only on local/staging with an administrative
-- Postgres connection. Every fixture and write is rolled back.

begin;

insert into public.clinics (id, name, slug)
values
  ('ca100000-0000-0000-0000-000000000001', 'Cross Tenant Clinic A', 'cross-tenant-a'),
  ('cb100000-0000-0000-0000-000000000002', 'Cross Tenant Clinic B', 'cross-tenant-b'),
  ('cc100000-0000-0000-0000-000000000003', 'Cross Tenant Clinic C', 'cross-tenant-c');

insert into auth.users (id, email, role, aud)
values
  ('ca200000-0000-0000-0000-000000000001', 'owner-a@cross-tenant.example.test', 'authenticated', 'authenticated'),
  ('ca200000-0000-0000-0000-000000000002', 'reception-a@cross-tenant.example.test', 'authenticated', 'authenticated'),
  ('cb200000-0000-0000-0000-000000000001', 'owner-b@cross-tenant.example.test', 'authenticated', 'authenticated'),
  ('cb200000-0000-0000-0000-000000000002', 'reception-b@cross-tenant.example.test', 'authenticated', 'authenticated'),
  ('cc200000-0000-0000-0000-000000000001', 'owner-c@cross-tenant.example.test', 'authenticated', 'authenticated'),
  ('cc200000-0000-0000-0000-000000000002', 'reception-c@cross-tenant.example.test', 'authenticated', 'authenticated');

insert into public.profiles (id, clinic_id, full_name, email, role, active)
values
  ('ca200000-0000-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000001', 'Owner A', 'owner-a@cross-tenant.example.test', 'owner', true),
  ('ca200000-0000-0000-0000-000000000002', 'ca100000-0000-0000-0000-000000000001', 'Reception A', 'reception-a@cross-tenant.example.test', 'receptionist', true),
  ('cb200000-0000-0000-0000-000000000001', 'cb100000-0000-0000-0000-000000000002', 'Owner B', 'owner-b@cross-tenant.example.test', 'owner', true),
  ('cb200000-0000-0000-0000-000000000002', 'cb100000-0000-0000-0000-000000000002', 'Reception B', 'reception-b@cross-tenant.example.test', 'receptionist', true),
  ('cc200000-0000-0000-0000-000000000001', 'cc100000-0000-0000-0000-000000000003', 'Owner C', 'owner-c@cross-tenant.example.test', 'owner', true),
  ('cc200000-0000-0000-0000-000000000002', 'cc100000-0000-0000-0000-000000000003', 'Reception C', 'reception-c@cross-tenant.example.test', 'receptionist', true);

insert into public.clinic_public_forms (
  id, clinic_id, clinic_slug, public_token, landing_url, allowed_origins, is_active
)
values
  (
    'ca300000-0000-0000-0000-000000000001',
    'ca100000-0000-0000-0000-000000000001',
    'cross-tenant-a',
    'lf_cross_tenant_a_0123456789abcdef0123456789',
    'https://clinic-a.example.test',
    array['https://clinic-a.example.test'],
    true
  ),
  (
    'cb300000-0000-0000-0000-000000000002',
    'cb100000-0000-0000-0000-000000000002',
    'cross-tenant-b',
    'lf_cross_tenant_b_0123456789abcdef0123456789',
    'https://clinic-b.example.test',
    array['https://clinic-b.example.test'],
    true
  ),
  (
    'cc300000-0000-0000-0000-000000000003',
    'cc100000-0000-0000-0000-000000000003',
    'cross-tenant-c',
    'lf_cross_tenant_c_0123456789abcdef0123456789',
    'https://clinic-c.example.test',
    array['https://clinic-c.example.test'],
    true
  );

insert into public.leads (
  id, clinic_id, name, phone, phone_plus, status, assigned_to,
  next_action, next_followup_at, consent_contact, consent_at, source
)
values
  ('ca400000-0000-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000001', 'Seed A', '0981000001', '+595981000001', 'Nuevo', 'ca200000-0000-0000-0000-000000000002', 'Contactar', now(), true, now(), 'cross-tenant-qa'),
  ('cb400000-0000-0000-0000-000000000002', 'cb100000-0000-0000-0000-000000000002', 'Seed B', '0982000002', '+595982000002', 'Nuevo', 'cb200000-0000-0000-0000-000000000002', 'Contactar', now(), true, now(), 'cross-tenant-qa'),
  ('cc400000-0000-0000-0000-000000000003', 'cc100000-0000-0000-0000-000000000003', 'Seed C', '0983000003', '+595983000003', 'Nuevo', 'cc200000-0000-0000-0000-000000000002', 'Contactar', now(), true, now(), 'cross-tenant-qa');

insert into public.tasks (id, clinic_id, lead_id, title, type, status, due_at, assigned_to)
values
  ('ca500000-0000-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000001', 'ca400000-0000-0000-0000-000000000001', 'Task A', 'contact', 'pendiente', now(), 'ca200000-0000-0000-0000-000000000002'),
  ('cb500000-0000-0000-0000-000000000002', 'cb100000-0000-0000-0000-000000000002', 'cb400000-0000-0000-0000-000000000002', 'Task B', 'contact', 'pendiente', now(), 'cb200000-0000-0000-0000-000000000002'),
  ('cc500000-0000-0000-0000-000000000003', 'cc100000-0000-0000-0000-000000000003', 'cc400000-0000-0000-0000-000000000003', 'Task C', 'contact', 'pendiente', now(), 'cc200000-0000-0000-0000-000000000002');

insert into public.appointments (
  id, clinic_id, lead_id, appointment_date, appointment_time, status
)
values
  ('ca600000-0000-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000001', 'ca400000-0000-0000-0000-000000000001', current_date + 2, time '09:00', 'Agendado'),
  ('cb600000-0000-0000-0000-000000000002', 'cb100000-0000-0000-0000-000000000002', 'cb400000-0000-0000-0000-000000000002', current_date + 2, time '10:00', 'Agendado'),
  ('cc600000-0000-0000-0000-000000000003', 'cc100000-0000-0000-0000-000000000003', 'cc400000-0000-0000-0000-000000000003', current_date + 2, time '11:00', 'Agendado');

insert into public.quotes (
  id, clinic_id, lead_id, treatment, amount, status, next_action_at
)
values
  ('ca700000-0000-0000-0000-000000000001', 'ca100000-0000-0000-0000-000000000001', 'ca400000-0000-0000-0000-000000000001', 'QA A', 100000, 'pending', now() + interval '1 day'),
  ('cb700000-0000-0000-0000-000000000002', 'cb100000-0000-0000-0000-000000000002', 'cb400000-0000-0000-0000-000000000002', 'QA B', 100000, 'pending', now() + interval '1 day'),
  ('cc700000-0000-0000-0000-000000000003', 'cc100000-0000-0000-0000-000000000003', 'cc400000-0000-0000-0000-000000000003', 'QA C', 100000, 'pending', now() + interval '1 day');

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;

do $test$
declare
  result_a jsonb;
  result_b jsonb;
  result_c jsonb;
  mismatch_blocked boolean := false;
begin
  result_a := public.create_public_lead_intake_v2(
    'ca300000-0000-0000-0000-000000000001', 'cross-tenant-a',
    'lf_cross_tenant_a_0123456789abcdef0123456789', 'Intake A', '0981111111', '+595981111111',
    'Consulta', 'Esta semana', 'Quiero agendar', 'No', 'QA A', 'https://wa.me/595981111111',
    'cross-tenant-final', 'qa', null, now(), 'ip-a', 'phone-a', null, null, null, null, null, null, null
  );
  result_b := public.create_public_lead_intake_v2(
    'cb300000-0000-0000-0000-000000000002', 'cross-tenant-b',
    'lf_cross_tenant_b_0123456789abcdef0123456789', 'Intake B', '0982222222', '+595982222222',
    'Consulta', 'Esta semana', 'Quiero agendar', 'No', 'QA B', 'https://wa.me/595982222222',
    'cross-tenant-final', 'qa', null, now(), 'ip-b', 'phone-b', null, null, null, null, null, null, null
  );
  result_c := public.create_public_lead_intake_v2(
    'cc300000-0000-0000-0000-000000000003', 'cross-tenant-c',
    'lf_cross_tenant_c_0123456789abcdef0123456789', 'Intake C', '0983333333', '+595983333333',
    'Consulta', 'Esta semana', 'Quiero agendar', 'No', 'QA C', 'https://wa.me/595983333333',
    'cross-tenant-final', 'qa', null, now(), 'ip-c', 'phone-c', null, null, null, null, null, null, null
  );

  if (select clinic_id from public.leads where id = (result_a ->> 'lead_id')::uuid) <> 'ca100000-0000-0000-0000-000000000001'
     or (select clinic_id from public.leads where id = (result_b ->> 'lead_id')::uuid) <> 'cb100000-0000-0000-0000-000000000002'
     or (select clinic_id from public.leads where id = (result_c ->> 'lead_id')::uuid) <> 'cc100000-0000-0000-0000-000000000003' then
    raise exception 'A valid token was resolved into the wrong clinic';
  end if;

  begin
    perform public.create_public_lead_intake_v2(
      'ca300000-0000-0000-0000-000000000001', 'cross-tenant-b',
      'lf_cross_tenant_b_0123456789abcdef0123456789', 'Mismatch', '0981444444', '+595981444444',
      'Consulta', null, null, null, null, null, 'cross-tenant-final', 'qa', null, now(),
      'ip-mismatch', 'phone-mismatch', null, null, null, null, null, null, null
    );
  exception when sqlstate '42501' then
    mismatch_blocked := true;
  end;

  if not mismatch_blocked then
    raise exception 'A form id accepted another clinic slug/token';
  end if;
end;
$test$;

reset role;

select set_config('request.jwt.claim.sub', 'ca200000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $test$
declare
  changed integer;
  quote_blocked boolean := false;
  appointment_blocked boolean := false;
  cross_task_blocked boolean := false;
begin
  if (select count(*) from public.clinics) <> 1
     or (select count(*) from public.profiles) <> 2
     or exists (select 1 from public.leads where clinic_id <> 'ca100000-0000-0000-0000-000000000001')
     or exists (select 1 from public.tasks where clinic_id <> 'ca100000-0000-0000-0000-000000000001')
     or exists (select 1 from public.appointments where clinic_id <> 'ca100000-0000-0000-0000-000000000001')
     or exists (select 1 from public.quotes where clinic_id <> 'ca100000-0000-0000-0000-000000000001')
     or exists (select 1 from public.clinic_public_forms where clinic_id <> 'ca100000-0000-0000-0000-000000000001') then
    raise exception 'Owner A read data from another clinic';
  end if;

  update public.leads set notes = 'cross-tenant write' where id = 'cb400000-0000-0000-0000-000000000002';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Owner A updated Clinic B lead'; end if;

  update public.tasks set title = 'cross-tenant write' where id = 'cb500000-0000-0000-0000-000000000002';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Owner A updated Clinic B task'; end if;

  begin
    perform public.create_treatment_quote(
      'cb400000-0000-0000-0000-000000000002', null, 'Cross clinic', 100000, 'PYG', null, now() + interval '1 day', null
    );
  exception when sqlstate '42501' then quote_blocked := true;
  end;

  begin
    perform public.schedule_lead_appointment(
      'cb400000-0000-0000-0000-000000000002', current_date + 3, time '12:00', 'Dra. Cross Tenant', 'Cross clinic', null, null
    );
  exception when sqlstate '42501' then appointment_blocked := true;
  end;

  begin
    insert into public.tasks (clinic_id, lead_id, title, type, status)
    values ('ca100000-0000-0000-0000-000000000001', 'cb400000-0000-0000-0000-000000000002', 'Cross relation', 'contact', 'pendiente');
  exception when foreign_key_violation then cross_task_blocked := true;
  end;

  if not quote_blocked or not appointment_blocked or not cross_task_blocked then
    raise exception 'A cross-tenant RPC or relation write was not blocked';
  end if;
end;
$test$;

reset role;

select set_config('request.jwt.claim.sub', 'ca200000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $test$
begin
  if exists (select 1 from public.leads where clinic_id <> 'ca100000-0000-0000-0000-000000000001')
     or exists (select 1 from public.tasks where clinic_id <> 'ca100000-0000-0000-0000-000000000001')
     or exists (select 1 from public.appointments where clinic_id <> 'ca100000-0000-0000-0000-000000000001')
     or exists (select 1 from public.quotes where clinic_id <> 'ca100000-0000-0000-0000-000000000001') then
    raise exception 'Receptionist A read data from another clinic';
  end if;
end;
$test$;

reset role;

do $test$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leads'
  ) then
    raise exception 'leads is not published to Realtime';
  end if;

  if has_table_privilege('anon', 'public.leads', 'SELECT')
     or has_table_privilege('anon', 'public.clinic_public_forms', 'SELECT')
     or has_function_privilege(
       'anon',
       'public.create_public_lead_intake_v2(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,timestamp with time zone,text,text,text,text,text,text,text,text,text)',
       'EXECUTE'
     ) then
    raise exception 'anon can read CRM data or execute the private intake RPC';
  end if;
end;
$test$;

rollback;

select 'PASS' as result, 'cross_tenant_final_a_b_c' as test;
