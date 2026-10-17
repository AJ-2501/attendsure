-- SmartAttend: helper functions, atomic RPCs, RLS policies.
-- All write RPCs are SECURITY DEFINER and executable ONLY by service_role.
-- The Next.js server verifies the caller's staff role (from profiles) before
-- invoking them with the service-role client.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_user_id = auth.uid()
$$;

create or replace function public.current_staff_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles
  where auth_user_id = auth.uid() and role in ('super_admin','event_admin','scanner_staff')
$$;

create or replace function public.event_effective_status(e public.events) returns text
language sql stable as $$
  select case
    when e.status = 'cancelled' then 'cancelled'
    when e.status = 'draft' then 'draft'
    when now() >= e.ends_at then 'completed'
    when now() >= e.starts_at then 'ongoing'
    when now() >= e.registration_opens_at and now() < e.registration_closes_at then 'open'
    else 'upcoming'
  end
$$;

create or replace function public.gen_ref(prefix text) returns text
language sql volatile as $$
  select prefix || '-' || upper(encode(gen_random_bytes(5), 'hex'))
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window). Returns true when the request is allowed.
-- ---------------------------------------------------------------------------
create or replace function public.rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c int;
begin
  insert into public.rate_limits(key, window_start, count) values (p_key, w, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into c;
  -- opportunistic cleanup
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return c <= p_max;
end $$;

-- ---------------------------------------------------------------------------
-- Registration (atomic: capacity lock, window, duplicates, credential)
-- ---------------------------------------------------------------------------
create or replace function public.register_participant(
  p_event_id uuid,
  p_reference_code text,
  p_access_token_hash text,
  p_name_enc text,
  p_student_id_enc text,
  p_email_enc text,
  p_lookup_digest text,
  p_section text,
  p_year_level text,
  p_department text,
  p_time_in_cred_id uuid,
  p_time_in_token_hash text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ev public.events;
  n int;
  reg_id uuid;
begin
  select * into ev from public.events where id = p_event_id for update;
  if not found or ev.status <> 'published' then
    return jsonb_build_object('ok', false, 'code', 'EVENT_NOT_AVAILABLE');
  end if;
  if now() < ev.registration_opens_at or now() >= ev.registration_closes_at then
    return jsonb_build_object('ok', false, 'code', 'REGISTRATION_CLOSED');
  end if;
  if exists (select 1 from public.registrations
             where event_id = p_event_id and student_id_lookup_digest = p_lookup_digest) then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE_REGISTRATION');
  end if;
  select count(*) into n from public.registrations
   where event_id = p_event_id and registration_status = 'registered';
  if n >= ev.capacity then
    return jsonb_build_object('ok', false, 'code', 'EVENT_FULL');
  end if;

  insert into public.registrations(
    event_id, reference_code, access_token_hash, participant_name_encrypted,
    student_id_encrypted, email_encrypted, student_id_lookup_digest,
    section, year_level, department)
  values (p_event_id, p_reference_code, p_access_token_hash, p_name_enc,
    p_student_id_enc, p_email_enc, p_lookup_digest,
    p_section, p_year_level, p_department)
  returning id into reg_id;

  insert into public.attendance_records(registration_id, event_id) values (reg_id, p_event_id);

  if ev.allow_time_in then
    insert into public.qr_credentials(id, registration_id, event_id, action, token_hash, expires_at)
    values (p_time_in_cred_id, reg_id, p_event_id, 'time_in', p_time_in_token_hash, null);
  end if;

  return jsonb_build_object('ok', true, 'code', 'REGISTERED', 'registration_id', reg_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'DUPLICATE_REGISTRATION');
end $$;

-- ---------------------------------------------------------------------------
-- Credential issuance / revocation
-- p_self = true: participant self-service (only time_out, only after time-in,
-- only within time-out window). Admin issuance (p_self=false) is audited.
-- ---------------------------------------------------------------------------
create or replace function public.issue_credential(
  p_registration_id uuid,
  p_action text,
  p_cred_id uuid,
  p_token_hash text,
  p_issued_by uuid,
  p_self boolean,
  p_reason text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  reg public.registrations;
  ev public.events;
  att public.attendance_records;
  exp timestamptz;
  revoked int;
begin
  select * into reg from public.registrations where id = p_registration_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_REGISTERED'); end if;
  if reg.registration_status <> 'registered' then
    return jsonb_build_object('ok', false, 'code', 'REGISTRATION_CANCELLED');
  end if;
  select * into ev from public.events where id = reg.event_id;
  if ev.status = 'cancelled' then return jsonb_build_object('ok', false, 'code', 'EVENT_CANCELLED'); end if;
  select * into att from public.attendance_records where registration_id = reg.id;

  if p_action = 'time_in' then
    if not ev.allow_time_in then return jsonb_build_object('ok', false, 'code', 'ACTION_DISABLED'); end if;
    if p_self then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
    if att.time_in_at is not null then return jsonb_build_object('ok', false, 'code', 'ALREADY_TIMED_IN'); end if;
    exp := null;
  elsif p_action = 'time_out' then
    if not ev.allow_time_out then return jsonb_build_object('ok', false, 'code', 'ACTION_DISABLED'); end if;
    if att.time_in_at is null and ev.allow_time_in then
      return jsonb_build_object('ok', false, 'code', 'NOT_TIMED_IN');
    end if;
    if att.time_out_at is not null then return jsonb_build_object('ok', false, 'code', 'ALREADY_TIMED_OUT'); end if;
    if p_self and (now() < coalesce(ev.time_out_opens_at, ev.starts_at)
                   or now() >= coalesce(ev.time_out_closes_at, ev.ends_at + interval '2 hours')) then
      return jsonb_build_object('ok', false, 'code', 'OUTSIDE_WINDOW');
    end if;
    exp := now() + make_interval(secs => ev.time_out_qr_ttl_seconds);
  else
    return jsonb_build_object('ok', false, 'code', 'INVALID_ACTION');
  end if;

  update public.qr_credentials
     set revoked_at = now(), revoked_reason = coalesce(p_reason, 'superseded')
   where registration_id = reg.id and action = p_action and used_at is null and revoked_at is null;
  get diagnostics revoked = row_count;

  insert into public.qr_credentials(id, registration_id, event_id, action, token_hash, expires_at, issued_by)
  values (p_cred_id, reg.id, reg.event_id, p_action, p_token_hash, exp, p_issued_by);

  if not p_self then
    insert into public.attendance_audit_logs(event_id, registration_id, actor_user_id, action, reason, metadata)
    values (reg.event_id, reg.id, p_issued_by, 'credential.reissued', p_reason,
            jsonb_build_object('credential_action', p_action, 'revoked_count', revoked, 'credential_id', p_cred_id));
  end if;

  return jsonb_build_object('ok', true, 'code', 'ISSUED', 'expires_at', exp, 'revoked_count', revoked);
end $$;

create or replace function public.revoke_credentials(
  p_registration_id uuid, p_action text, p_actor uuid, p_reason text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare reg public.registrations; n int;
begin
  select * into reg from public.registrations where id = p_registration_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_REGISTERED'); end if;
  update public.qr_credentials set revoked_at = now(), revoked_reason = p_reason
   where registration_id = reg.id and (p_action is null or action = p_action)
     and used_at is null and revoked_at is null;
  get diagnostics n = row_count;
  insert into public.attendance_audit_logs(event_id, registration_id, actor_user_id, action, reason, metadata)
  values (reg.event_id, reg.id, p_actor, 'credential.revoked', p_reason,
          jsonb_build_object('credential_action', coalesce(p_action, 'all'), 'revoked_count', n));
  return jsonb_build_object('ok', true, 'code', 'REVOKED', 'revoked_count', n);
end $$;

-- ---------------------------------------------------------------------------
-- Internal: apply an attendance action to a locked attendance row.
-- ---------------------------------------------------------------------------
create or replace function public._apply_attendance(
  p_att_id uuid, p_action text, p_actor uuid, p_enforce_window boolean, ev public.events
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  att public.attendance_records;
  ts timestamptz := now();
  ref text;
begin
  select * into att from public.attendance_records where id = p_att_id for update;
  if ev.status = 'cancelled' then return jsonb_build_object('code', 'EVENT_CANCELLED'); end if;
  if ev.status = 'draft' then return jsonb_build_object('code', 'EVENT_NOT_AVAILABLE'); end if;

  if p_action = 'time_in' then
    if not ev.allow_time_in then return jsonb_build_object('code', 'ACTION_DISABLED'); end if;
    if att.time_in_at is not null then
      return jsonb_build_object('code', 'ALREADY_TIMED_IN', 'recorded_at', att.time_in_at);
    end if;
    if p_enforce_window and (ts < ev.time_in_opens_at or ts >= ev.time_in_closes_at) then
      return jsonb_build_object('code', 'OUTSIDE_WINDOW');
    end if;
    ref := public.gen_ref('TI');
    update public.attendance_records
       set time_in_at = ts, time_in_recorded_by = p_actor, time_in_ref = ref, status = 'checked_in'
     where id = att.id;
  else
    if not ev.allow_time_out then return jsonb_build_object('code', 'ACTION_DISABLED'); end if;
    if att.time_out_at is not null then
      return jsonb_build_object('code', 'ALREADY_TIMED_OUT', 'recorded_at', att.time_out_at);
    end if;
    if att.time_in_at is null then return jsonb_build_object('code', 'NOT_TIMED_IN'); end if;
    if p_enforce_window and (ts < coalesce(ev.time_out_opens_at, ev.starts_at)
                             or ts >= coalesce(ev.time_out_closes_at, ev.ends_at + interval '2 hours')) then
      return jsonb_build_object('code', 'OUTSIDE_WINDOW');
    end if;
    ref := public.gen_ref('TO');
    update public.attendance_records
       set time_out_at = ts, time_out_recorded_by = p_actor, time_out_ref = ref, status = 'completed'
     where id = att.id;
  end if;
  return jsonb_build_object('code', 'ACCEPTED', 'recorded_at', ts, 'confirmation_ref', ref);
end $$;

-- ---------------------------------------------------------------------------
-- QR scan: the ONLY path to record attendance via QR.
-- Row lock on the credential guarantees one-time use under concurrency.
-- ---------------------------------------------------------------------------
create or replace function public.process_scan(
  p_token_hash text, p_event_id uuid, p_action text, p_actor uuid, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  prior public.scan_attempts;
  cred public.qr_credentials;
  reg public.registrations;
  ev public.events;
  att_id uuid;
  r jsonb;
  code text;
begin
  if p_idempotency_key is not null then
    select * into prior from public.scan_attempts where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('code', prior.result_code, 'registration_id', prior.registration_id,
        'recorded_at', prior.recorded_at, 'confirmation_ref', prior.confirmation_ref, 'replayed', true);
    end if;
  end if;

  select * into ev from public.events where id = p_event_id;
  if not found then
    code := 'EVENT_NOT_AVAILABLE';
  else
    select * into cred from public.qr_credentials where token_hash = p_token_hash for update;
    if not found then
      code := 'INVALID_TOKEN';
    elsif cred.event_id <> p_event_id then
      code := 'WRONG_EVENT';
    elsif cred.action <> p_action then
      code := 'WRONG_ACTION';
    elsif cred.revoked_at is not null then
      code := 'REVOKED';
    elsif cred.used_at is not null then
      code := 'ALREADY_USED';
    elsif cred.expires_at is not null and cred.expires_at <= now() then
      code := 'EXPIRED';
    else
      select * into reg from public.registrations where id = cred.registration_id;
      if reg.registration_status <> 'registered' then
        code := 'REGISTRATION_CANCELLED';
      else
        select id into att_id from public.attendance_records where registration_id = reg.id;
        r := public._apply_attendance(att_id, p_action, p_actor, true, ev);
        code := r->>'code';
        if code = 'ACCEPTED' then
          update public.qr_credentials set used_at = (r->>'recorded_at')::timestamptz, used_by = p_actor
           where id = cred.id;
        end if;
      end if;
    end if;
  end if;

  begin
    insert into public.scan_attempts(event_id, credential_id, registration_id, credential_event_id,
      actor_profile_id, action, method, result, result_code, confirmation_ref, recorded_at, idempotency_key)
    values (case when ev.id is null then null else p_event_id end, cred.id, cred.registration_id, cred.event_id,
      p_actor, p_action, 'qr', case when code = 'ACCEPTED' then 'accepted' else 'rejected' end, code,
      r->>'confirmation_ref', (r->>'recorded_at')::timestamptz, p_idempotency_key);
  exception when unique_violation then
    select * into prior from public.scan_attempts where idempotency_key = p_idempotency_key;
    return jsonb_build_object('code', prior.result_code, 'registration_id', prior.registration_id,
      'recorded_at', prior.recorded_at, 'confirmation_ref', prior.confirmation_ref, 'replayed', true);
  end;

  return jsonb_build_object('code', code, 'registration_id', cred.registration_id,
    'recorded_at', r->>'recorded_at', 'confirmation_ref', r->>'confirmation_ref', 'replayed', false);
end $$;

-- ---------------------------------------------------------------------------
-- Manual attendance (staff, with reason; window not enforced, audited)
-- ---------------------------------------------------------------------------
create or replace function public.manual_attendance(
  p_registration_id uuid, p_event_id uuid, p_action text, p_actor uuid, p_reason text, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  prior public.scan_attempts;
  reg public.registrations;
  ev public.events;
  att_id uuid;
  r jsonb;
  code text;
begin
  if p_idempotency_key is not null then
    select * into prior from public.scan_attempts where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('code', prior.result_code, 'registration_id', prior.registration_id,
        'recorded_at', prior.recorded_at, 'confirmation_ref', prior.confirmation_ref, 'replayed', true);
    end if;
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 5 then
    return jsonb_build_object('code', 'REASON_REQUIRED');
  end if;
  select * into reg from public.registrations where id = p_registration_id;
  if not found or reg.event_id <> p_event_id then
    code := 'NOT_REGISTERED';
  elsif reg.registration_status <> 'registered' then
    code := 'REGISTRATION_CANCELLED';
  else
    select * into ev from public.events where id = p_event_id;
    select id into att_id from public.attendance_records where registration_id = reg.id;
    r := public._apply_attendance(att_id, p_action, p_actor, false, ev);
    code := r->>'code';
    if code = 'ACCEPTED' then
      -- any outstanding credential for this action is now moot
      update public.qr_credentials set revoked_at = now(), revoked_reason = 'manual_attendance'
       where registration_id = reg.id and action = p_action and used_at is null and revoked_at is null;
      insert into public.attendance_audit_logs(event_id, registration_id, actor_user_id, action, reason, metadata)
      values (p_event_id, reg.id, p_actor, 'attendance.manual', p_reason,
              jsonb_build_object('attendance_action', p_action, 'recorded_at', r->>'recorded_at'));
    end if;
  end if;

  insert into public.scan_attempts(event_id, registration_id, credential_event_id, actor_profile_id, action,
    method, result, result_code, confirmation_ref, recorded_at, idempotency_key)
  values (p_event_id, case when code = 'NOT_REGISTERED' then null else p_registration_id end, null, p_actor,
    p_action, 'manual', case when code = 'ACCEPTED' then 'accepted' else 'rejected' end, code,
    r->>'confirmation_ref', (r->>'recorded_at')::timestamptz, p_idempotency_key)
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('code', code, 'registration_id', p_registration_id,
    'recorded_at', r->>'recorded_at', 'confirmation_ref', r->>'confirmation_ref', 'replayed', false);
end $$;

-- ---------------------------------------------------------------------------
-- Attendance correction (admin, reason required, before/after audited)
-- ---------------------------------------------------------------------------
create or replace function public.correct_attendance(
  p_registration_id uuid, p_time_in timestamptz, p_time_out timestamptz, p_actor uuid, p_reason text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare att public.attendance_records;
begin
  if p_reason is null or char_length(trim(p_reason)) < 5 then
    return jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED');
  end if;
  if p_time_out is not null and (p_time_in is null or p_time_out < p_time_in) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_SEQUENCE');
  end if;
  select * into att from public.attendance_records where registration_id = p_registration_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_REGISTERED'); end if;

  update public.attendance_records set
    time_in_at = p_time_in,
    time_in_recorded_by = case when p_time_in is distinct from att.time_in_at then p_actor else time_in_recorded_by end,
    time_in_ref = case when p_time_in is null then null else coalesce(time_in_ref, public.gen_ref('TI')) end,
    time_out_at = p_time_out,
    time_out_recorded_by = case when p_time_out is distinct from att.time_out_at then p_actor else time_out_recorded_by end,
    time_out_ref = case when p_time_out is null then null else coalesce(time_out_ref, public.gen_ref('TO')) end,
    status = case when p_time_out is not null then 'completed' when p_time_in is not null then 'checked_in' else 'absent' end
  where id = att.id;

  insert into public.attendance_audit_logs(event_id, registration_id, actor_user_id, action, reason, metadata)
  values (att.event_id, p_registration_id, p_actor, 'attendance.corrected', p_reason,
    jsonb_build_object('before', jsonb_build_object('time_in_at', att.time_in_at, 'time_out_at', att.time_out_at),
                       'after', jsonb_build_object('time_in_at', p_time_in, 'time_out_at', p_time_out)));
  return jsonb_build_object('ok', true, 'code', 'CORRECTED');
end $$;

create or replace function public.cancel_registration(
  p_registration_id uuid, p_actor uuid, p_reason text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare reg public.registrations;
begin
  if p_reason is null or char_length(trim(p_reason)) < 5 then
    return jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED');
  end if;
  select * into reg from public.registrations where id = p_registration_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_REGISTERED'); end if;
  if reg.registration_status = 'cancelled' then return jsonb_build_object('ok', false, 'code', 'ALREADY_CANCELLED'); end if;
  update public.registrations set registration_status = 'cancelled', cancelled_reason = p_reason where id = reg.id;
  update public.qr_credentials set revoked_at = now(), revoked_reason = 'registration_cancelled'
   where registration_id = reg.id and used_at is null and revoked_at is null;
  insert into public.attendance_audit_logs(event_id, registration_id, actor_user_id, action, reason)
  values (reg.event_id, reg.id, p_actor, 'registration.cancelled', p_reason);
  return jsonb_build_object('ok', true, 'code', 'CANCELLED');
end $$;

-- ---------------------------------------------------------------------------
-- Stats (aggregate, no PII)
-- ---------------------------------------------------------------------------
create or replace function public.event_stats(p_event_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'registered', count(*) filter (where r.registration_status = 'registered'),
    'timed_in',   count(*) filter (where r.registration_status = 'registered' and a.time_in_at is not null),
    'timed_out',  count(*) filter (where r.registration_status = 'registered' and a.time_out_at is not null),
    'checked_in', count(*) filter (where r.registration_status = 'registered' and a.status = 'checked_in'),
    'not_arrived',count(*) filter (where r.registration_status = 'registered' and a.time_in_at is null),
    'cancelled',  count(*) filter (where r.registration_status = 'cancelled'),
    'rejected_scans', (select count(*) from public.scan_attempts s where s.event_id = p_event_id and s.result = 'rejected'),
    'accepted_scans', (select count(*) from public.scan_attempts s where s.event_id = p_event_id and s.result = 'accepted')
  )
  from public.registrations r join public.attendance_records a on a.registration_id = r.id
  where r.event_id = p_event_id
$$;

create or replace function public.section_breakdown(p_event_id uuid, p_dimension text) returns table(
  label text, registered bigint, timed_in bigint, timed_out bigint
) language sql stable security definer set search_path = public as $$
  select coalesce(nullif(case p_dimension
           when 'section' then r.section
           when 'year_level' then r.year_level
           when 'department' then r.department end, ''), '(none)') as label,
         count(*), count(a.time_in_at), count(a.time_out_at)
  from public.registrations r join public.attendance_records a on a.registration_id = r.id
  where r.event_id = p_event_id and r.registration_status = 'registered'
  group by 1 order by 1
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: lock everything down to service_role.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.event_effective_status(public.events) to anon, authenticated;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.events                enable row level security;
alter table public.registrations         enable row level security;
alter table public.qr_credentials        enable row level security;
alter table public.attendance_records    enable row level security;
alter table public.scan_attempts         enable row level security;
alter table public.attendance_audit_logs enable row level security;
alter table public.rate_limits           enable row level security;

-- Defense in depth: clients never write directly; all writes go through server + RPC.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on public.rate_limits from anon, authenticated;

-- profiles: own row; super_admin sees all. No client writes => no self-promotion.
create policy profiles_select_own on public.profiles for select to authenticated
  using (auth_user_id = auth.uid() or public.current_staff_role() = 'super_admin');

-- events: published events are public; staff see drafts too.
create policy events_public_read on public.events for select to anon, authenticated
  using (status in ('published','cancelled'));
create policy events_staff_read on public.events for select to authenticated
  using (public.current_staff_role() is not null);

-- registrations: staff only, or a student whose verified account is linked.
create policy registrations_staff_read on public.registrations for select to authenticated
  using (public.current_staff_role() is not null);
create policy registrations_owner_read on public.registrations for select to authenticated
  using (linked_profile_id is not null and linked_profile_id = public.current_profile_id());

create policy qr_staff_read on public.qr_credentials for select to authenticated
  using (public.current_staff_role() in ('super_admin','event_admin'));

create policy attendance_staff_read on public.attendance_records for select to authenticated
  using (public.current_staff_role() is not null);
create policy attendance_owner_read on public.attendance_records for select to authenticated
  using (exists (select 1 from public.registrations r
                 where r.id = registration_id and r.linked_profile_id = public.current_profile_id()));

create policy scans_staff_read on public.scan_attempts for select to authenticated
  using (public.current_staff_role() is not null);

create policy audit_admin_read on public.attendance_audit_logs for select to authenticated
  using (public.current_staff_role() in ('super_admin','event_admin'));

-- rate_limits: no policies => no client access.

-- Realtime: staff-only (RLS applies to postgres_changes). No PII columns in these tables.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.scan_attempts, public.attendance_records;
  end if;
end $$;
