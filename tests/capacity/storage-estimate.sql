-- Read-only storage sample. Run against local/staging or production with a
-- read-only administrative connection; it does not create or modify data.

\set ON_ERROR_STOP on

with sampled_leads as (
  select l.id, pg_column_size(l) as lead_bytes
  from public.leads l
  order by l.created_at desc
  limit 5000
), components as (
  select
    s.id,
    s.lead_bytes,
    coalesce((select sum(pg_column_size(e)) from public.lead_events e where e.lead_id = s.id), 0) as event_bytes,
    coalesce((select sum(pg_column_size(t)) from public.tasks t where t.lead_id = s.id), 0) as task_bytes,
    coalesce((select sum(pg_column_size(a)) from public.appointments a where a.lead_id = s.id), 0) as appointment_bytes,
    coalesce((select sum(pg_column_size(q)) from public.quotes q where q.lead_id = s.id), 0) as quote_bytes,
    coalesce((select sum(pg_column_size(al)) from public.audit_logs al where al.row_id = s.id), 0) as audit_bytes
  from sampled_leads s
)
select
  count(*) as sampled_opportunities,
  round(avg(lead_bytes)) as avg_lead_row_bytes,
  round(avg(event_bytes)) as avg_event_row_bytes_per_opportunity,
  round(avg(task_bytes)) as avg_task_row_bytes_per_opportunity,
  round(avg(appointment_bytes)) as avg_appointment_row_bytes_per_opportunity,
  round(avg(quote_bytes)) as avg_quote_row_bytes_per_opportunity,
  round(avg(audit_bytes)) as avg_audit_row_bytes_per_opportunity,
  round(avg(lead_bytes + event_bytes + task_bytes + appointment_bytes + quote_bytes + audit_bytes)) as avg_visible_row_bytes_per_opportunity
from components;

select
  relation,
  pg_size_pretty(pg_relation_size(relation)) as heap,
  pg_size_pretty(pg_indexes_size(relation)) as indexes,
  pg_size_pretty(pg_total_relation_size(relation)) as total,
  pg_total_relation_size(relation) as total_bytes
from unnest(array[
  'public.leads'::regclass,
  'public.lead_events'::regclass,
  'public.tasks'::regclass,
  'public.appointments'::regclass,
  'public.quotes'::regclass,
  'public.audit_logs'::regclass,
  'public.automation_jobs'::regclass,
  'public.form_submission_logs'::regclass
]) as relation
order by pg_total_relation_size(relation) desc;

select
  (select count(*) from public.leads) as opportunities,
  pg_database_size(current_database()) as database_bytes,
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  case when (select count(*) from public.leads) > 0 then
    round(pg_database_size(current_database())::numeric / (select count(*) from public.leads), 2)
  end as whole_database_bytes_per_current_opportunity;
