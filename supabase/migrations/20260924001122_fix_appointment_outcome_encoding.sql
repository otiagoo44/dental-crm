-- Forward-only repair: canonical UTF-8 outcomes and appointment cancellation.
-- Existing SECURITY DEFINER command retained: atomic task/event writes require it;
-- auth, role, tenant, row locks, fixed path and grants remain enforced.
-- Appointment cancellation is operational, not a commercial opportunity status.
create or replace function public.update_appointment_outcome(
  p_appointment_id uuid,
  p_outcome text,
  p_appointment_date date default null,
  p_appointment_time time default null,
  p_doctor_assigned text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  appointment_record public.appointments;
  lead_record public.leads;
  normalized_outcome text := nullif(btrim(p_outcome), '');
  appointment_at timestamptz;
  assigned_user_id uuid;
  next_action_value text;
  next_followup_value timestamptz;
  task_title text;
  task_description text;
  task_type text;
  task_priority text := 'media';
  event_type_value text;
  cancelled_task_ids uuid[] := array[]::uuid[];
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if normalized_outcome is null or normalized_outcome not in ('Confirmado', 'Asistió', 'No Asistió', 'Cancelado') then
    raise exception using errcode = '22023', message = 'Resultado de cita inválido';
  end if;

  select a.* into appointment_record
  from public.appointments a
  where a.id = p_appointment_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Cita no encontrada';
  end if;
  if not app_private.has_role(appointment_record.clinic_id, array['admin', 'owner', 'receptionist']) then
    raise exception using errcode = '42501', message = 'No tenés acceso a esta cita';
  end if;
  if appointment_record.status = normalized_outcome then
    return appointment_record;
  end if;

  select l.* into lead_record
  from public.leads l
  where l.id = appointment_record.lead_id
    and l.clinic_id = appointment_record.clinic_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Paciente de la cita no encontrado';
  end if;

  appointment_at := app_private.asuncion_timestamp(appointment_record.appointment_date, appointment_record.appointment_time);
  assigned_user_id := app_private.resolve_clinic_assignee(lead_record.clinic_id, lead_record.assigned_to);

  if normalized_outcome = 'Confirmado' then
    if appointment_record.status not in ('Agendado', 'Consulta Agendada', 'Pendiente', 'Reprogramado') then
      raise exception using errcode = '22023', message = 'La cita ya no puede confirmarse desde su estado actual';
    end if;
    if appointment_at <= now() then
      raise exception using errcode = '22023', message = 'No se puede confirmar una cita cuya hora ya pasó';
    end if;
  elsif normalized_outcome in ('Asistió', 'No Asistió') then
    if appointment_record.status not in ('Agendado', 'Consulta Agendada', 'Pendiente', 'Reprogramado', 'Confirmado') then
      raise exception using errcode = '22023', message = 'No se puede registrar asistencia desde el estado actual';
    end if;
    if appointment_at > now() then
      raise exception using errcode = '22023', message = 'No se puede registrar asistencia antes de la hora de la cita';
    end if;
  elsif normalized_outcome = 'Cancelado'
    and appointment_record.status not in ('Agendado', 'Consulta Agendada', 'Pendiente', 'Reprogramado', 'Confirmado') then
    raise exception using errcode = '22023', message = 'La cita ya no puede cancelarse desde su estado actual';
  end if;

  cancelled_task_ids := app_private.cancel_open_lead_tasks(
    lead_record.clinic_id,
    lead_record.id,
    current_user_id,
    array['confirm', 'attendance', 'no_show_recovery', 'cancelled_recovery']
  );

  case normalized_outcome
    when 'Confirmado' then
      next_action_value := 'Registrar asistencia';
      next_followup_value := appointment_at;
      task_title := 'Registrar asistencia';
      task_description := 'Al finalizar la cita, registrar si el paciente asistió.';
      task_type := 'attendance';
      event_type_value := 'appointment_confirmed';
    when 'Asistió' then
      next_action_value := 'Registrar presupuesto';
      next_followup_value := now();
      task_title := 'Registrar presupuesto';
      task_description := 'Registrar el presupuesto real o definir el siguiente paso comercial.';
      task_type := 'quote_registration';
      event_type_value := 'appointment_attended';
    when 'No Asistió' then
      next_action_value := 'Recuperar paciente que no asistió';
      next_followup_value := now();
      task_title := 'Recuperar paciente que no asistió';
      task_description := 'Contactar para conocer qué ocurrió y ofrecer una nueva fecha.';
      task_type := 'no_show_recovery';
      task_priority := 'alta';
      event_type_value := 'appointment_no_show';
    when 'Cancelado' then
      next_action_value := 'Volver a ofrecer una cita';
      next_followup_value := app_private.tomorrow_at_asuncion(9);
      task_title := 'Recuperar cita cancelada';
      task_description := 'Contactar para ofrecer una nueva fecha.';
      task_type := 'cancelled_recovery';
      task_priority := 'alta';
      event_type_value := 'appointment_cancelled';
  end case;

  update public.appointments
  set status = normalized_outcome,
      confirmed_at = case when normalized_outcome = 'Confirmado' then now() else confirmed_at end,
      attended_at = case when normalized_outcome = 'Asistió' then now() else attended_at end,
      no_show_at = case when normalized_outcome = 'No Asistió' then now() else no_show_at end,
      cancelled_at = case when normalized_outcome = 'Cancelado' then now() else cancelled_at end,
      updated_at = now()
  where id = appointment_record.id
  returning * into appointment_record;

  update public.leads
  set status = case when normalized_outcome = 'Cancelado' then lead_record.status else normalized_outcome end,
      assigned_to = assigned_user_id,
      next_action = next_action_value,
      next_followup_at = next_followup_value,
      updated_at = now()
  where id = lead_record.id;

  insert into public.tasks (
    clinic_id, lead_id, title, description, type, priority,
    status, due_at, assigned_to, created_by
  ) values (
    lead_record.clinic_id, lead_record.id, task_title, task_description,
    task_type, task_priority, 'pendiente', next_followup_value,
    assigned_user_id, current_user_id
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
    assigned_to = excluded.assigned_to,
    completed_at = null,
    updated_at = now();

  insert into public.lead_events (clinic_id, lead_id, event_type, title, description, metadata, created_by)
  values (
    lead_record.clinic_id, lead_record.id, event_type_value,
    'Cita: ' || normalized_outcome,
    format('Resultado de la cita %s: %s', appointment_record.id, normalized_outcome),
    jsonb_build_object('appointment_id', appointment_record.id, 'cancelled_task_ids', to_jsonb(cancelled_task_ids)),
    current_user_id
  );

  insert into public.audit_logs (clinic_id, actor_id, action, table_name, row_id, metadata)
  values (
    lead_record.clinic_id, current_user_id, event_type_value, 'appointments', appointment_record.id,
    jsonb_build_object('lead_id', lead_record.id, 'outcome', normalized_outcome)
  );

  return appointment_record;
end;
$function$;

revoke all on function public.update_appointment_outcome(uuid, text, date, time, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_appointment_outcome(uuid, text, date, time, text)
  to authenticated;
