-- Recovered intent only from backup 20260917013000; that draft was never applied.
-- System views remain product code. Slots enforce quotas even for concurrent/direct writes.
create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity text not null check (entity in ('work','patients','opportunities')),
  name text not null check (char_length(name) between 1 and 80 and name=btrim(name)),
  visibility text not null check (visibility in ('private','team')),
  filters jsonb not null default '{}' check (jsonb_typeof(filters)='object' and octet_length(filters::text)<=2048),
  sorts jsonb not null default '[]' check (jsonb_typeof(sorts)='array' and octet_length(sorts::text)<=128),
  slot smallint not null check (slot between 1 and case when visibility='private' then 20 else 30 end),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create unique index saved_views_private_name on public.saved_views(clinic_id,user_id,entity,lower(name)) where visibility='private';
create unique index saved_views_team_name on public.saved_views(clinic_id,entity,lower(name)) where visibility='team';
create unique index saved_views_private_slot on public.saved_views(clinic_id,user_id,entity,slot) where visibility='private';
create unique index saved_views_team_slot on public.saved_views(clinic_id,entity,slot) where visibility='team';
alter table public.saved_views enable row level security;
revoke all on public.saved_views from public,anon,authenticated;
-- Invoker RPCs need these grants; the trigger validates all writes including REST.
grant select,insert,update,delete on public.saved_views to authenticated;
create policy saved_views_read on public.saved_views for select to authenticated using (
  app_private.is_clinic_member(clinic_id) and (visibility='team' or user_id=(select auth.uid()))
);
create policy saved_views_create on public.saved_views for insert to authenticated with check (
  app_private.is_clinic_member(clinic_id) and user_id=(select auth.uid())
  and (visibility='private' or app_private.is_clinic_admin(clinic_id))
);
create policy saved_views_edit on public.saved_views for update to authenticated using (
  app_private.is_clinic_member(clinic_id) and
  ((visibility='private' and user_id=(select auth.uid())) or (visibility='team' and app_private.is_clinic_admin(clinic_id)))
) with check (
  app_private.is_clinic_member(clinic_id) and
  ((visibility='private' and user_id=(select auth.uid())) or (visibility='team' and app_private.is_clinic_admin(clinic_id)))
);
create policy saved_views_remove on public.saved_views for delete to authenticated using (
  app_private.is_clinic_member(clinic_id) and
  ((visibility='private' and user_id=(select auth.uid())) or (visibility='team' and app_private.is_clinic_admin(clinic_id)))
);

create function app_private.validate_saved_view_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
  k text; v jsonb; val text; allowed text[]; target_user uuid; max_slots integer;
