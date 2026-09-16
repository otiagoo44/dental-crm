-- Contact 360 becomes an operating record without duplicating the existing
-- opportunity event stream. Interactions remain immutable lead_events and the
-- contact timeline projects events across every opportunity for the contact.

create function public.get_contact_operating_summary_v1(
  p_clinic_id uuid,
  p_contact_id uuid
)
returns table (
  id uuid,
  clinic_id uuid,
  name text,
  phone text,
  phone_plus text,
  responsible_id uuid,
  responsible_name text,
  last_interaction_at timestamptz,
  last_interaction_type text,
  last_interaction_title text,
  next_action text,
  next_followup_at timestamptz,
  active_opportunity_count bigint,
  opportunity_count bigint,
  next_appointment_id uuid,
  next_appointment_at timestamptz,
  next_appointment_treatment text,
  next_appointment_status text
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  current_profile public.profiles;
begin
  select p.* into current_profile
  from public.profiles p
  where p.id = (select auth.uid())
    and p.active is true
  limit 1;

  if current_profile.id is null or current_profile.clinic_id <> p_clinic_id then
    raise exception using errcode = '42501', message = 'No tenés acceso a este contacto';
  end if;

  return query
  with selected_contact as materialized (
    select c.id, c.clinic_id, c.name, c.phone, c.phone_plus
    from public.contacts c
    where c.id = p_contact_id
      and c.clinic_id = p_clinic_id
  ),
  opportunity_summary as (
    select
      count(*) as total,
      count(*) filter (
        where not coalesce(l.is_archived, false)
          and l.status not in ('Perdido', 'Tratamiento Iniciado', 'Archivado')
      ) as active
    from public.leads l
    join selected_contact c on c.id = l.contact_id and c.clinic_id = l.clinic_id
  )
  select
    c.id,
    c.clinic_id,
    c.name,
    c.phone,
    c.phone_plus,
    next_opportunity.assigned_to,
    responsible.full_name,
    last_interaction.created_at,
    last_interaction.event_type,
    last_interaction.title,
    next_opportunity.next_action,
    next_opportunity.next_followup_at,
    summary.active,
    summary.total,
    next_appointment.id,
    next_appointment.appointment_at,
    next_appointment.treatment_scheduled,
    next_appointment.status
  from selected_contact c
  cross join opportunity_summary summary
  left join lateral (
    select l.id, l.assigned_to, l.next_action, l.next_followup_at
    from public.leads l
    where l.clinic_id = c.clinic_id
      and l.contact_id = c.id
      and not coalesce(l.is_archived, false)
      and l.status not in ('Perdido', 'Tratamiento Iniciado', 'Archivado')
    order by l.next_followup_at asc nulls last, l.created_at desc, l.id desc
    limit 1
  ) next_opportunity on true
  left join public.profiles responsible
    on responsible.id = next_opportunity.assigned_to
   and responsible.clinic_id = c.clinic_id
  left join lateral (
    select e.created_at, e.event_type, e.title
    from public.lead_events e
    join public.leads l on l.id = e.lead_id and l.clinic_id = e.clinic_id
    where l.contact_id = c.id
      and l.clinic_id = c.clinic_id
      and (
        e.event_type in (
          'lead_contacted', 'contact_attempted', 'contact_responded',
          'contact_postponed', 'administrative_note'
        )
        or e.event_type like 'interaction_%'
      )
    order by e.created_at desc, e.id desc
    limit 1
  ) last_interaction on true
  left join lateral (
    select
      a.id,
      (a.appointment_date + a.appointment_time) at time zone 'America/Asuncion' as appointment_at,
      a.treatment_scheduled,
      a.status
    from public.appointments a
    join public.leads l on l.id = a.lead_id and l.clinic_id = a.clinic_id
    where l.contact_id = c.id
      and l.clinic_id = c.clinic_id
      and a.status in ('Agendado', 'Confirmado', 'Reprogramado')
      and (a.appointment_date + a.appointment_time) at time zone 'America/Asuncion' >= now()
    order by a.appointment_date, a.appointment_time, a.id
    limit 1
  ) next_appointment on true;
end;
$function$;

revoke all on function public.get_contact_operating_summary_v1(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_contact_operating_summary_v1(uuid, uuid)
  to authenticated;

create function public.list_contact_timeline_v1(
  p_clinic_id uuid,
  p_contact_id uuid,
  p_limit integer default 25,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  clinic_id uuid,
  contact_id uuid,
  opportunity_id uuid,
  opportunity_label text,
  event_type text,
  title text,
  description text,
  channel text,
  outcome text,
  actor_id uuid,
  actor_name text,
  occurred_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  current_profile public.profiles;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100
     or (p_cursor_created_at is null) <> (p_cursor_id is null) then
    raise exception using errcode = '22023', message = 'Consulta de actividad inválida';
  end if;

  select p.* into current_profile
  from public.profiles p
  where p.id = (select auth.uid())
    and p.active is true
  limit 1;

  if current_profile.id is null or current_profile.clinic_id <> p_clinic_id then
    raise exception using errcode = '42501', message = 'No tenés acceso a este contacto';
  end if;

  if not exists (
    select 1 from public.contacts c
    where c.id = p_contact_id and c.clinic_id = p_clinic_id
  ) then
    raise exception using errcode = 'P0002', message = 'Contacto no encontrado';
  end if;

  return query
  select
    e.id,
    e.clinic_id,
    l.contact_id,
    l.id,
    coalesce(nullif(btrim(l.treatment), ''), 'Tratamiento por definir'),
    e.event_type,
    e.title,
    e.description,
    e.metadata ->> 'channel',
    e.metadata ->> 'outcome',
    e.created_by,
    coalesce(actor.full_name, case when e.created_by is null then 'Sistema' else 'Usuario de la clínica' end),
    e.created_at
  from public.lead_events e
  join public.leads l
    on l.id = e.lead_id
   and l.clinic_id = e.clinic_id
  left join public.profiles actor
    on actor.id = e.created_by
   and actor.clinic_id = e.clinic_id
  where e.clinic_id = p_clinic_id
    and l.contact_id = p_contact_id
    and (
      p_cursor_id is null
      or (e.created_at, e.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by e.created_at desc, e.id desc
  limit p_limit + 1;
end;
$function$;

revoke all on function public.list_contact_timeline_v1(uuid, uuid, integer, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.list_contact_timeline_v1(uuid, uuid, integer, timestamptz, uuid)
  to authenticated;

create function public.register_contact_interaction_v1(
  p_clinic_id uuid,
  p_contact_id uuid,
  p_opportunity_id uuid,
  p_channel text,
  p_outcome text,
  p_note text default null,
  p_next_action text default null,
  p_next_followup_at timestamptz default null,
  p_assigned_to uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  current_profile public.profiles;
  lead_record public.leads;
  normalized_channel text := lower(btrim(coalesce(p_channel, '')));
  normalized_outcome text := lower(btrim(coalesce(p_outcome, '')));
  normalized_note text := nullif(btrim(p_note), '');
  normalized_next_action text := nullif(btrim(p_next_action), '');
  recent_duplicate boolean := false;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if normalized_channel not in ('whatsapp', 'call', 'email', 'in_person', 'note')
     or normalized_outcome not in ('sent', 'completed', 'responded', 'no_response', 'note')
     or not (
       (normalized_channel in ('whatsapp', 'email') and normalized_outcome in ('sent', 'responded', 'no_response'))
       or (normalized_channel = 'call' and normalized_outcome in ('completed', 'responded', 'no_response'))
       or (normalized_channel = 'in_person' and normalized_outcome in ('completed', 'responded'))
       or (normalized_channel = 'note' and normalized_outcome = 'note')
     ) then
    raise exception using errcode = '22023', message = 'Tipo o resultado de interacción inválido';
  end if;

  if length(coalesce(normalized_note, '')) > 2000
     or length(coalesce(normalized_next_action, '')) > 160
     or (normalized_channel = 'note' and normalized_note is null)
     or (normalized_next_action is null) <> (p_next_followup_at is null)
     or p_next_followup_at < now() - interval '5 minutes' then
    raise exception using errcode = '22023', message = 'Datos de interacción inválidos';
  end if;

  select p.* into current_profile
  from public.profiles p
  where p.id = current_user_id
    and p.active is true
    and p.clinic_id = p_clinic_id
    and p.role in ('admin', 'owner', 'receptionist')
  limit 1;

  if current_profile.id is null then
    raise exception using errcode = '42501', message = 'No tenés acceso a esta clínica';
  end if;

  select l.* into lead_record
  from public.leads l
  where l.clinic_id = p_clinic_id
    and l.contact_id = p_contact_id
    and (p_opportunity_id is null or l.id = p_opportunity_id)
  order by
    case when not coalesce(l.is_archived, false)
      and l.status not in ('Perdido', 'Tratamiento Iniciado', 'Archivado') then 0 else 1 end,
    l.next_followup_at asc nulls last,
    l.created_at desc,
    l.id desc
  limit 1
  for update;

  if lead_record.id is null then
    raise exception using errcode = 'P0002', message = 'Oportunidad del contacto no encontrada';
  end if;

  if p_assigned_to is not null and p_assigned_to is distinct from lead_record.assigned_to then
    perform public.reassign_lead_owner(lead_record.id, p_assigned_to);
  end if;

  if normalized_outcome in ('responded', 'no_response') then
    perform public.register_lead_outcome(
      lead_record.id,
      normalized_outcome,
      normalized_note,
      p_next_followup_at
    );
  elsif normalized_outcome in ('sent', 'completed') then
    select exists (
      select 1
      from public.lead_events e
      where e.clinic_id = lead_record.clinic_id
        and e.lead_id = lead_record.id
        and e.created_by = current_user_id
        and e.event_type = 'lead_contacted'
        and e.metadata ->> 'channel' = normalized_channel
        and e.created_at >= now() - interval '10 seconds'
    ) into recent_duplicate;

    if not recent_duplicate then
      perform public.mark_lead_contacted(
        lead_record.id,
        normalized_channel,
        normalized_note,
        normalized_next_action,
        p_next_followup_at
      );
    end if;
  else
    select exists (
      select 1
      from public.lead_events e
      where e.clinic_id = lead_record.clinic_id
        and e.lead_id = lead_record.id
        and e.created_by = current_user_id
        and e.event_type = 'administrative_note'
        and e.description = normalized_note
        and e.created_at >= now() - interval '10 seconds'
    ) into recent_duplicate;

    if not recent_duplicate then
      insert into public.lead_events (
        clinic_id, lead_id, event_type, title, description, metadata, created_by
      ) values (
        lead_record.clinic_id,
        lead_record.id,
        'administrative_note',
        'Nota administrativa',
        normalized_note,
        jsonb_build_object('channel', 'note', 'outcome', 'note', 'contact_id', p_contact_id),
        current_user_id
      );
    end if;
  end if;

  if normalized_next_action is not null and normalized_outcome in ('responded', 'no_response', 'note') then
    perform public.save_lead_followup(
      lead_record.id,
      null,
      normalized_next_action,
      p_next_followup_at
    );
  end if;

  return lead_record.id;
end;
$function$;

revoke all on function public.register_contact_interaction_v1(uuid, uuid, uuid, text, text, text, text, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.register_contact_interaction_v1(uuid, uuid, uuid, text, text, text, text, timestamptz, uuid)
  to authenticated;
