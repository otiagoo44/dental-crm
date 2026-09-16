-- Canonical operational queue. Sources remain authoritative; no work_items table.
create or replace function public.list_work_items_v1(
  p_clinic_id uuid,
  p_view text default 'my_work',
  p_limit integer default 25,
  p_assigned_to uuid default null,
  p_cursor_group integer default null,
  p_cursor_due_at timestamptz default null,
  p_cursor_priority integer default null,
  p_cursor_key text default null
)
returns table (
  work_key text, clinic_id uuid, contact_id uuid, opportunity_id uuid,
  work_type text, patient_name text, patient_phone text, treatment text,
  title text, reason text, due_at timestamptz, priority_group text,
  priority_rank integer, assigned_to uuid, assigned_name text,
  source_type text, source_id uuid, status text, available_actions jsonb,
  updated_at timestamptz, sort_group integer
)
language plpgsql security invoker set search_path = ''
as $function$
declare
  actor_id uuid;
  actor_clinic_id uuid;
  actor_role text;
  normalized_view text := replace(lower(coalesce(nullif(btrim(p_view), ''), 'my_work')), '-', '_');
begin
  if p_limit < 1 or p_limit > 100 then raise exception using errcode='22023', message='Invalid work page size'; end if;
  if normalized_view not in ('my_work','overdue','today','upcoming','initial_contact','followups','confirmations','no_show','quotes','reactivations','unassigned','team') then
    raise exception using errcode='22023', message='Invalid work view';
  end if;
  select p.id,p.clinic_id,p.role into actor_id,actor_clinic_id,actor_role from public.profiles p where p.id=auth.uid() and p.active is true;
  if actor_id is null or actor_clinic_id <> p_clinic_id then raise exception using errcode='42501', message='Clinic access denied'; end if;
  if normalized_view='team' and actor_role not in ('owner','admin') then raise exception using errcode='42501', message='Team view requires owner or admin'; end if;
  if p_assigned_to is not null and not exists(select 1 from public.profiles p where p.id=p_assigned_to and p.clinic_id=p_clinic_id and p.active is true) then
    raise exception using errcode='22023', message='Invalid assignee';
  end if;
  if (p_cursor_group is null) <> (p_cursor_key is null) then raise exception using errcode='22023', message='Invalid work cursor'; end if;

  return query
  with candidates as (
    select 'task:'||t.id as work_key, t.clinic_id, l.contact_id, l.id opportunity_id,
      case when l.status in ('Nuevo','No Contactado') and coalesce(t.type,'contact')='contact' then 'initial_contact'
           when l.status='No Asistió' then 'no_show_recovery'
           when l.status='Reactivar 30d' then 'reactivation'
           when coalesce(t.type,'') in ('contact','followup') then 'followup' else 'manual_task' end work_type,
      l.name patient_name, coalesce(l.phone_plus,l.phone) patient_phone, l.treatment,
      coalesce(t.title,l.next_action,'Atender paciente') title,
      coalesce(t.description,l.next_action,'Acción operativa pendiente') reason, coalesce(t.due_at,l.next_followup_at) due_at,
      case when lower(coalesce(t.priority,'media')) in ('urgente','alta') then 'urgent' else 'normal' end priority_group,
      case lower(coalesce(t.priority,'media')) when 'urgente' then 0 when 'alta' then 1 when 'media' then 2 else 3 end priority_rank,
      coalesce(t.assigned_to,l.assigned_to) assigned_to, pr.full_name assigned_name,
      'task' source_type, t.id source_id, t.status,
      case when l.status in ('Nuevo','No Contactado') then '["contact"]'::jsonb else '["record_outcome"]'::jsonb end available_actions,
      greatest(coalesce(t.updated_at,t.created_at),coalesce(l.updated_at,l.created_at)) updated_at
    from public.tasks t join public.leads l on l.id=t.lead_id and l.clinic_id=t.clinic_id
    left join public.profiles pr on pr.id=coalesce(t.assigned_to,l.assigned_to) and pr.clinic_id=t.clinic_id
    where t.clinic_id=p_clinic_id and lower(t.status) not in ('hecho','completada','cancelado') and coalesce(l.is_archived,false)=false
    union all
    select 'appointment:'||a.id,a.clinic_id,l.contact_id,l.id,
      case when a.status='No Asistió' then 'no_show_recovery' when a.status='Confirmado' and a.appointment_date<=current_date then 'attendance' else 'confirm_appointment' end,
      l.name,coalesce(l.phone_plus,l.phone),coalesce(a.treatment_scheduled,l.treatment),
      case when a.status='No Asistió' then 'Recuperar inasistencia' when a.status='Confirmado' then 'Registrar asistencia' else 'Confirmar cita' end,
      case when a.status='No Asistió' then 'El paciente no asistió; definir recuperación.' else 'Cita '||a.status end,
      (a.appointment_date+a.appointment_time) at time zone 'America/Asuncion','normal',1,l.assigned_to,pr.full_name,
      'appointment',a.id,a.status,
      case when a.status='No Asistió' then '["record_outcome"]'::jsonb when a.status='Confirmado' then '["attended","no_show"]'::jsonb else '["confirm","reschedule","cancel"]'::jsonb end,
      coalesce(a.updated_at,a.created_at)
    from public.appointments a join public.leads l on l.id=a.lead_id and l.clinic_id=a.clinic_id
    left join public.profiles pr on pr.id=l.assigned_to and pr.clinic_id=a.clinic_id
    where a.clinic_id=p_clinic_id and a.status in ('Agendado','Confirmado','No Asistió') and coalesce(l.is_archived,false)=false
    union all
    select 'quote:'||q.id,q.clinic_id,l.contact_id,l.id,'quote_followup',l.name,coalesce(l.phone_plus,l.phone),coalesce(q.treatment,l.treatment),
      'Seguimiento de presupuesto','Presupuesto pendiente de decisión',coalesce(l.next_followup_at,q.issued_at), 'normal',2,l.assigned_to,pr.full_name,
      'quote',q.id,q.status,'["quote_followup","quote_accepted","no_progress"]'::jsonb,coalesce(q.updated_at,q.created_at)
    from public.quotes q join public.leads l on l.id=q.lead_id and l.clinic_id=q.clinic_id
    left join public.profiles pr on pr.id=l.assigned_to and pr.clinic_id=q.clinic_id
    where q.clinic_id=p_clinic_id and q.status='pending' and coalesce(l.is_archived,false)=false
    union all
    select 'owner:'||l.id,l.clinic_id,l.contact_id,l.id,'assign_owner',l.name,coalesce(l.phone_plus,l.phone),l.treatment,
      'Asignar responsable','La oportunidad no tiene responsable',coalesce(l.next_followup_at,l.created_at),'urgent',0,null,null,
      'opportunity',l.id,l.status,'["assign_owner"]'::jsonb,l.updated_at
    from public.leads l where l.clinic_id=p_clinic_id and l.assigned_to is null and coalesce(l.is_archived,false)=false
  ), ranked as (
    select c.*,case when c.due_at<now() then 0 when c.due_at<(date_trunc('day',now() at time zone 'America/Asuncion')+interval '1 day') at time zone 'America/Asuncion' then 1 when c.due_at is null then 3 else 2 end sg
    from candidates c
  ), filtered as (
    select * from ranked r where
      (p_assigned_to is null or r.assigned_to=p_assigned_to) and
      (normalized_view<>'my_work' or r.assigned_to=actor_id) and
      (normalized_view<>'overdue' or r.sg=0) and (normalized_view<>'today' or r.sg=1) and
      (normalized_view<>'upcoming' or r.sg=2) and (normalized_view<>'initial_contact' or r.work_type='initial_contact') and
      (normalized_view<>'followups' or r.work_type='followup') and (normalized_view<>'confirmations' or r.work_type in ('confirm_appointment','attendance')) and
      (normalized_view<>'no_show' or r.work_type='no_show_recovery') and (normalized_view<>'quotes' or r.work_type='quote_followup') and
      (normalized_view<>'reactivations' or r.work_type='reactivation') and (normalized_view<>'unassigned' or r.assigned_to is null) and
      (p_cursor_group is null or (r.sg,coalesce(r.due_at,'infinity'::timestamptz),r.priority_rank,r.work_key)>(p_cursor_group,coalesce(p_cursor_due_at,'infinity'::timestamptz),coalesce(p_cursor_priority,999),p_cursor_key))
  )
  select f.work_key,f.clinic_id,f.contact_id,f.opportunity_id,f.work_type,f.patient_name,f.patient_phone,f.treatment,
    f.title,f.reason,f.due_at,f.priority_group,f.priority_rank,f.assigned_to,f.assigned_name,f.source_type,f.source_id,f.status,f.available_actions,f.updated_at,f.sg
  from filtered f order by f.sg,coalesce(f.due_at,'infinity'::timestamptz),f.priority_rank,f.work_key limit p_limit+1;
end;
$function$;

revoke all on function public.list_work_items_v1(uuid,text,integer,uuid,integer,timestamptz,integer,text) from public,anon;
grant execute on function public.list_work_items_v1(uuid,text,integer,uuid,integer,timestamptz,integer,text) to authenticated;

create index if not exists tasks_work_queue_idx on public.tasks(clinic_id,status,due_at,id);
create index if not exists appointments_work_queue_idx on public.appointments(clinic_id,status,appointment_date,appointment_time,id);
create index if not exists quotes_work_queue_idx on public.quotes(clinic_id,status,issued_at,id);
