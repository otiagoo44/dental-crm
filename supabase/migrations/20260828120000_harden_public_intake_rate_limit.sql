-- Atomic abuse protection for the public intake endpoint.
-- Safe migration: no domain data is deleted and RLS remains enabled.

alter table public.form_submission_logs
  add column if not exists counts_toward_rate_limit boolean not null default false;

alter table public.form_submission_logs
  drop constraint if exists form_submission_logs_status_check;

alter table public.form_submission_logs
  add constraint form_submission_logs_status_check
  check (status in ('accepted', 'rate_check', 'rate_limited', 'invalid_token', 'spam', 'error')) not valid;

alter table public.form_submission_logs
  validate constraint form_submission_logs_status_check;

create index if not exists form_submission_logs_form_rate_created_idx
  on public.form_submission_logs (clinic_public_form_id, created_at desc)
  where counts_toward_rate_limit is true;

create index if not exists form_submission_logs_form_rate_ip_created_idx
  on public.form_submission_logs (clinic_public_form_id, ip_hash, created_at desc)
  where counts_toward_rate_limit is true and ip_hash is not null;

create index if not exists form_submission_logs_form_rate_phone_created_idx
  on public.form_submission_logs (clinic_public_form_id, phone_hash, created_at desc)
  where counts_toward_rate_limit is true and phone_hash is not null;

-- Counting and reserving a slot happen in one transaction. The per-form
-- advisory lock prevents simultaneous requests from all observing the same
-- pre-insert count and crossing the configured limits together.
create or replace function public.reserve_public_form_submission(
  p_form_id uuid,
  p_ip_hash text,
  p_phone_hash text,
  p_window_minutes integer,
  p_max_form integer,
  p_max_ip integer,
  p_max_phone integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  form_record public.clinic_public_forms;
  window_start timestamptz;
  recent_form_count integer;
  recent_ip_count integer;
  recent_phone_count integer;
  reservation_id uuid;
  allowed boolean;
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (select auth.jwt() ->> 'role'),
    ''
  ) <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  if p_window_minutes not between 1 and 1440
     or p_max_form not between 1 and 10000
     or p_max_ip not between 1 and 10000
     or p_max_phone not between 1 and 10000
     or nullif(btrim(p_ip_hash), '') is null
     or nullif(btrim(p_phone_hash), '') is null then
    raise exception using errcode = '22023', message = 'Invalid rate limit configuration';
  end if;

  select f.* into form_record
  from public.clinic_public_forms f
  where f.id = p_form_id
    and f.is_active is true;

  if not found then
    raise exception using errcode = '42501', message = 'Public form not authorized';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(form_record.id::text, 0));
  window_start := clock_timestamp() - make_interval(mins => p_window_minutes);

  select
    count(*),
    count(*) filter (where l.ip_hash = p_ip_hash),
    count(*) filter (where l.phone_hash = p_phone_hash)
  into recent_form_count, recent_ip_count, recent_phone_count
  from public.form_submission_logs l
  where l.clinic_public_form_id = form_record.id
    and l.counts_toward_rate_limit is true
    and l.created_at >= window_start;

  allowed := recent_form_count < p_max_form
    and recent_ip_count < p_max_ip
    and recent_phone_count < p_max_phone;

  insert into public.form_submission_logs (
    clinic_public_form_id,
    clinic_id,
    ip_hash,
    phone_hash,
    status,
    counts_toward_rate_limit
  ) values (
    form_record.id,
    form_record.clinic_id,
    p_ip_hash,
    p_phone_hash,
    case when allowed then 'rate_check' else 'rate_limited' end,
    allowed
  )
  returning id into reservation_id;

  return jsonb_build_object(
    'allowed', allowed,
    'reservation_id', reservation_id
  );
end;
$function$;

revoke all on function public.reserve_public_form_submission(
  uuid, text, text, integer, integer, integer, integer
) from public, anon, authenticated, service_role;

grant execute on function public.reserve_public_form_submission(
  uuid, text, text, integer, integer, integer, integer
) to service_role;

notify pgrst, 'reload schema';