begin
  if not coalesce(app_private.is_clinic_member(new.clinic_id),false) then
    raise exception using errcode='42501',message='Clinic access denied';
  end if;
  if tg_op='INSERT' then
    if new.user_id is distinct from (select auth.uid()) then raise exception using errcode='42501',message='Creator must be current user'; end if;
    new.created_at:=clock_timestamp();
  else
    if (new.id,new.clinic_id,new.user_id,new.entity,new.created_at) is distinct from
       (old.id,old.clinic_id,old.user_id,old.entity,old.created_at) then
      raise exception using errcode='42501',message='Saved view identity is immutable';
    end if;
    if old.visibility='team' and new.visibility='private' and old.user_id<>(select auth.uid()) then
      raise exception using errcode='42501',message='Only creator can make a team view private';
    end if;
  end if;
  if new.visibility='team' and not app_private.is_clinic_admin(new.clinic_id) then
    raise exception using errcode='42501',message='Team views require owner or admin';
  end if;
  new.name:=btrim(new.name);
  if new.entity is null or new.entity not in ('work','patients','opportunities')
     or new.visibility is null or new.visibility not in ('private','team')
     or new.name is null or char_length(new.name) not between 1 and 80 or new.name ~ '[[:cntrl:]]'
     or new.filters is null or jsonb_typeof(new.filters)<>'object' or octet_length(new.filters::text)>2048
     or new.sorts is null or jsonb_typeof(new.sorts)<>'array' or octet_length(new.sorts::text)>128 then
    raise exception using errcode='22023',message='Invalid saved view payload';
  end if;
  allowed:=case new.entity when 'work' then array['view','assignedTo'] when 'patients' then array['q','view']
    else array['q','status','treatment','classification','priority','assigned','source','date','showArchived'] end;
  for k,v in select * from jsonb_each(new.filters) loop
    if not k=any(allowed) then raise exception using errcode='22023',message='Unsupported saved view filter'; end if;
    if k='showArchived' then
      if jsonb_typeof(v)<>'boolean' then raise exception using errcode='22023',message='Invalid archive filter'; end if;
      continue;
    end if;
    if jsonb_typeof(v)<>'string' then raise exception using errcode='22023',message='Filter must be a string'; end if;
    val:=v#>>'{}';
    if char_length(val)>(case when k='q' then 160 else 80 end) or val ~ '[[:cntrl:]]' then
      raise exception using errcode='22023',message='Invalid filter value';
    end if;
    if k='view' and not (val=any(case new.entity when 'work' then array['my-work','today','overdue','upcoming','initial-contact','followups','confirmations','no-show','quotes','reactivations','unassigned','team'] else array['all','active','unassigned'] end)) then
      raise exception using errcode='22023',message='Invalid view filter';
    elsif k='status' and val not in ('Nuevo','No Contactado','Contactado','Respondió','Consulta Agendada','Confirmado','Asistió','Presupuesto Enviado','Tratamiento Iniciado','No Respondió','Perdido','Reactivar 30d','No Asistió','Archivado') then
      raise exception using errcode='22023',message='Invalid status filter';
    elsif k='classification' and val not in ('Lead Caliente','Lead Medio','Lead Frío') then
      raise exception using errcode='22023',message='Invalid classification filter';
    elsif k='priority' and val not in ('now','today','later') then
      raise exception using errcode='22023',message='Invalid priority filter';
    elsif k='date' and val not in ('today','7d','30d') then
      raise exception using errcode='22023',message='Invalid date filter';
    elsif k in ('assigned','assignedTo') then
      if val !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception using errcode='22023',message='Invalid assignee';
      end if;
      target_user:=val::uuid;
      if not exists(select 1 from public.profiles where id=target_user and clinic_id=new.clinic_id and active is true) then
        raise exception using errcode='22023',message='Invalid assignee';
      end if;
    elsif k in ('treatment','source') and char_length(btrim(val))=0 then
      raise exception using errcode='22023',message='Empty domain filter';
    end if;
    -- Treatment/source are existing tenant-defined literal labels, not expressions.
    if k='treatment' and not exists(select 1 from public.leads where clinic_id=new.clinic_id and treatment=val)
       and not exists(select 1 from public.treatment_prices where clinic_id=new.clinic_id and treatment=val)
       and val not in ('Implante dental','Ortodoncia','Estética dental','Blanqueamiento','Limpieza','Urgencia/dolor','Carillas','Prótesis','Consulta general','Otro') then
      raise exception using errcode='22023',message='Unknown treatment filter';
    end if;
    if k='source' and not exists(select 1 from public.leads where clinic_id=new.clinic_id and coalesce(source_normalized,source)=val)
       and val not in ('WhatsApp directo','Instagram DM','Llamada','Recomendación','Formulario externo','Meta Ads manual','Formulario web','Presencial','Otro','Otros') then
      raise exception using errcode='22023',message='Unknown source filter';
    end if;
  end loop;
  if jsonb_array_length(new.sorts)>1 or (new.entity<>'opportunities' and new.sorts<>'[]') then
    raise exception using errcode='22023',message='Unsupported sorts';
  end if;
  if new.sorts<>'[]' and new.sorts not in (
    '[{"field":"created_at","direction":"desc"}]'::jsonb,'[{"field":"created_at","direction":"asc"}]'::jsonb,
    '[{"field":"name","direction":"asc"}]'::jsonb,'[{"field":"score","direction":"desc"}]'::jsonb
  ) then raise exception using errcode='22023',message='Invalid sort'; end if;
  if tg_op='INSERT' or new.visibility is distinct from old.visibility then
    -- Serialize slot allocation. Unique slot indexes remain the final concurrency barrier.
    perform pg_advisory_xact_lock(hashtextextended(new.clinic_id::text||':'||new.entity,0));
    max_slots:=case when new.visibility='private' then 20 else 30 end;
    select n into new.slot from generate_series(1,max_slots) n where not exists (
      select 1 from public.saved_views s where s.clinic_id=new.clinic_id and s.entity=new.entity
      and s.visibility=new.visibility and (new.visibility='team' or s.user_id=new.user_id) and s.slot=n
    ) order by n limit 1;
    if new.slot is null then raise exception using errcode='54000',message='Saved view limit reached'; end if;
  elsif new.slot is distinct from old.slot then
    raise exception using errcode='42501',message='Saved view slot is immutable';
  end if;
  new.updated_at:=clock_timestamp();
  return new;
