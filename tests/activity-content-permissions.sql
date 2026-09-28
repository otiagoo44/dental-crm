\set ON_ERROR_STOP on
-- Existing domain policy: lead events/administrative notes are shared in a clinic.
-- audit_logs and form configuration are restricted to Owner/Admin. No invented private-note role.
begin;
insert into public.clinics (id,name,slug) values
 ('ac100000-0000-4000-8000-000000000001','Activity content A','activity-content-a'),
 ('ac100000-0000-4000-8000-000000000002','Activity content B','activity-content-b');
insert into auth.users (id,email,role,aud)
select ('ac200000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 'activity-content-' || n || '@example.test','authenticated','authenticated' from generate_series(1,6) n;
insert into public.profiles (id,clinic_id,full_name,email,role,active)
select id, case when email='activity-content-5@example.test' then 'ac100000-0000-4000-8000-000000000002'::uuid
 else 'ac100000-0000-4000-8000-000000000001'::uuid end,
 'Safe actor', email,
 case when email='activity-content-1@example.test' then 'owner' when email='activity-content-2@example.test' then 'admin' else 'receptionist' end,
 email<>'activity-content-6@example.test'
from auth.users where id::text like 'ac200000-%';
insert into public.contacts (id,clinic_id,name,phone,phone_plus,phone_key) values
 ('ac300000-0000-4000-8000-000000000001','ac100000-0000-4000-8000-000000000001','Safe contact','0981000111','+595981000111','595981000111'),
 ('ac300000-0000-4000-8000-000000000002','ac100000-0000-4000-8000-000000000002','FOREIGN_CONTACT_CANARY','0981000222','+595981000222','595981000222');
insert into public.leads (id,clinic_id,contact_id,name,phone,phone_plus,treatment,status,next_action,next_followup_at) values
 ('ac400000-0000-4000-8000-000000000001','ac100000-0000-4000-8000-000000000001','ac300000-0000-4000-8000-000000000001','Safe contact','0981000111','+595981000111','Implantes','Nuevo','Contactar',now()+interval '1 day'),
 ('ac400000-0000-4000-8000-000000000002','ac100000-0000-4000-8000-000000000002','ac300000-0000-4000-8000-000000000002','FOREIGN_CONTACT_CANARY','0981000222','+595981000222','Ortodoncia','Nuevo','Contactar',now()+interval '1 day');
insert into public.lead_events (clinic_id,lead_id,event_type,title,description,metadata,created_by)
select 'ac100000-0000-4000-8000-000000000001','ac400000-0000-4000-8000-000000000001',t,
 'SHARED_TITLE_'||t,'SHARED_DESCRIPTION_'||t,
 '{"channel":"note","outcome":"note","technical":{"debug":"UNPROJECTED_METADATA_CANARY"}}'::jsonb,
 'ac200000-0000-4000-8000-000000000003'
from unnest(array['administrative_note','appointment_attended','appointment_cancelled','appointment_confirmed',
 'appointment_no_show','appointment_rescheduled','appointment_scheduled','contact_attempted','followup_postponed',
 'followup_scheduled','lead_contacted','lead_created_from_landing','lead_created_manual','lead_duplicate_submission',
 'lead_reassigned','new_opportunity_after_terminal','quote_accepted','quote_created','quote_updated','status_changed',
 'task_completed','task_completed_auto','treatment_started']) t;
insert into public.lead_events (clinic_id,lead_id,event_type,title,description,metadata,created_by) values
 ('ac100000-0000-4000-8000-000000000002','ac400000-0000-4000-8000-000000000002','administrative_note',
 'FOREIGN_TITLE_CANARY','FOREIGN_DESCRIPTION_CANARY','{"secret":"FOREIGN_METADATA_CANARY"}','ac200000-0000-4000-8000-000000000005');
insert into public.audit_logs (clinic_id,action,table_name,row_id,metadata) values
 ('ac100000-0000-4000-8000-000000000001','RESTRICTED_AUDIT_CANARY','leads','ac400000-0000-4000-8000-000000000001','{"secret":"RESTRICTED_AUDIT_CANARY"}');
insert into public.clinic_public_forms (clinic_id,clinic_slug,public_token) values
 ('ac100000-0000-4000-8000-000000000001','activity-content-a','lf_RESTRICTED_FORM_CANARY_0123456789abcdef');

select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $test$
declare actor integer; payload jsonb; row_count integer; error_text text;
begin
 for actor in 1..4 loop
  perform set_config('request.jwt.claim.sub','ac200000-0000-4000-8000-'||lpad(actor::text,12,'0'),true);
  select jsonb_agg(to_jsonb(t)),count(*) into payload,row_count from public.list_contact_timeline_v1(
   'ac100000-0000-4000-8000-000000000001','ac300000-0000-4000-8000-000000000001',100,null,null) t;
  if row_count<>23 then raise exception 'Missing shared event types for actor %: %',actor,row_count; end if;
  if payload::text ~ 'RESTRICTED_|FOREIGN_|UNPROJECTED_METADATA_CANARY|@example.test' then
   raise exception 'Timeline exposed content outside its projection, actor %',actor;
  end if;
  if exists(select from jsonb_array_elements(payload) t where
    t->>'title' <> 'SHARED_TITLE_'||(t->>'event_type') or t->>'description' <> 'SHARED_DESCRIPTION_'||(t->>'event_type') or
    t->>'actor_id'<>'ac200000-0000-4000-8000-000000000003' or t->>'actor_name'<>'Safe actor' or
    t->>'opportunity_id'<>'ac400000-0000-4000-8000-000000000001' or t->>'contact_id'<>'ac300000-0000-4000-8000-000000000001' or
    t->>'channel'<>'note' or t->>'outcome'<>'note' or t ? 'metadata') then
   raise exception 'Shared content/actor/related reference contract broken';
  end if;
  -- Positive controls prevent a vacuous test: raw operational metadata IS record-readable today.
  if not exists(select from public.lead_events where metadata::text like '%UNPROJECTED_METADATA_CANARY%') then
   raise exception 'Existing shared record policy changed unexpectedly';
  end if;
  if exists(select from public.lead_events where title='FOREIGN_TITLE_CANARY') then raise exception 'Foreign direct RLS leak'; end if;
  select count(*) into row_count from public.audit_logs where action='RESTRICTED_AUDIT_CANARY';
  if row_count <> (case when actor<=2 then 1 else 0 end) then raise exception 'Audit content role policy failed'; end if;
  select count(*) into row_count from public.clinic_public_forms where public_token='lf_RESTRICTED_FORM_CANARY_0123456789abcdef';
  if row_count <> (case when actor<=2 then 1 else 0 end) then raise exception 'Form content role policy failed'; end if;
  begin
   perform public.list_contact_timeline_v1('ac100000-0000-4000-8000-000000000002','ac300000-0000-4000-8000-000000000002');
   raise exception 'Foreign clinic accepted';
  exception when insufficient_privilege then
   get stacked diagnostics error_text=message_text;
   if error_text ~ 'CANARY|@example.test' then raise exception 'Sensitive error content'; end if;
  end;
  begin
   perform public.list_contact_timeline_v1('ac100000-0000-4000-8000-000000000001','ac300000-0000-4000-8000-000000000002');
   raise exception 'Foreign contact accepted';
  exception when no_data_found then null; end;
 end loop;
 for actor in 5..6 loop
  perform set_config('request.jwt.claim.sub','ac200000-0000-4000-8000-'||lpad(actor::text,12,'0'),true);
  if exists(select from public.audit_logs where action='RESTRICTED_AUDIT_CANARY') then raise exception 'Foreign/inactive audit leak'; end if;
  begin
   perform public.list_contact_timeline_v1('ac100000-0000-4000-8000-000000000001','ac300000-0000-4000-8000-000000000001');
   raise exception 'Foreign/inactive timeline accepted';
  exception when insufficient_privilege then null; end;
 end loop;
end;
$test$;
reset role;
do $test$
begin
 if has_function_privilege('anon','public.list_contact_timeline_v1(uuid,uuid,integer,timestamptz,uuid)','execute') then
  raise exception 'Anonymous timeline grant';
 end if;
 if exists(select from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'
  and tablename in ('lead_events','audit_logs','clinic_public_forms')) then
  raise exception 'Content tables now published: runtime Realtime privacy matrix required';
 end if;
end;
$test$;
rollback;
select 'activity-content-permissions: PASS (fixtures rolled back)' as result;
