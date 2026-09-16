-- Bounded contact discovery. Invoker security deliberately preserves table RLS.
create index contacts_clinic_created_id_idx on public.contacts (clinic_id, created_at desc, id desc);

create function public.list_contacts_page(
  p_clinic_id uuid,
  p_limit integer default 25,
  p_search text default '',
  p_filter text default 'all',
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_contact_id uuid default null
)
returns table (
  id uuid, clinic_id uuid, name text, phone text, phone_plus text,
  created_at timestamptz, updated_at timestamptz,
  last_contact_at timestamptz, opportunity_count bigint, active_opportunity_count bigint,
  next_action text, next_followup_at timestamptz, responsible_name text
)
language plpgsql stable security invoker set search_path = ''
as $function$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100
     or p_filter is null or p_filter not in ('all', 'active', 'unassigned')
     or length(coalesce(p_search, '')) > 160
     or (p_cursor_created_at is null) <> (p_cursor_id is null) then
    raise exception using errcode = '22023', message = 'Invalid contact query';
  end if;
  return query
  with page as materialized (
    select c.id, c.clinic_id, c.name, c.phone, c.phone_plus, c.created_at, c.updated_at
    from public.contacts c
    where c.clinic_id = p_clinic_id
      and (p_contact_id is null or c.id = p_contact_id)
      and (p_cursor_id is null or (c.created_at, c.id) < (p_cursor_created_at, p_cursor_id))
      and (coalesce(p_search, '') = '' or position(lower(p_search) in lower(c.name)) > 0
        or position(p_search in coalesce(c.phone, '')) > 0
        or position(p_search in coalesce(c.phone_plus, '')) > 0)
      and (p_filter = 'all' or exists (
        select 1 from public.leads l where l.clinic_id = c.clinic_id and l.contact_id = c.id
          and not coalesce(l.is_archived, false)
          and l.status not in ('Perdido', 'Tratamiento Iniciado', 'Archivado')
          and (p_filter = 'active' or l.assigned_to is null)
      ))
    order by c.created_at desc, c.id desc
    limit p_limit + 1
  )
  select c.id, c.clinic_id, c.name, c.phone, c.phone_plus, c.created_at, c.updated_at,
    summary.last_contact_at, summary.total, summary.active,
    next_lead.next_action, next_lead.next_followup_at, p.full_name
  from page c
  cross join lateral (
    select max(l.last_contact_at) as last_contact_at, count(*) as total,
      count(*) filter (where not coalesce(l.is_archived, false)
        and l.status not in ('Perdido', 'Tratamiento Iniciado', 'Archivado')) as active
    from public.leads l where l.clinic_id = c.clinic_id and l.contact_id = c.id
  ) summary
  left join lateral (
    select l.next_action, l.next_followup_at, l.assigned_to
    from public.leads l where l.clinic_id = c.clinic_id and l.contact_id = c.id
      and not coalesce(l.is_archived, false)
      and l.status not in ('Perdido', 'Tratamiento Iniciado', 'Archivado')
    order by l.next_followup_at asc nulls last, l.created_at desc, l.id desc limit 1
  ) next_lead on true
  left join public.profiles p on p.id = next_lead.assigned_to and p.clinic_id = c.clinic_id
  order by c.created_at desc, c.id desc;
end;
$function$;
revoke all on function public.list_contacts_page(uuid,integer,text,text,timestamptz,uuid,uuid) from public, anon;
grant execute on function public.list_contacts_page(uuid,integer,text,text,timestamptz,uuid,uuid) to authenticated;

-- Contacts were absent from this publication; other legacy tables stay intact.
alter publication supabase_realtime add table public.contacts;
