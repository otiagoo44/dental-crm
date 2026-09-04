-- Add a clinic-scoped patient identity while preserving every opportunity row
-- and all lead-linked history. Leads remain the opportunity aggregate.

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  phone text,
  phone_plus text,
  phone_key text not null check (length(btrim(phone_key)) between 1 and 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, id),
  unique (clinic_id, phone_key)
);

create index contacts_clinic_name_idx
  on public.contacts (clinic_id, lower(name));

alter table public.contacts enable row level security;

create policy contacts_select_same_clinic
  on public.contacts
  for select
  to authenticated
  using (app_private.is_clinic_member(clinic_id));

revoke all on table public.contacts from public, anon;
grant select on table public.contacts to authenticated;

drop trigger if exists set_contacts_updated_at on public.contacts;
create trigger set_contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

create or replace function app_private.contact_phone_key(p_phone text, p_phone_plus text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select coalesce(
    nullif(regexp_replace(coalesce(nullif(btrim(p_phone_plus), ''), nullif(btrim(p_phone), '')), '[^0-9]', '', 'g'), ''),
    lower(btrim(coalesce(nullif(p_phone_plus, ''), p_phone)))
  )
$function$;

revoke all on function app_private.contact_phone_key(text, text)
from public, anon, authenticated, service_role;

alter table public.leads add column contact_id uuid;

insert into public.contacts (clinic_id, name, phone, phone_plus, phone_key, created_at, updated_at)
select distinct on (l.clinic_id, app_private.contact_phone_key(l.phone, l.phone_plus))
  l.clinic_id,
  l.name,
  l.phone,
  l.phone_plus,
  app_private.contact_phone_key(l.phone, l.phone_plus),
  l.created_at,
  greatest(l.created_at, coalesce(l.updated_at, l.created_at))
from public.leads l
order by
  l.clinic_id,
  app_private.contact_phone_key(l.phone, l.phone_plus),
  coalesce(l.updated_at, l.created_at) desc,
  l.created_at desc,
  l.id desc;

-- Preserve operational timestamps and scoring while attaching historical rows.
alter table public.leads disable trigger user;

update public.leads l
set contact_id = c.id
from public.contacts c
where c.clinic_id = l.clinic_id
  and c.phone_key = app_private.contact_phone_key(l.phone, l.phone_plus);

alter table public.leads enable trigger user;

alter table public.leads alter column contact_id set not null;

alter table public.leads
  add constraint leads_clinic_contact_fk
  foreign key (clinic_id, contact_id)
  references public.contacts (clinic_id, id)
  on delete restrict;

create index leads_clinic_contact_created_idx
  on public.leads (clinic_id, contact_id, created_at desc);

drop index if exists public.leads_clinic_open_phone_plus_unique_idx;
create unique index leads_clinic_open_contact_treatment_unique_idx
  on public.leads (
    clinic_id,
    contact_id,
    app_private.normalize_domain_text(coalesce(treatment, ''))
  )
  where coalesce(is_archived, false) is false
    and coalesce(status, 'Nuevo') not in ('Perdido', 'Tratamiento Iniciado', 'Archivado');

create or replace function app_private.sync_lead_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  resolved_contact public.contacts;
  resolved_phone_key text := app_private.contact_phone_key(new.phone, new.phone_plus);
begin
  if resolved_phone_key is null then
    raise exception using errcode = '23502', message = 'El teléfono del contacto es obligatorio';
  end if;

  if new.contact_id is not null then
    select c.* into resolved_contact
    from public.contacts c
    where c.id = new.contact_id
      and c.clinic_id = new.clinic_id;

    if not found then
      raise exception using errcode = '23503', message = 'El contacto debe pertenecer a la misma clínica';
    end if;

    if resolved_contact.phone_key <> resolved_phone_key then
      new.contact_id := null;
    end if;
  end if;

  if new.contact_id is null then
    insert into public.contacts (clinic_id, name, phone, phone_plus, phone_key)
    values (new.clinic_id, btrim(new.name), new.phone, new.phone_plus, resolved_phone_key)
    on conflict (clinic_id, phone_key) do update
      set name = excluded.name,
          phone = coalesce(excluded.phone, contacts.phone),
          phone_plus = coalesce(excluded.phone_plus, contacts.phone_plus),
          updated_at = now()
    returning * into resolved_contact;

    new.contact_id := resolved_contact.id;
  else
    update public.contacts c
    set name = btrim(new.name),
        phone = coalesce(new.phone, c.phone),
        phone_plus = coalesce(new.phone_plus, c.phone_plus),
        updated_at = now()
    where c.id = new.contact_id
      and c.clinic_id = new.clinic_id;
  end if;

  return new;
end;
$function$;

revoke all on function app_private.sync_lead_contact()
from public, anon, authenticated, service_role;

drop trigger if exists sync_lead_contact on public.leads;
create trigger sync_lead_contact
before insert or update of clinic_id, contact_id, name, phone, phone_plus
on public.leads
for each row execute function app_private.sync_lead_contact();

-- Manual intake now has the same reuse semantics as public intake.
create or replace function public.create_manual_lead(
  p_name text,
  p_phone text,
  p_phone_plus text,
  p_treatment text,
  p_urgency text,
  p_consultation_reason text,
  p_source text,
  p_consent_contact boolean,
  p_notes text,
  p_next_action text,
  p_next_followup_at timestamptz,
  p_assigned_to uuid,
  p_classification text,
  p_score integer,
  p_situation text,
  p_evaluation_previous text,
  p_estimated_value numeric
)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  current_profile public.profiles;
  assigned_user_id uuid;
  normalized_name text := nullif(btrim(p_name), '');
  normalized_phone text := nullif(btrim(p_phone), '');
  normalized_phone_plus text := nullif(btrim(p_phone_plus), '');
  normalized_treatment text := nullif(btrim(p_treatment), '');
  normalized_source text := nullif(btrim(p_source), '');
  normalized_classification text := coalesce(nullif(btrim(p_classification), ''), 'Lead Medio');
  normalized_score integer := coalesce(p_score, 0);
  normalized_next_action text;
  normalized_next_followup_at timestamptz;
  normalized_phone_key text;
  contact_id_value uuid;
  task_priority text;
  whatsapp_digits text;
  result_lead public.leads;
  created_new boolean := false;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select p.* into current_profile
  from public.profiles p
  where p.id = current_user_id
    and p.active is true
    and p.role in ('admin', 'owner', 'receptionist')
  limit 1;

  if not found then
    raise exception using errcode = '42501', message = 'Tu usuario no tiene un profile activo autorizado';
  end if;

  if normalized_name is null or length(normalized_name) > 160 then
    raise exception using errcode = '22023', message = 'Nombre inválido';
  end if;
  if normalized_phone is null and normalized_phone_plus is null then
    raise exception using errcode = '22023', message = 'El teléfono del lead es obligatorio';
  end if;
  if length(coalesce(normalized_phone, '')) > 64 or length(coalesce(normalized_phone_plus, '')) > 64 then
    raise exception using errcode = '22023', message = 'El teléfono supera el máximo permitido';
  end if;
  if normalized_source not in (
    'WhatsApp directo', 'Instagram DM', 'Llamada', 'Recomendación',
    'Formulario externo', 'Meta Ads manual', 'Formulario web', 'Presencial', 'Otro'
  ) then
    raise exception using errcode = '22023', message = 'Fuente de lead manual inválida';
  end if;
  if normalized_classification not in ('Lead Caliente', 'Lead Medio', 'Lead Frío') then
    raise exception using errcode = '22023', message = 'Clasificación inválida';
  end if;
  if normalized_score < 0 or normalized_score > 1000 then
    raise exception using errcode = '22023', message = 'El score debe estar entre 0 y 1000';
  end if;
  if p_estimated_value is not null and p_estimated_value < 0 then
    raise exception using errcode = '22023', message = 'El valor estimado no puede ser negativo';
  end if;

  assigned_user_id := coalesce(p_assigned_to, current_user_id);
  if not exists (
    select 1 from public.profiles p
    where p.id = assigned_user_id
      and p.clinic_id = current_profile.clinic_id
      and p.active is true
  ) then
    raise exception using errcode = '42501', message = 'El responsable debe pertenecer a tu clínica';
  end if;

  normalized_next_action := coalesce(
    nullif(btrim(p_next_action), ''),
    case normalized_classification
      when 'Lead Caliente' then 'Contactar inmediatamente'
      when 'Lead Medio' then 'Contactar hoy'
      else 'Hacer seguimiento'
    end
  );
  normalized_next_followup_at := coalesce(
    p_next_followup_at,
    case normalized_classification
      when 'Lead Caliente' then now()
      when 'Lead Medio' then app_private.tomorrow_at_asuncion(9)
      else app_private.tomorrow_at_asuncion(9) + interval '2 days'
    end
  );
  task_priority := case normalized_classification
    when 'Lead Caliente' then 'alta'
    when 'Lead Frío' then 'baja'
    else 'media'
  end;
  whatsapp_digits := regexp_replace(coalesce(normalized_phone_plus, normalized_phone, ''), '[^0-9]', '', 'g');
  normalized_phone_key := app_private.contact_phone_key(normalized_phone, normalized_phone_plus);

  perform pg_advisory_xact_lock(hashtextextended(current_profile.clinic_id::text || ':' || normalized_phone_key, 0));

  select c.id into contact_id_value
  from public.contacts c
  where c.clinic_id = current_profile.clinic_id
    and c.phone_key = normalized_phone_key;

  if contact_id_value is not null then
    select l.* into result_lead
    from public.leads l
    where l.clinic_id = current_profile.clinic_id
      and l.contact_id = contact_id_value
      and app_private.is_open_opportunity(l.status, l.is_archived)
      and app_private.normalize_domain_text(coalesce(l.treatment, '')) = app_private.normalize_domain_text(coalesce(normalized_treatment, ''))
    order by l.created_at desc
    limit 1
    for update;
  end if;

  if found then
    update public.leads l
    set name = normalized_name,
        phone = coalesce(normalized_phone, l.phone),
        phone_plus = coalesce(normalized_phone_plus, l.phone_plus),
        urgency = coalesce(nullif(btrim(p_urgency), ''), l.urgency),
        consultation_reason = coalesce(nullif(btrim(p_consultation_reason), ''), l.consultation_reason),
        situation = coalesce(nullif(btrim(p_situation), ''), l.situation),
        evaluation_previous = coalesce(nullif(btrim(p_evaluation_previous), ''), l.evaluation_previous),
        score = greatest(coalesce(l.score, 0), normalized_score),
        classification = case
          when l.classification = 'Lead Caliente' or normalized_classification = 'Lead Caliente' then 'Lead Caliente'
          when l.classification = 'Lead Medio' or normalized_classification = 'Lead Medio' then 'Lead Medio'
          else 'Lead Frío'
        end,
        estimated_value = coalesce(l.estimated_value, p_estimated_value),
        next_action = normalized_next_action,
        next_followup_at = least(coalesce(l.next_followup_at, normalized_next_followup_at), normalized_next_followup_at),
        assigned_to = assigned_user_id,
        consent_contact = coalesce(p_consent_contact, l.consent_contact),
        consent_at = case when coalesce(p_consent_contact, false) then coalesce(l.consent_at, now()) else l.consent_at end,
        notes = coalesce(l.notes, nullif(btrim(p_notes), '')),
        updated_at = now()
    where l.id = result_lead.id
    returning l.* into result_lead;
  else
    created_new := true;
    insert into public.leads (
      clinic_id, name, phone, phone_plus, treatment, urgency,
      score, classification, status, situation, evaluation_previous,
      consultation_reason, estimated_value, next_action, next_followup_at,
      whatsapp_link, source, page, notes, assigned_to,
      consent_contact, consent_at, consent_source, consent_page
    ) values (
      current_profile.clinic_id, normalized_name, normalized_phone, normalized_phone_plus,
      normalized_treatment, nullif(btrim(p_urgency), ''), normalized_score,
      normalized_classification, 'Nuevo', nullif(btrim(p_situation), ''),
      nullif(btrim(p_evaluation_previous), ''),
      coalesce(nullif(btrim(p_consultation_reason), ''), nullif(btrim(p_situation), ''), normalized_treatment),
      p_estimated_value, normalized_next_action, normalized_next_followup_at,
      case when whatsapp_digits = '' then null else 'https://wa.me/' || whatsapp_digits end,
      normalized_source, 'crm_manual', nullif(btrim(p_notes), ''), assigned_user_id,
      coalesce(p_consent_contact, false),
      case when coalesce(p_consent_contact, false) then now() else null end,
      case when coalesce(p_consent_contact, false) then 'crm_manual' else null end,
      case when coalesce(p_consent_contact, false) then 'crm_manual' else null end
    ) returning * into result_lead;
  end if;

  insert into public.lead_events (
    clinic_id, lead_id, event_type, title, description, metadata, created_by
  ) values (
    current_profile.clinic_id,
    result_lead.id,
    case when created_new then 'lead_created_manual' else 'lead_duplicate_submission' end,
    case when created_new then 'Lead creado manualmente' else 'Nueva consulta sobre oportunidad abierta' end,
    case when created_new then 'Lead ingresado desde el CRM por un usuario autenticado.' else 'Se reutilizó la oportunidad abierta del mismo contacto y tratamiento.' end,
    jsonb_build_object('source', normalized_source, 'classification', normalized_classification, 'score', normalized_score, 'consent_contact', coalesce(p_consent_contact, false), 'created_new_opportunity', created_new),
    current_user_id
  );

  insert into public.tasks (
    clinic_id, lead_id, title, description, type, priority,
    status, due_at, assigned_to, created_by
  ) values (
    current_profile.clinic_id, result_lead.id, normalized_next_action,
    'Seguimiento inicial del lead cargado manualmente.', 'contact', task_priority,
    'pendiente', normalized_next_followup_at, assigned_user_id, current_user_id
  )
  on conflict (clinic_id, lead_id, type)
    where lead_id is not null and type is not null
      and status in ('pendiente', 'vencido', 'Pendiente', 'Vencida')
  do update set
    title = excluded.title,
    priority = excluded.priority,
    due_at = least(coalesce(tasks.due_at, excluded.due_at), excluded.due_at),
    assigned_to = excluded.assigned_to,
    status = 'pendiente',
    completed_at = null,
    completed_by = null,
    updated_at = now();

  insert into public.audit_logs (clinic_id, actor_id, action, table_name, row_id, metadata)
  values (
    current_profile.clinic_id,
    current_user_id,
    case when created_new then 'lead_created_manual' else 'lead_duplicate_submission' end,
    'leads',
    result_lead.id,
    jsonb_build_object('source', normalized_source, 'assigned_to', assigned_user_id, 'created_new_opportunity', created_new)
  );

  return result_lead;
end;
$function$;

-- Public intake keeps its established response contract and now resolves the
-- open opportunity through the contact identity instead of a duplicated row.
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
  contact_id_value uuid;
  normalized_name text := nullif(btrim(p_name), '');
  normalized_phone text := nullif(btrim(p_phone), '');
  normalized_phone_plus text := nullif(btrim(p_phone_plus), '');
  normalized_phone_key text;
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

  normalized_phone_key := app_private.contact_phone_key(normalized_phone, normalized_phone_plus);
  perform pg_advisory_xact_lock(hashtextextended(form_record.clinic_id::text || ':' || normalized_phone_key, 0));
  assigned_user_id := app_private.default_clinic_assignee(form_record.clinic_id);
  task_priority := case normalized_classification when 'Lead Caliente' then 'alta' when 'Lead Frío' then 'baja' else 'media' end;

  select c.id into contact_id_value
  from public.contacts c
  where c.clinic_id = form_record.clinic_id
    and c.phone_key = normalized_phone_key;

  if contact_id_value is not null then
    select l.* into lead_record from public.leads l
     where l.clinic_id = form_record.clinic_id and l.contact_id = contact_id_value
       and app_private.is_open_opportunity(l.status, l.is_archived)
       and app_private.normalize_domain_text(coalesce(l.treatment, '')) = app_private.normalize_domain_text(coalesce(normalized_treatment, ''))
     order by l.created_at desc limit 1 for update;
  end if;

  if found then
    event_type_value := 'lead_duplicate_submission'; event_title := 'Nueva consulta sobre oportunidad abierta';
    update public.leads l set
      name = normalized_name, phone = coalesce(normalized_phone, l.phone), phone_plus = normalized_phone_plus,
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
    if contact_id_value is not null then
      select l.* into previous_terminal from public.leads l where l.clinic_id = form_record.clinic_id
        and l.contact_id = contact_id_value and not app_private.is_open_opportunity(l.status, l.is_archived)
        order by l.created_at desc limit 1;
    end if;
    created_after_terminal := previous_terminal.id is not null; created_new := true;
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
    jsonb_build_object('form_id', form_record.id, 'classification', normalized_classification, 'score', coalesce(p_score, 0), 'previous_terminal_lead_id', previous_terminal.id, 'created_new_opportunity', created_new, 'assigned_to', lead_record.assigned_to, 'contact_id', lead_record.contact_id), null);
  insert into public.audit_logs (clinic_id, actor_id, action, table_name, row_id, metadata)
  values (lead_record.clinic_id, null, event_type_value, 'leads', lead_record.id, jsonb_build_object('form_id', form_record.id, 'previous_terminal_lead_id', previous_terminal.id, 'created_new_opportunity', created_new, 'assigned_to', lead_record.assigned_to, 'contact_id', lead_record.contact_id));
  insert into public.automation_jobs (clinic_id, lead_id, workflow_name, status, payload)
  values (lead_record.clinic_id, lead_record.id, 'lead_created', 'pending', jsonb_build_object('lead_id', lead_record.id, 'classification', normalized_classification, 'score', coalesce(p_score, 0)));
  if normalized_classification = 'Lead Caliente' then
    insert into public.automation_jobs (clinic_id, lead_id, workflow_name, status, payload) values (lead_record.clinic_id, lead_record.id, 'lead_hot_alert', 'pending', jsonb_build_object('lead_id', lead_record.id, 'classification', normalized_classification, 'score', coalesce(p_score, 0)));
  end if;
  if lead_record.assigned_to is null then
    insert into public.automation_jobs (clinic_id, lead_id, workflow_name, status, payload) values (lead_record.clinic_id, lead_record.id, 'lead_assignment_required', 'pending', jsonb_build_object('lead_id', lead_record.id, 'severity', 'p0'));
  end if;
  insert into public.form_submission_logs (clinic_public_form_id, clinic_id, ip_hash, phone_hash, status) values (form_record.id, form_record.clinic_id, nullif(btrim(p_ip_hash), ''), nullif(btrim(p_phone_hash), ''), 'accepted');
  return jsonb_build_object('lead_id', lead_record.id, 'contact_id', lead_record.contact_id, 'classification', lead_record.classification, 'score', lead_record.score, 'assigned_to', lead_record.assigned_to, 'created', created_new, 'duplicate_open', not created_new, 'new_after_terminal', created_after_terminal);
end;
$function$;

notify pgrst, 'reload schema';
