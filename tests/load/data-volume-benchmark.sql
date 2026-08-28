-- Approximate planner/storage benchmark using TEMP tables only. It creates no
-- persistent domain rows and is intended for local/staging administrative use.
-- Run once per target size:
--
-- psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 \
--   -v confirm_non_production=YES -v lead_count=10000 -v clinic_count=10 \
--   -f tests/load/data-volume-benchmark.sql

\set ON_ERROR_STOP on

select
  :'confirm_non_production' = 'YES'
  and :lead_count::integer between 10000 and 100000
  and :clinic_count::integer between 1 and 100
  as benchmark_inputs_are_safe
\gset

\if :benchmark_inputs_are_safe
\else
  \echo 'ABORT: require confirm_non_production=YES, lead_count 10000..100000 and clinic_count 1..100'
  \quit
\endif

\timing on

create temporary table qa_leads (
  id bigint primary key,
  clinic_id integer not null,
  status text not null,
  assigned_to integer,
  next_followup_at timestamptz,
  created_at timestamptz not null,
  name text not null,
  phone_plus text not null,
  payload text
);

create index qa_leads_clinic_status_idx on qa_leads (clinic_id, status);
create index qa_leads_clinic_assigned_idx on qa_leads (clinic_id, assigned_to);
create index qa_leads_clinic_due_idx on qa_leads (clinic_id, next_followup_at);
create index qa_leads_clinic_created_idx on qa_leads (clinic_id, created_at desc);

insert into qa_leads
select
  i,
  1 + ((i - 1) % :clinic_count::integer),
  (array['Nuevo', 'Contactado', 'Consulta Agendada', 'Confirmado', 'Presupuesto Enviado', 'Perdido'])[1 + (i % 6)],
  1 + (i % 4),
  now() + ((i % 60) - 30) * interval '1 day',
  now() - i * interval '1 minute',
  'Paciente benchmark ' || i,
  '+595981' || lpad((i % 1000000)::text, 6, '0'),
  repeat('x', 220)
from generate_series(1, :lead_count::integer) as series(i);

create temporary table qa_events (
  id bigint generated always as identity,
  clinic_id integer not null,
  lead_id bigint not null,
  event_type text not null,
  created_at timestamptz not null,
  payload text
);
create index qa_events_clinic_lead_created_idx on qa_events (clinic_id, lead_id, created_at desc);
insert into qa_events (clinic_id, lead_id, event_type, created_at, payload)
select l.clinic_id, l.id, 'benchmark_event_' || event_number, l.created_at + event_number * interval '1 minute', repeat('e', 160)
from qa_leads l cross join generate_series(1, 2) as event_number;

create temporary table qa_tasks (
  id bigint generated always as identity,
  clinic_id integer not null,
  lead_id bigint not null,
  status text not null,
  assigned_to integer,
  due_at timestamptz,
  payload text
);
create index qa_tasks_clinic_status_due_idx on qa_tasks (clinic_id, status, due_at);
create index qa_tasks_clinic_assigned_due_idx on qa_tasks (clinic_id, assigned_to, due_at);
insert into qa_tasks (clinic_id, lead_id, status, assigned_to, due_at, payload)
select clinic_id, id, case when id % 4 = 0 then 'hecho' else 'pendiente' end, assigned_to, next_followup_at, repeat('t', 140)
from qa_leads;

create temporary table qa_appointments (
  id bigint generated always as identity,
  clinic_id integer not null,
  lead_id bigint not null,
  appointment_date date not null,
  appointment_time time not null,
  status text not null,
  payload text
);
create index qa_appointments_clinic_date_time_idx on qa_appointments (clinic_id, appointment_date, appointment_time);
insert into qa_appointments (clinic_id, lead_id, appointment_date, appointment_time, status, payload)
select clinic_id, id, current_date + ((id % 60) - 30)::integer, time '09:00', 'Agendado', repeat('a', 120)
from qa_leads where id % 4 = 0;

create temporary table qa_quotes (
  id bigint generated always as identity,
  clinic_id integer not null,
  lead_id bigint not null,
  status text not null,
  next_action_at timestamptz,
  issued_at timestamptz not null,
  payload text
);
create index qa_quotes_clinic_status_next_idx on qa_quotes (clinic_id, status, next_action_at);
create index qa_quotes_clinic_issued_idx on qa_quotes (clinic_id, issued_at desc);
insert into qa_quotes (clinic_id, lead_id, status, next_action_at, issued_at, payload)
select clinic_id, id, 'pending', now() + interval '1 day', created_at + interval '1 day', repeat('q', 120)
from qa_leads where id % 5 = 0;

create temporary table qa_audit (
  id bigint generated always as identity,
  clinic_id integer not null,
  lead_id bigint not null,
  created_at timestamptz not null,
  payload text
);
create index qa_audit_clinic_created_idx on qa_audit (clinic_id, created_at desc);
insert into qa_audit (clinic_id, lead_id, created_at, payload)
select clinic_id, id, created_at, repeat('u', 100) from qa_leads;

analyze qa_leads;
analyze qa_events;
analyze qa_tasks;
analyze qa_appointments;
analyze qa_quotes;
analyze qa_audit;

-- Current CRM workspace shape: each relation is loaded in full for one clinic.
explain (analyze, buffers, timing, summary)
select * from qa_leads where clinic_id = 1 order by created_at desc;

explain (analyze, buffers, timing, summary)
select * from qa_events where clinic_id = 1 order by created_at desc;

explain (analyze, buffers, timing, summary)
select * from qa_tasks where clinic_id = 1 order by due_at asc nulls last;

explain (analyze, buffers, timing, summary)
select * from qa_appointments where clinic_id = 1 order by appointment_date, appointment_time;

explain (analyze, buffers, timing, summary)
select * from qa_quotes where clinic_id = 1 order by issued_at desc;

-- Indexed access patterns requested by the audit.
explain (analyze, buffers, timing, summary)
select count(*) from qa_leads where clinic_id = 1 and status = 'Nuevo';

explain (analyze, buffers, timing, summary)
select count(*) from qa_leads where clinic_id = 1 and assigned_to = 1;

explain (analyze, buffers, timing, summary)
select * from qa_leads where clinic_id = 1 and next_followup_at <= now() order by next_followup_at limit 100;

select
  :lead_count::integer as opportunities,
  :clinic_count::integer as clinics,
  (select count(*) from qa_leads where clinic_id = 1) as opportunities_in_sample_clinic,
  pg_total_relation_size('pg_temp.qa_leads')
    + pg_total_relation_size('pg_temp.qa_events')
    + pg_total_relation_size('pg_temp.qa_tasks')
    + pg_total_relation_size('pg_temp.qa_appointments')
    + pg_total_relation_size('pg_temp.qa_quotes')
    + pg_total_relation_size('pg_temp.qa_audit') as modeled_total_bytes,
  round((
    pg_total_relation_size('pg_temp.qa_leads')
    + pg_total_relation_size('pg_temp.qa_events')
    + pg_total_relation_size('pg_temp.qa_tasks')
    + pg_total_relation_size('pg_temp.qa_appointments')
    + pg_total_relation_size('pg_temp.qa_quotes')
    + pg_total_relation_size('pg_temp.qa_audit')
  )::numeric / :lead_count::integer, 2) as modeled_bytes_per_opportunity;

\timing off
