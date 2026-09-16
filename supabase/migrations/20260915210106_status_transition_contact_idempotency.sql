-- DF-009: status assignment counts only transitions, under the existing row lock.
-- Existing SECURITY DEFINER, tenant validation, empty search_path and grants preserved.
create or replace function public.save_lead_followup(
  p_lead_id uuid,
  p_status text default null,
  p_next_action text default null,
  p_next_followup_at timestamptz default null
)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  lead_record public.leads;
  existing_task public.tasks;
  normalized_status text;
  normalized_action text;
  normalized_due_at timestamptz;
  status_changed boolean;
  task_title text;
  task_type text;
  task_priority text;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select l.* into lead_record
  from public.leads l
  where l.id = p_lead_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Lead no encontrado';
  end if;

  if not app_private.has_role(lead_record.clinic_id, array['admin', 'owner', 'receptionist']) then
    raise exception using errcode = '42501', message = 'No tenés acceso a este lead';
  end if;

  normalized_status := coalesce(nullif(btrim(p_status), ''), lead_record.status);
  if p_status is not null and normalized_status in ('Consulta Agendada', 'Confirmado', 'Asistió', 'No Asistió', 'Archivado') then
    raise exception using errcode = '22023', message = 'Ese estado se gestiona desde Agenda o Archivado';
  end if;
  if p_status is not null and normalized_status not in (
    'Nuevo', 'No Contactado', 'Contactado', 'Respondió',
    'Presupuesto Enviado', 'Tratamiento Iniciado', 'No Respondió',
    'Perdido', 'Reactivar 30d'
  ) then
    raise exception using errcode = '22023', message = 'Estado comercial inválido';
  end if;

  if p_status is not null and normalized_status = 'Contactado'
     and lead_record.status is distinct from 'Contactado' then
    select * into lead_record
    from public.mark_lead_contacted(
      p_lead_id,
      'crm_status',
      null,
      p_next_action,
      p_next_followup_at
    );
    return lead_record;
  end if;

  normalized_due_at := coalesce(p_next_followup_at, lead_record.next_followup_at, now());
  if normalized_due_at < now() - interval '5 minutes' then
    raise exception using errcode = '22023', message = 'El seguimiento no puede posponerse a una fecha pasada';
  end if;

  normalized_action := coalesce(
    nullif(btrim(p_next_action), ''),
    case normalized_status
      when 'Respondió' then 'Definir próximo paso'
      when 'Presupuesto Enviado' then 'Dar seguimiento al presupuesto'
      when 'No Respondió' then 'Intentar contacto nuevamente'
      when 'Reactivar 30d' then 'Reactivar lead'
      else lead_record.next_action
    end,
    'Contactar lead'
  );
  status_changed := normalized_status is distinct from lead_record.status;

  update public.leads
  set status = normalized_status,
      next_action = normalized_action,
      next_followup_at = normalized_due_at,
      last_contact_at = case
        when normalized_status in ('Respondió', 'No Respondió') then now()
        else last_contact_at
      end,
      contact_attempts = case
        when status_changed and normalized_status in ('Respondió', 'No Respondió') then contact_attempts + 1
        else contact_attempts
      end
  where id = lead_record.id
  returning * into lead_record;

  if p_status is null then
    select t.* into existing_task
    from public.tasks t
    where t.clinic_id = lead_record.clinic_id
      and t.lead_id = lead_record.id
      and t.status in ('pendiente', 'vencido', 'Pendiente', 'Vencida')
    order by
      case
        when lead_record.status = 'No Asistió' and t.type = 'no_show_recovery' then 0
        when t.type = 'followup' then 1
        when t.type = 'contact' then 2
        else 3
      end,
      t.created_at desc
    limit 1
    for update;

    if found then
      update public.tasks
      set due_at = normalized_due_at,
          status = 'pendiente',
          completed_at = null,
          completed_by = null,
          updated_at = now()
      where id = existing_task.id;
    else
      task_title := normalized_action;
      task_type := 'followup';
      task_priority := case lead_record.classification
        when 'Lead Caliente' then 'alta'
        when 'Lead Frío' then 'baja'
        else 'media'
      end;
    end if;
  else
    task_title := normalized_action;
    task_type := case when normalized_status in ('Nuevo', 'No Contactado', 'No Respondió') then 'contact' else 'followup' end;
    task_priority := case lead_record.classification
      when 'Lead Caliente' then 'alta'
      when 'Lead Frío' then 'baja'
      else 'media'
    end;
  end if;

  if task_type is not null then
    insert into public.tasks (
      clinic_id, lead_id, title, description, type, priority,
      status, due_at, assigned_to, created_by
    ) values (
      lead_record.clinic_id, lead_record.id, task_title,
      'Seguimiento generado desde el flujo comercial del CRM.',
      task_type, task_priority, 'pendiente', normalized_due_at,
      lead_record.assigned_to, current_user_id
    )
    on conflict (clinic_id, lead_id, type)
      where lead_id is not null and type is not null
        and status in ('pendiente', 'vencido', 'Pendiente', 'Vencida')
    do update set
      title = excluded.title,
      description = excluded.description,
      priority = excluded.priority,
      status = 'pendiente',
      due_at = excluded.due_at,
      assigned_to = coalesce(excluded.assigned_to, tasks.assigned_to),
      completed_at = null,
      completed_by = null,
      updated_at = now();
  end if;

  insert into public.lead_events (
    clinic_id, lead_id, event_type, title, description, metadata, created_by
  ) values (
    lead_record.clinic_id,
    lead_record.id,
    case when status_changed then 'status_changed' else 'followup_postponed' end,
    case when status_changed then 'Estado comercial actualizado' else 'Seguimiento pospuesto' end,
    case when status_changed
      then format('Estado cambiado a %s. Próxima acción: %s', normalized_status, normalized_action)
      else format('Próximo seguimiento: %s', normalized_due_at at time zone 'America/Asuncion')
    end,
    jsonb_build_object('status', normalized_status, 'next_followup_at', normalized_due_at),
    current_user_id
  );

  insert into public.audit_logs (clinic_id, actor_id, action, table_name, row_id, metadata)
  values (
    lead_record.clinic_id,
    current_user_id,
    case when status_changed then 'lead_status_changed' else 'followup_postponed' end,
    'leads',
    lead_record.id,
    jsonb_build_object('status', normalized_status, 'next_followup_at', normalized_due_at)
  );

  return lead_record;
end;
$function$;
