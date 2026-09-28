\set ON_ERROR_STOP on
begin;
do $$ declare s record; actual jsonb; contact_a uuid; contact_b uuid; begin
 for s in select * from upgrade_test.snapshot loop
  if s.table_name='leads' then
   select jsonb_agg(to_jsonb(r)-'contact_id' order by (to_jsonb(r)-'contact_id')::text) into actual from public.leads r;
  else
   execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text), ''[]''::jsonb) from public.%I r',s.table_name) into actual;
  end if;
  if actual is distinct from s.rows then raise exception 'Upgrade changed existing % rows/IDs/values',s.table_name; end if;
 end loop;
 if (select count(*) from public.contacts)<>2 then raise exception 'Contact backfill must dedupe only within clinic'; end if;
 select contact_id into contact_a from public.leads where id='ab400000-0000-4000-8000-000000000001';
 select contact_id into contact_b from public.leads where id='ab400000-0000-4000-8000-000000000003';
 if contact_a=contact_b or contact_a is null or contact_b is null or contact_a<>(select contact_id from public.leads where id='ab400000-0000-4000-8000-000000000002') then
  raise exception 'Contact/opportunity backfill relationships failed';
 end if;
 if exists(select from public.leads l left join public.contacts c on c.id=l.contact_id and c.clinic_id=l.clinic_id where c.id is null) then raise exception 'Contact FK orphan'; end if;
end $$;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','ab200000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare c uuid; v uuid; begin
 select contact_id into c from public.leads where id='ab400000-0000-4000-8000-000000000001';
 if (select count(*) from public.leads)<>2 or (select count(*) from public.contacts)<>1 then raise exception 'Upgraded RLS cross tenant'; end if;
 if not exists(select from public.get_contact_operating_summary_v1('ab100000-0000-4000-8000-000000000001',c)) then raise exception 'Upgraded Contact 360 missing'; end if;
 if not exists(select from public.list_contact_timeline_v1('ab100000-0000-4000-8000-000000000001',c) where description='Preserve history') then raise exception 'Upgraded timeline missing'; end if;
 if not exists(select from public.search_dentflow_v1('ab100000-0000-4000-8000-000000000001','Upgrade',12)) then raise exception 'Upgraded search missing'; end if;
 if not exists(select from public.list_work_items_v1('ab100000-0000-4000-8000-000000000001','my_work',25)) then raise exception 'Upgraded Work missing'; end if;
 select id into v from public.create_saved_view_v1('work','Upgrade view','private','{}','[]');
 if not exists(select from public.list_saved_views_v1('work') where id=v) then raise exception 'Upgraded saved view missing'; end if;
 if (select count(*) from public.appointments)<>1 or (select count(*) from public.quotes)<>1 then raise exception 'Legacy agenda/quotes inaccessible'; end if;
end $$;
reset role;
rollback;
select 'upgrade integrity and operational projections: PASS' as result;