end $$;
revoke all on function app_private.validate_saved_view_v1() from public,anon,authenticated;
create trigger saved_views_validate before insert or update on public.saved_views
for each row execute function app_private.validate_saved_view_v1();

create function public.list_saved_views_v1(p_entity text) returns setof public.saved_views
language plpgsql stable security invoker set search_path='' as $$
begin
  if p_entity is null or p_entity not in ('work','patients','opportunities') then raise exception using errcode='22023',message='Invalid entity'; end if;
  if app_private.current_clinic_id() is null then raise exception using errcode='42501',message='Clinic access denied'; end if;
  return query select * from public.saved_views where clinic_id=app_private.current_clinic_id() and entity=p_entity order by visibility,name,id limit 50;
end $$;
create function public.create_saved_view_v1(p_entity text,p_name text,p_visibility text default 'private',p_filters jsonb default '{}',p_sorts jsonb default '[]')
returns public.saved_views language plpgsql security invoker set search_path='' as $$
declare result public.saved_views; clinic uuid:=app_private.current_clinic_id();
begin
  if clinic is null then raise exception using errcode='42501',message='Clinic access denied'; end if;
  insert into public.saved_views(clinic_id,user_id,entity,name,visibility,filters,sorts)
    values(clinic,(select auth.uid()),p_entity,p_name,p_visibility,p_filters,p_sorts) returning * into result;
  return result;
end $$;
create function public.update_saved_view_v1(p_id uuid,p_name text,p_visibility text,p_filters jsonb,p_sorts jsonb)
returns public.saved_views language plpgsql security invoker set search_path='' as $$
declare result public.saved_views;
begin
  update public.saved_views set name=p_name,visibility=p_visibility,filters=p_filters,sorts=p_sorts
    where id=p_id and clinic_id=app_private.current_clinic_id() returning * into result;
  if not found then raise exception using errcode='42501',message='Saved view unavailable'; end if;
  return result;
end $$;
create function public.delete_saved_view_v1(p_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare removed uuid;
begin
  delete from public.saved_views where id=p_id and clinic_id=app_private.current_clinic_id() returning id into removed;
  if not found then raise exception using errcode='42501',message='Saved view unavailable'; end if;
  return removed;
end $$;
revoke all on function public.list_saved_views_v1(text),public.create_saved_view_v1(text,text,text,jsonb,jsonb),public.update_saved_view_v1(uuid,text,text,jsonb,jsonb),public.delete_saved_view_v1(uuid) from public,anon;
grant execute on function public.list_saved_views_v1(text),public.create_saved_view_v1(text,text,text,jsonb,jsonb),public.update_saved_view_v1(uuid,text,text,jsonb,jsonb),public.delete_saved_view_v1(uuid) to authenticated;
comment on table public.saved_views is 'Product filters only. Per entity: 20 private/user + 30 team/clinic. Payload <= 2048 bytes; at most one supported sort. No system metadata, columns or grouping.';
