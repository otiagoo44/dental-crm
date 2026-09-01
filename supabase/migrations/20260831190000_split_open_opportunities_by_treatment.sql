-- Keep one open opportunity per clinic/phone/treatment, preserving independent workflows.
drop index if exists public.leads_clinic_open_phone_plus_unique_idx;
create unique index if not exists leads_clinic_open_phone_treatment_unique_idx
  on public.leads (clinic_id, phone_plus, app_private.normalize_domain_text(coalesce(treatment, '')))
  where phone_plus is not null
    and coalesce(is_archived, false) is false
    and coalesce(status, 'Nuevo') not in ('Perdido', 'Tratamiento Iniciado', 'Archivado');

create or replace function public.create_public_lead_intake(
  p_form_id uuid, p_clinic_slug text, p_public_token text, p_name text,
  p_phone text, p_phone_plus text, p_treatment text, p_urgency text,
  p_score integer, p_classification text, p_situation text,
  p_evaluation_previous text, p_consultation_reason text,
  p_estimated_value numeric, p_next_action text, p_next_followup_at timestamptz,
  p_whatsapp_link text, p_source text, p_page text, p_notes text,
  p_consent_at timestamptz, p_ip_hash text, p_phone_hash text
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  form_record public.clinic_public_forms;
  lead_record public.leads;
  previous_terminal public.leads;
  assigned_user_id uuid;
  normalized_name text := nullif(btrim(p_name), '');
  normalized_phone text := nullif(btrim(p_phone), '');
  normalized_phone_plus text := nullif(btrim(p_phone_plus), '');
  normalized_treatment text := nullif(btrim(p_treatment), '');
  normalized_classification text := coalesce(nullif(btrim(p_classification), ''), 'Lead Medio');
  normalized_action text := coalesce(nullif(btrim(p_next_action), ''), 'Responder nueva consulta');
  normalized_due_at timestamptz := coalesce(p_next_followup_at, now());
  event_type_value text;
  event_title text;
  task_priority text;
  created_new boolean := false;
  created_after_terminal boolean := false;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), (select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  select f.* into form_record from public.clinic_public_forms f
   where f.id = p_form_id and f.clinic_slug = nullif(btrim(p_clinic_slug), '')
     and f.public_token = nullif(btrim(p_public_token), '') and f.is_active is true;
  if not found then raise exception using errcode = '42501', message = 'Formulario público no autorizado'; end if;
  if normalized_name is null or length(normalized_name) > 160 then raise exception using errcode = '22023', message = 'Nombre inválido'; end if;
  if normalized_phone_plus is null or length(normalized_phone_plus) > 64 then raise exception using errcode = '22023', message = 'Teléfono inválido'; end if;
  if normalized_classification not in ('Lead Caliente', 'Lead Medio', 'Lead Frío') then raise exception using errcode = '22023', message = 'Clasificación inválida'; end if;
  if coalesce(p_score, 0) < 0 or coalesce(p_score, 0) > 1000 then raise exception using errcode = '22023', message = 'Score inválido'; end if;
  if p_estimated_value is not null and p_estimated_value < 0 then raise exception using errcode = '22023', message = 'Estimación inválida'; end if;
  if p_consent_at is null then raise exception using errcode = '23514', message = 'El consentimiento es obligatorio'; end if;

  perform pg_advisory_xact_lock(hashtextextended(form_record.clinic_id::text || ':' || normalized_phone_plus, 0));
  assigned_user_id := app_private.default_clinic_assignee(form_record.clinic_id);
  task_priority := case normalized_classification when 'Lead Caliente' then 'alta' when 'Lead Frío' then 'baja' else 'media' end;

  select l.* into lead_record from public.leads l
   where l.clinic_id = form_record.clinic_id and l.phone_plus = normalized_phone_plus
     and app_private.is_open_opportunity(l.status, l.is_archived)
     and app_private.normalize_domain_text(coalesce(l.treatment, '')) = app_private.normalize_domain_text(coalesce(normalized_treatment, ''))
   order by l.created_at desc limit 1 for update;

  if found then
    event_type_value := 'lead_duplicate_submission'; event_title := 'Nueva consulta sobre oportunidad abierta';
    update public.leads l set
      name = normalized_name, phone = coalesce(normalized_phone, l.phone),
      urgency = coalesce(nullif(btrim(p_urgency), ''), l.urgency),
      score = greatest(coalesce(l.score, 0), coalesce(p_score, 0)),
      classification = case when l.classification = 'Lead Caliente' or normalized_classification = 'Lead Caliente' then 'Lead Caliente' when l.classification = 'Lead Medio' or normalized_classification = 'Lead Medio' then 'Lead Medio' else 'Lead Frío' end,
      situation = coalesce(nullif(btrim(p_situation), ''), l.situation),
      evaluation_previous = coalesce(nullif(btrim(p_evaluation_previous), ''), l.evaluation_previous),
      consultation_reason = coalesce(nullif(btrim(p_consultation_reason), ''), l.consultation_reason),
      estimated_value = coalesce(l.estimated_value, p_estimated_value), next_action = 'Responder nueva consulta',
      next_followup_at = least(coalesce(l.next_followup_at, normalized_due_at), normalized_due_at),
      whatsapp_link = coalesce(nullif(btrim(p_whatsapp_link), ''), l.whatsapp_link), source = coalesce(nullif(btrim(p_source), ''), l.source),
      page = coalesce(nullif(btrim(p_page), ''), l.page), notes = coalesce(l.notes, nullif(btrim(p_notes), '')),
      assigned_to = app_private.resolve_clinic_assignee(l.clinic_id, l.assigned_to), consent_contact = true,
      consent_at = p_consent_at, consent_source = nullif(btrim(p_source), ''), consent_page = nullif(btrim(p_page), ''), updated_at = now()
    where l.id = lead_record.id returning l.* into lead_record;
  else
    select l.* into previous_terminal from public.leads l where l.clinic_id = form_record.clinic_id
      and l.phone_plus = normalized_phone_plus and not app_private.is_open_opportunity(l.status, l.is_archived)
      order by l.created_at desc limit 1;
    created_after_terminal := found; created_new := true;
    event_type_value := case when created_after_terminal then 'new_opportunity_after_terminal' else 'lead_created_from_landing' end;
    event_title := case when created_after_terminal then 'Nueva oportunidad con historial anterior' else 'Consulta creada desde landing' end;
    insert into public.leads (clinic_id, name, phone, phone_plus, treatment, urgency, score, classification, status, situation, evaluation_previous, consultation_reason, estimated_value, next_action, next_followup_at, contact_attempts, whatsapp_link, source, page, notes, assigned_to, consent_contact, consent_at, consent_source, consent_page)
    values (form_record.clinic_id, normalized_name, normalized_phone, normalized_phone_plus, normalized_treatment, nullif(btrim(p_urgency), ''), coalesce(p_score, 0), normalized_classification, 'Nuevo', nullif(btrim(p_situation), ''), nullif(btrim(p_evaluation_previous), ''), nullif(btrim(p_consultation_reason), ''), p_estimated_value, normalized_action, normalized_due_at, 0, nullif(btrim(p_whatsapp_link), ''), nullif(btrim(p_source), ''), nullif(btrim(p_page), ''), nullif(btrim(p_notes), ''), assigned_user_id, true, p_consent_at, nullif(btrim(p_source), ''), nullif(btrim(p_page), '')) returning * into lead_record;
  end if;

  insert into public.tasks (clinic_id, lead_id, title, description, type, priority, status, due_at, assigned_to, created_by)
  values (lead_record.clinic_id, lead_record.id, case when created_new then normalized_action else 'Responder nueva consulta' end, 'Acción creada por una consulta pública validada.', 'contact', task_priority, 'pendiente', least(coalesce(lead_record.next_followup_at, normalized_due_at), normalized_due_at), lead_record.assigned_to, null)
  on conflict (clinic_id, lead_id, type) where lead_id is not null and type is not null and status in ('pendiente', 'vencido', 'Pendiente', 'Vencida') do update set title = excluded.title, description = excluded.description, priority = excluded.priority, status = 'pendiente', due_at = least(coalesce(tasks.due_at, excluded.due_at), excluded.due_at), assigned_to = app_private.resolve_clinic_assignee(excluded.clinic_id, tasks.assigned_to), completed_at = null, completed_by = null, updated_at = now();

  insert into public.lead_events (clinic_id, lead_id, event_type, title, description, metadata, created_by)
  values (lead_record.clinic_id, lead_record.id, event_type_value, event_title,
    case when created_after_terminal then 'Se creó una oportunidad nueva sin reabrir ni sobrescribir la oportunidad terminal anterior.' when created_new then 'Consulta creada desde formulario público.' else 'El paciente volvió a enviar el formulario; se priorizó la oportunidad abierta existente.' end,
    jsonb_build_object('form_id', form_record.id, 'classification', normalized_classification, 'score', coalesce(p_score, 0), 'previous_terminal_lead_id', previous_terminal.id, 'created_new_opportunity', created_new, 'assigned_to', lead_record.assigned_to), null);
  insert into public.audit_logs (clinic_id, actor_id, action, table_name, row_id, metadata)
  values (lead_record.clinic_id, null, event_type_value, 'leads', lead_record.id, jsonb_build_object('form_id', form_record.id, 'previous_terminal_lead_id', previous_terminal.id, 'created_new_opportunity', created_new, 'assigned_to', lead_record.assigned_to));
  insert into public.automation_jobs (clinic_id, lead_id, workflow_name, status, payload)
  values (lead_record.clinic_id, lead_record.id, 'lead_created', 'pending', jsonb_build_object('lead_id', lead_record.id, 'classification', normalized_classification, 'score', coalesce(p_score, 0)));
  if normalized_classification = 'Lead Caliente' then
    insert into public.automation_jobs (clinic_id, lead_id, workflow_name, status, payload) values (lead_record.clinic_id, lead_record.id, 'lead_hot_alert', 'pending', jsonb_build_object('lead_id', lead_record.id, 'classification', normalized_classification, 'score', coalesce(p_score, 0)));
  end if;
  if lead_record.assigned_to is null then
    insert into public.automation_jobs (clinic_id, lead_id, workflow_name, status, payload) values (lead_record.clinic_id, lead_record.id, 'lead_assignment_required', 'pending', jsonb_build_object('lead_id', lead_record.id, 'severity', 'p0'));
  end if;
  insert into public.form_submission_logs (clinic_public_form_id, clinic_id, ip_hash, phone_hash, status) values (form_record.id, form_record.clinic_id, nullif(btrim(p_ip_hash), ''), nullif(btrim(p_phone_hash), ''), 'accepted');
  return jsonb_build_object('lead_id', lead_record.id, 'classification', lead_record.classification, 'score', lead_record.score, 'assigned_to', lead_record.assigned_to, 'created', created_new, 'duplicate_open', not created_new, 'new_after_terminal', created_after_terminal);
end;
$function$;
