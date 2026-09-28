\set ON_ERROR_STOP on
-- Disposable database ONLY, before the contact/opportunity migration. Commit fixtures across migration sessions.
begin;
do $$ begin
 if to_regclass('public.contacts') is not null then raise exception 'Expected previous-release schema without contacts'; end if;
end $$;
insert into public.clinics(id,name,slug) values
 ('ab100000-0000-4000-8000-000000000001','Upgrade Clinic A','upgrade-a'),
 ('ab100000-0000-4000-8000-000000000002','Upgrade Clinic B','upgrade-b');
insert into auth.users(id,email,role,aud)
select ('ab200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'upgrade-'||n||'@example.test','authenticated','authenticated' from generate_series(1,4) n;
insert into public.profiles(id,clinic_id,full_name,email,role,active)
select id, case when email in ('upgrade-1@example.test','upgrade-2@example.test') then 'ab100000-0000-4000-8000-000000000001'::uuid
 else 'ab100000-0000-4000-8000-000000000002'::uuid end,'Upgrade actor',email,
 case when email in ('upgrade-1@example.test','upgrade-3@example.test') then 'owner' else 'receptionist' end,true
from auth.users where id::text like 'ab200000-%';
insert into public.clinic_settings(clinic_id,opening_hours,treatments)
select id,'08:00-18:00','["Implantes","Ortodoncia"]'::jsonb from public.clinics where id::text like 'ab100000-%';
insert into public.clinic_public_forms(id,clinic_id,clinic_slug,public_token,allowed_origins,is_active) values
 ('ab300000-0000-4000-8000-000000000001','ab100000-0000-4000-8000-000000000001','upgrade-a','lf_upgrade_a_0123456789abcdef0123456789',array['https://upgrade.example.test'],true);
insert into public.leads(id,clinic_id,name,phone,phone_plus,treatment,status,assigned_to,next_action,next_followup_at,created_at) values
 ('ab400000-0000-4000-8000-000000000001','ab100000-0000-4000-8000-000000000001','Upgrade Patient','0981000991','+595981000991','Implantes','Nuevo','ab200000-0000-4000-8000-000000000002','Contactar',now()+interval '1 day','2026-08-30T10:00:00Z'),
 ('ab400000-0000-4000-8000-000000000002','ab100000-0000-4000-8000-000000000001','Upgrade Patient','0981000991','+595981000991','Ortodoncia','Nuevo','ab200000-0000-4000-8000-000000000002','Contactar',now()+interval '1 day','2026-08-30T11:00:00Z'),
 ('ab400000-0000-4000-8000-000000000003','ab100000-0000-4000-8000-000000000002','Upgrade Foreign','0981000991','+595981000991','Implantes','Nuevo','ab200000-0000-4000-8000-000000000004','Contactar',now()+interval '1 day','2026-08-30T12:00:00Z');
insert into public.tasks(id,clinic_id,lead_id,title,type,due_at,assigned_to) values
 ('ab500000-0000-4000-8000-000000000001','ab100000-0000-4000-8000-000000000001','ab400000-0000-4000-8000-000000000001','Upgrade contact','contact',now()+interval '1 day','ab200000-0000-4000-8000-000000000002');
insert into public.appointments(id,clinic_id,lead_id,appointment_date,appointment_time,status) values
 ('ab600000-0000-4000-8000-000000000001','ab100000-0000-4000-8000-000000000001','ab400000-0000-4000-8000-000000000002',current_date+2,'10:00','Agendado');
insert into public.quotes(id,clinic_id,lead_id,treatment,amount,status) values
 ('ab700000-0000-4000-8000-000000000001','ab100000-0000-4000-8000-000000000001','ab400000-0000-4000-8000-000000000002','Ortodoncia',2500000,'pending');
insert into public.lead_events(id,clinic_id,lead_id,event_type,title,description,created_by) values
 ('ab800000-0000-4000-8000-000000000001','ab100000-0000-4000-8000-000000000001','ab400000-0000-4000-8000-000000000001','administrative_note','Upgrade note','Preserve history','ab200000-0000-4000-8000-000000000002');
-- Test-only schema, never a migration. Full row snapshots catch identity/FK/timestamp/value loss.
create schema upgrade_test;
create table upgrade_test.snapshot(table_name text primary key, rows jsonb not null);
do $$ declare t text; rows jsonb; begin
 foreach t in array array['clinics','profiles','clinic_settings','clinic_public_forms','leads','tasks','appointments','quotes','lead_events'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text), ''[]''::jsonb) from public.%I r',t) into rows;
  insert into upgrade_test.snapshot values(t,rows);
 end loop;
end $$;
commit;
