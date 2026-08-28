-- Periodic read-only integrity health check. Expected count is zero for every
-- row. It never repairs or deletes data.

\set ON_ERROR_STOP on

with checks as (
  select 'open_opportunities_without_clinic_id' as check_name, count(*)::bigint as issue_count
  from public.leads
  where clinic_id is null
    and coalesce(is_archived, false) is false
    and coalesce(status, 'Nuevo') not in ('Perdido', 'Tratamiento Iniciado', 'Archivado')

  union all
  select 'open_opportunities_without_assignee', count(*)
  from public.leads
  where assigned_to is null
    and coalesce(is_archived, false) is false
    and coalesce(status, 'Nuevo') not in ('Perdido', 'Tratamiento Iniciado', 'Archivado')

  union all
  select 'assignee_from_another_clinic', count(*)
  from public.leads l
  left join public.profiles p on p.id = l.assigned_to
  where l.assigned_to is not null
    and (p.id is null or p.clinic_id <> l.clinic_id or p.active is not true)

  union all
  select 'open_opportunities_without_effective_next_action', count(*)
  from public.leads l
  where coalesce(l.is_archived, false) is false
    and coalesce(l.status, 'Nuevo') not in ('Perdido', 'Tratamiento Iniciado', 'Archivado')
    and nullif(btrim(l.next_action), '') is null
    and not exists (
      select 1 from public.tasks t
      where t.clinic_id = l.clinic_id
        and t.lead_id = l.id
        and lower(t.status) in ('pendiente', 'vencido', 'vencida')
    )

  union all
  select 'tasks_cross_tenant', count(*)
  from public.tasks t
  join public.leads l on l.id = t.lead_id
  where t.clinic_id <> l.clinic_id

  union all
  select 'appointments_cross_tenant', count(*)
  from public.appointments a
  join public.leads l on l.id = a.lead_id
  where a.clinic_id <> l.clinic_id

  union all
  select 'quotes_cross_tenant', count(*)
  from public.quotes q
  join public.leads l on l.id = q.lead_id
  where q.clinic_id <> l.clinic_id

  union all
  select 'quote_appointments_cross_tenant_or_lead', count(*)
  from public.quotes q
  join public.appointments a on a.id = q.appointment_id
  where q.appointment_id is not null
    and (q.clinic_id <> a.clinic_id or q.lead_id <> a.lead_id)

  union all
  select 'unexpected_open_duplicates', count(*)
  from (
    select clinic_id, phone_plus
    from public.leads
    where phone_plus is not null
      and coalesce(is_archived, false) is false
      and coalesce(status, 'Nuevo') not in ('Perdido', 'Tratamiento Iniciado', 'Archivado')
    group by clinic_id, phone_plus
    having count(*) > 1
  ) duplicates
)
select check_name, issue_count, issue_count = 0 as healthy
from checks
order by check_name;
