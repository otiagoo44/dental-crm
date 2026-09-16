-- Bounded tenant search for the CRM shell. This intentionally searches only
-- administrative Contact and Opportunity fields; no notes or clinical data.
create function public.search_dentflow_v1(
  p_clinic_id uuid,
  p_query text,
  p_limit integer default 12
)
returns table (
  result_type text,
  result_id uuid,
  contact_id uuid,
  opportunity_id uuid,
  title text,
  subtitle text,
  phone text,
  match_rank integer,
  updated_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  actor_clinic_id uuid;
  search_text text := lower(btrim(coalesce(p_query, '')));
  search_digits text := regexp_replace(coalesce(p_query, ''), '[^0-9]', '', 'g');
begin
  if char_length(search_text) < 2 or char_length(search_text) > 80 then
    raise exception using errcode = '22023', message = 'Search must contain 2 to 80 characters';
  end if;
  if p_limit < 1 or p_limit > 20 then
    raise exception using errcode = '22023', message = 'Invalid search limit';
  end if;

  select p.clinic_id into actor_clinic_id
  from public.profiles p
  where p.id = (select auth.uid()) and p.active is true;

  if actor_clinic_id is null or actor_clinic_id <> p_clinic_id then
    raise exception using errcode = '42501', message = 'Clinic access denied';
  end if;

  return query
  with contact_matches as materialized (
    select
      'contact'::text result_type, c.id result_id, c.id contact_id,
      null::uuid opportunity_id, c.name title,
      concat(count(l.id), case when count(l.id) = 1 then ' oportunidad' else ' oportunidades' end)::text subtitle,
      coalesce(c.phone_plus, c.phone) phone,
      case
        when lower(c.name) = search_text
          or (char_length(search_digits) >= 3 and c.phone_key = search_digits) then 0
        when lower(c.name) like search_text || '%'
          or (char_length(search_digits) >= 3 and c.phone_key like search_digits || '%') then 1
        else 2
      end match_rank,
      c.updated_at
    from public.contacts c
    left join public.leads l on l.clinic_id = c.clinic_id and l.contact_id = c.id
    where c.clinic_id = p_clinic_id
      and (
        position(search_text in lower(c.name)) > 0
        or position(search_text in lower(coalesce(c.phone, ''))) > 0
        or position(search_text in lower(coalesce(c.phone_plus, ''))) > 0
        or (char_length(search_digits) >= 3 and position(search_digits in coalesce(c.phone_key, '')) > 0)
      )
    group by c.id, c.clinic_id, c.name, c.phone, c.phone_plus, c.phone_key, c.updated_at
    order by 8, 9 desc, 2
    limit p_limit
  ),
  opportunity_matches as materialized (
    select
      'opportunity'::text result_type, l.id result_id, l.contact_id,
      l.id opportunity_id,
      coalesce(nullif(btrim(l.treatment), ''), 'Tratamiento por definir') title,
      concat(l.name, ' · ', coalesce(l.status, 'Sin estado'))::text subtitle,
      coalesce(l.phone_plus, l.phone) phone,
      case
        when lower(coalesce(l.treatment, '')) = search_text then 0
        when lower(coalesce(l.treatment, '')) like search_text || '%' then 1
        else 2
      end match_rank,
      l.updated_at
    from public.leads l
    where l.clinic_id = p_clinic_id
      and l.contact_id is not null
      and position(search_text in lower(coalesce(l.treatment, ''))) > 0
    order by 8, 9 desc, 2
    limit p_limit
  ),
  combined as (
    select * from contact_matches
    union all
    select * from opportunity_matches
  )
  select combined.result_type, combined.result_id, combined.contact_id,
    combined.opportunity_id, combined.title, combined.subtitle, combined.phone,
    combined.match_rank, combined.updated_at
  from combined
  order by combined.match_rank, combined.updated_at desc,
    case combined.result_type when 'contact' then 0 else 1 end,
    combined.result_id
  limit p_limit;
end;
$function$;

revoke all on function public.search_dentflow_v1(uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.search_dentflow_v1(uuid, text, integer)
  to authenticated;
