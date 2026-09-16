\set ON_ERROR_STOP on

do $check$
declare missing text;
begin
  select string_agg(name, ', ') into missing from unnest(array['clinics','profiles','contacts','leads','appointments','tasks','quotes','lead_events','clinic_public_forms','form_submission_logs']) name
  where to_regclass('public.'||name) is null;
  if missing is not null then raise exception 'Missing required tables: %',missing; end if;

  select string_agg(c.relname, ', ') into missing from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname=any(array['profiles','contacts','leads','appointments','tasks','quotes','lead_events']) and not c.relrowsecurity;
  if missing is not null then raise exception 'RLS disabled: %',missing; end if;

  if to_regprocedure('public.list_contacts_page(uuid,integer,text,text,timestamp with time zone,uuid,uuid)') is null then raise exception 'Missing list_contacts_page'; end if;
  if to_regprocedure('public.list_work_items_v1(uuid,text,integer,uuid,integer,timestamp with time zone,integer,text)') is null then raise exception 'Missing list_work_items_v1'; end if;
  if to_regprocedure('public.create_public_lead_intake(uuid,text,text,text,text,text,text,text,integer,text,text,text,text,numeric,timestamp with time zone,text,text,text,text,timestamp with time zone,text,text)') is null then raise exception 'Missing public intake RPC'; end if;
  if has_function_privilege('anon','public.list_work_items_v1(uuid,text,integer,uuid,integer,timestamp with time zone,integer,text)','EXECUTE') then raise exception 'Anon can execute Work RPC'; end if;
  if not has_function_privilege('authenticated','public.list_work_items_v1(uuid,text,integer,uuid,integer,timestamp with time zone,integer,text)','EXECUTE') then raise exception 'Authenticated missing Work RPC grant'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.leads'::regclass and contype='f' and confrelid='public.contacts'::regclass) then raise exception 'Missing lead-contact FK'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.tasks'::regclass and contype='f' and confrelid='public.leads'::regclass) then raise exception 'Missing task-lead FK'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.quotes'::regclass and contype='f' and confrelid='public.leads'::regclass) then raise exception 'Missing quote-lead FK'; end if;
end $check$;

select 'database-from-zero: PASS' as result;
