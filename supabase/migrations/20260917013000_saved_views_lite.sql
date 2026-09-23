-- Small, tenant-scoped saved views. This is intentionally not a metadata engine.
create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  entity text not null check (entity in ('work','patients','opportunities')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  visibility text not null default 'private' check (visibility in ('private','team')),
  view_type text not null default 'list' check (view_type in ('list')),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  sorts jsonb not null default '[]'::jsonb check (jsonb_typeof(sorts) = 'array'),
  columns jsonb check (columns is null or jsonb_typeof(columns) = 'array'),
  group_by text,
  position integer not null default 0 check (position >= 0),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_views_user_required check (is_system or user_id is not null)
);

create index if not exists saved_views_clinic_entity_position_idx
  on public.saved_views (clinic_id, entity, position, created_at, id);
create unique index if not exists saved_views_user_entity_name_idx
  on public.saved_views (clinic_id, user_id, entity, lower(name))
  where is_system is false;

alter table public.saved_views enable row level security;

drop policy if exists saved_views_select_same_clinic on public.saved_views;
create policy saved_views_select_same_clinic on public.saved_views
  for select to authenticated
  using (
    app_private.is_clinic_member(clinic_id)
    and (is_system or visibility = 'team' or user_id = (select auth.uid()) or app_private.is_clinic_admin(clinic_id))
  );

drop policy if exists saved_views_insert_own on public.saved_views;
create policy saved_views_insert_own on public.saved_views
  for insert to authenticated
  with check (
    app_private.is_clinic_member(clinic_id)
    and is_system is false
    and user_id = (select auth.uid())
    and (visibility = 'private' or app_private.is_clinic_admin(clinic_id))
  );

drop policy if exists saved_views_update_own on public.saved_views;
create policy saved_views_update_own on public.saved_views
  for update to authenticated
  using (app_private.is_clinic_member(clinic_id) and is_system is false and (user_id = (select auth.uid()) or app_private.is_clinic_admin(clinic_id)))
  with check (app_private.is_clinic_member(clinic_id) and is_system is false and (user_id = (select auth.uid()) or app_private.is_clinic_admin(clinic_id)));

drop policy if exists saved_views_delete_own on public.saved_views;
create policy saved_views_delete_own on public.saved_views
  for delete to authenticated
  using (app_private.is_clinic_member(clinic_id) and is_system is false and (user_id = (select auth.uid()) or app_private.is_clinic_admin(clinic_id)));

create or replace function public.list_saved_views_v1(p_clinic_id uuid, p_entity text)
returns table (
  id uuid, clinic_id uuid, user_id uuid, entity text, name text, visibility text,
  view_type text, filters jsonb, sorts jsonb, columns jsonb, group_by text,
  position integer, is_system boolean, created_at timestamptz, updated_at timestamptz
)
language plpgsql security invoker set search_path = ''
as $function$
declare
  actor_clinic_id uuid;
  normalized_entity text := lower(btrim(coalesce(p_entity, '')));
begin
  if normalized_entity not in ('work', 'patients', 'opportunities') then
    raise exception using errcode = '22023', message = 'Invalid saved view entity';
  end if;
  select p.clinic_id into actor_clinic_id
  from public.profiles p
  where p.id = (select auth.uid()) and p.active is true;
  if actor_clinic_id is null or actor_clinic_id <> p_clinic_id then
    raise exception using errcode = '42501', message = 'Clinic access denied';
  end if;
  return query
    select v.id, v.clinic_id, v.user_id, v.entity, v.name, v.visibility,
      v.view_type, v.filters, v.sorts, v.columns, v.group_by, v.position,
      v.is_system, v.created_at, v.updated_at
    from public.saved_views v
    where v.clinic_id = p_clinic_id and v.entity = normalized_entity
      and (v.is_system or v.visibility = 'team' or v.user_id = (select auth.uid()) or app_private.is_clinic_admin(v.clinic_id))
    order by v.is_system desc, v.position, lower(v.name), v.id;
end;
$function$;

create or replace function public.create_saved_view_v1(
  p_clinic_id uuid,
  p_entity text,
  p_name text,
  p_visibility text default 'private',
  p_view_type text default 'list',
  p_filters jsonb default '{}'::jsonb,
  p_sorts jsonb default '[]'::jsonb,
  p_columns jsonb default null,
  p_group_by text default null
)
returns public.saved_views
language plpgsql security invoker set search_path = ''
as $function$
declare
  actor_clinic_id uuid;
  actor_role text;
  normalized_entity text := lower(btrim(coalesce(p_entity, '')));
  normalized_visibility text := lower(btrim(coalesce(p_visibility, 'private')));
  normalized_name text := btrim(coalesce(p_name, ''));
  created public.saved_views;
  key text;
  allowed text[];
begin
  if normalized_entity not in ('work', 'patients', 'opportunities') then raise exception using errcode = '22023', message = 'Invalid saved view entity'; end if;
  if normalized_visibility not in ('private', 'team') then raise exception using errcode = '22023', message = 'Invalid saved view visibility'; end if;
  if lower(coalesce(p_view_type, 'list')) <> 'list' then raise exception using errcode = '22023', message = 'Invalid saved view type'; end if;
  if char_length(normalized_name) < 1 or char_length(normalized_name) > 80 then raise exception using errcode = '22023', message = 'Invalid saved view name'; end if;
  if jsonb_typeof(coalesce(p_filters, '{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_sorts, '[]'::jsonb)) <> 'array' or (p_columns is not null and jsonb_typeof(p_columns) <> 'array') then
    raise exception using errcode = '22023', message = 'Invalid saved view payload';
  end if;
  select p.clinic_id, p.role into actor_clinic_id, actor_role from public.profiles p where p.id = (select auth.uid()) and p.active is true;
  if actor_clinic_id is null or actor_clinic_id <> p_clinic_id then raise exception using errcode = '42501', message = 'Clinic access denied'; end if;
  if normalized_visibility = 'team' and actor_role not in ('owner', 'admin') then raise exception using errcode = '42501', message = 'Team views require owner or admin'; end if;
  allowed := case normalized_entity
    when 'work' then array['view','assignedTo']
    when 'patients' then array['q','view']
    else array['status','treatment','classification','priority','assigned','source','date','sort','showArchived']
  end;
  for key in select jsonb_object_keys(coalesce(p_filters, '{}'::jsonb)) loop
    if not (key = any(allowed)) then raise exception using errcode = '22023', message = 'Unsupported saved view filter'; end if;
  end loop;
  insert into public.saved_views (clinic_id, user_id, entity, name, visibility, view_type, filters, sorts, columns, group_by)
  values (p_clinic_id, (select auth.uid()), normalized_entity, normalized_name, normalized_visibility, 'list', coalesce(p_filters, '{}'::jsonb), coalesce(p_sorts, '[]'::jsonb), p_columns, nullif(btrim(p_group_by), ''))
  returning * into created;
  return created;
exception when unique_violation then
  raise exception using errcode = '23505', message = 'A saved view with this name already exists';
end;
$function$;

revoke all on function public.list_saved_views_v1(uuid, text) from public, anon;
revoke all on function public.create_saved_view_v1(uuid, text, text, text, text, jsonb, jsonb, jsonb, text) from public, anon;
grant execute on function public.list_saved_views_v1(uuid, text) to authenticated;
grant execute on function public.create_saved_view_v1(uuid, text, text, text, text, jsonb, jsonb, jsonb, text) to authenticated;
