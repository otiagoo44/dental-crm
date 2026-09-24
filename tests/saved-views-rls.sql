\set ON_ERROR_STOP on
begin;
-- Disposable fixtures; the entire test rolls back, including Auth/profile rows.
insert into public.clinics(id,name,slug) values
 ('a1000000-0000-4000-8000-000000000001','Saved views A','saved-views-test-a'),
 ('a1000000-0000-4000-8000-000000000002','Saved views B','saved-views-test-b');
insert into auth.users(id,email,role,aud)
select ('a2000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 'saved-view-'||n||'@example.test','authenticated','authenticated' from generate_series(1,6) n;
insert into public.profiles(id,clinic_id,full_name,email,role,active)
select id, case when email='saved-view-6@example.test' then 'a1000000-0000-4000-8000-000000000002'::uuid else 'a1000000-0000-4000-8000-000000000001'::uuid end,
 'Saved views test',email,case when email in ('saved-view-3@example.test','saved-view-6@example.test') then 'owner' when email='saved-view-4@example.test' then 'admin' else 'receptionist' end,
 email <> 'saved-view-5@example.test' from auth.users where email like 'saved-view-%@example.test';
create function pg_temp.assert_ok(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.denied(statement text, expected text) returns void language plpgsql as $$
begin
 begin execute statement; exception when others then
   if sqlstate=expected then return; end if; raise;
 end;
 raise exception 'Accepted forbidden operation: %',statement;
end $$;
grant usage on schema auth to authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.create_saved_view_v1('patients','Private A','private','{"view":"active"}','[]');
select pg_temp.assert_ok((select count(*)=1 from public.list_saved_views_v1('patients')),'reception creates private');
select pg_temp.denied($q$select public.create_saved_view_v1('work','Forbidden','team','{}','[]')$q$,'42501');
select pg_temp.denied($q$select public.create_saved_view_v1('bogus','Invalid','private','{}','[]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('work','Invalid','private','{"view":"sql"}','[]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('work','Invalid','private','{"view":null}','[]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('patients','Invalid','private','{"view":{}}','[]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('patients','Invalid','private','{"sql":"select 1"}','[]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('opportunities','Invalid','private','{"showArchived":"true"}','[]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('opportunities','Invalid','private','{"status":"invalid"}','[]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('opportunities','Invalid','private','{"treatment":"select * from users"}','[]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('opportunities','Invalid','private','{"source":"unknown source"}','[]')$q$,'22023');
select public.create_saved_view_v1('opportunities','Valid sort','private','{"status":"Nuevo","treatment":"Ortodoncia","showArchived":false}','[{"field":"created_at","direction":"asc"}]');
select public.delete_saved_view_v1(id) from public.saved_views where name='Valid sort';
select pg_temp.denied($q$select public.create_saved_view_v1('opportunities','Invalid','private','{"assigned":"a2000000-0000-4000-8000-000000000006"}','[]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('work','Invalid','private','{"assignedTo":"a2000000-0000-4000-8000-000000000005"}','[]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('work','Invalid','private','{}','[{"field":"name","direction":"asc"}]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('opportunities','Invalid','private','{}','[{"field":"secret","direction":"asc"}]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('opportunities','Invalid','private','{}','[{"field":"name","direction":"sql"}]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('opportunities','Invalid','private','{}','[{"field":"name","direction":"asc","sql":"x"}]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('opportunities','Invalid','private','{}','[{"field":"name","direction":"asc"},{"field":"name","direction":"asc"}]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('patients','Invalid','private',jsonb_build_object('q',repeat('x',5000)),'[]')$q$,'22023');
select pg_temp.denied($q$select public.create_saved_view_v1('patients','Private A','private','{}','[]')$q$,'23505');
select public.update_saved_view_v1(id,'Renamed A','private',filters,sorts) from public.saved_views where name='Private A';
select pg_temp.assert_ok((select updated_at>=created_at and name='Renamed A' from public.saved_views limit 1),'update');
select set_config('test.private_id',(select id::text from public.saved_views limit 1),true);
select set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_ok((select count(*)=0 from public.saved_views),'second receptionist cannot see private');
select pg_temp.denied($q$select public.update_saved_view_v1(current_setting('test.private_id')::uuid,'Stolen','private','{}','[]')$q$,'42501');
select pg_temp.denied($q$select public.delete_saved_view_v1(current_setting('test.private_id')::uuid)$q$,'42501');
select set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_ok((select count(*)=0 from public.list_saved_views_v1('patients')),'owner cannot see private');
select pg_temp.denied($q$select public.update_saved_view_v1(current_setting('test.private_id')::uuid,'Stolen','team','{}','[]')$q$,'42501');
select public.create_saved_view_v1('work','Team A','team','{"view":"followups"}','[]');
select set_config('test.team_id',(select id::text from public.saved_views where name='Team A'),true);
select set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-000000000004',true);
select pg_temp.assert_ok((select count(*)=0 from public.list_saved_views_v1('patients')),'admin cannot see private');
select pg_temp.denied($q$select public.create_saved_view_v1('work','team a','team','{}','[]')$q$,'23505');
select public.update_saved_view_v1(current_setting('test.team_id')::uuid,'Team renamed','team','{"view":"today"}','[]');
select pg_temp.denied($q$select public.update_saved_view_v1(current_setting('test.team_id')::uuid,'Steal','private','{}','[]')$q$,'42501');
do $$ begin for n in 1..29 loop perform public.create_saved_view_v1('work','Team quota '||n,'team','{}','[]'); end loop; end $$;
select pg_temp.denied($q$select public.create_saved_view_v1('work','Team quota 31','team','{}','[]')$q$,'54000');
select public.delete_saved_view_v1(id) from public.saved_views where name like 'Team quota %';
select set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_ok((select count(*)=1 from public.list_saved_views_v1('work')),'reception uses team');
select pg_temp.denied($q$select public.update_saved_view_v1(current_setting('test.team_id')::uuid,'No','team','{}','[]')$q$,'42501');
select pg_temp.denied($q$select public.delete_saved_view_v1(current_setting('test.team_id')::uuid)$q$,'42501');
-- Direct writes also encounter RLS/trigger validation, never a weaker path.
update public.saved_views set name='Unauthorized' where id=current_setting('test.team_id')::uuid;
select pg_temp.assert_ok((select name='Team renamed' from public.saved_views where id=current_setting('test.team_id')::uuid),'direct team update denied');
select pg_temp.denied($q$update public.saved_views set user_id='a2000000-0000-4000-8000-000000000002' where name='Renamed A'$q$,'42501');
select pg_temp.denied($q$update public.saved_views set filters='{"view":"evil"}' where name='Renamed A'$q$,'22023');
select public.delete_saved_view_v1(current_setting('test.private_id')::uuid);
select pg_temp.assert_ok((select count(*)=0 from public.list_saved_views_v1('patients')),'delete private');
do $$ begin for n in 1..20 loop perform public.create_saved_view_v1('patients','Quota '||n,'private','{}','[]'); end loop; end $$;
select pg_temp.denied($q$select public.create_saved_view_v1('patients','Quota 21','private','{}','[]')$q$,'54000');
select set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-000000000006',true);
select pg_temp.assert_ok((select count(*)=0 from public.saved_views),'clinic B cannot see private or team A');
select pg_temp.denied($q$select public.delete_saved_view_v1(current_setting('test.team_id')::uuid)$q$,'42501');
select set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-000000000005',true);
select pg_temp.assert_ok((select count(*)=0 from public.saved_views),'inactive has no access');
select pg_temp.denied($q$select public.create_saved_view_v1('work','Inactive','private','{}','[]')$q$,'42501');
reset role;
select pg_temp.assert_ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname like '%saved_view%v1' and (p.prosecdef or not 'search_path=""'=any(p.proconfig))),'invoker and fixed path');
set local role anon;
select pg_temp.denied($q$select * from public.saved_views$q$,'42501');
reset role;
rollback;
select 'saved-views-rls: PASS' as result;
