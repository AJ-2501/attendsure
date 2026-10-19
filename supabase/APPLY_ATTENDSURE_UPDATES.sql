-- =============================================================================
-- AttendSure: ALL database updates since the initial schema, in one file.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query -> paste this whole
-- file -> Run. Safe to run more than once. Runs as one transaction: if anything
-- fails, nothing is changed.
--
-- Contains, in order: 20261019000003, 20261019000004, 20261019000005.
-- =============================================================================
begin;

-- ----------------------------------------------------------------------------
-- 20261019000003_student_accounts_event_delete.sql
-- ----------------------------------------------------------------------------
-- AttendSure: student accounts, event deletion, 10-digit student IDs.
-- Run after 20261017000001_schema.sql and 20261017000002_functions_rls.sql.

-- ---------------------------------------------------------------------------
-- 1. Student accounts: one verified student ID per profile.
--    Stores only the keyed HMAC digest (same as registrations), never the raw ID.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists student_id_digest text unique;
create index if not exists registrations_student_digest_idx
  on public.registrations (student_id_lookup_digest);

-- ---------------------------------------------------------------------------
-- 2. Audit logs stay append-only, but may drop a reference to a deleted
--    event/registration/profile (ON DELETE SET NULL). Content stays immutable.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_audit_mutation() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and new.id = old.id
     and new.action = old.action
     and new.reason is not distinct from old.reason
     and new.metadata = old.metadata
     and new.created_at = old.created_at
     and (new.event_id is not distinct from old.event_id or new.event_id is null)
     and (new.registration_id is not distinct from old.registration_id or new.registration_id is null)
     and (new.actor_user_id is not distinct from old.actor_user_id or new.actor_user_id is null)
  then
    return new; -- referential cleanup only
  end if;
  raise exception 'audit logs are append-only';
end $$;

-- ---------------------------------------------------------------------------
-- 3. Delete an event and everything attached to it, atomically, with an audit record.
-- ---------------------------------------------------------------------------
create or replace function public.delete_event(p_event_id uuid, p_actor uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ev public.events;
  n_reg int;
  n_att int;
begin
  if p_reason is null or char_length(trim(p_reason)) < 5 then
    return jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED');
  end if;
  select * into ev from public.events where id = p_event_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select count(*) into n_reg from public.registrations where event_id = p_event_id;
  select count(*) into n_att from public.attendance_records
   where event_id = p_event_id and time_in_at is not null;

  -- Written first with event_id NULL so the record survives the deletion.
  insert into public.attendance_audit_logs(event_id, actor_user_id, action, reason, metadata)
  values (null, p_actor, 'event.deleted', trim(p_reason), jsonb_build_object(
    'event_id', ev.id, 'name', ev.name, 'starts_at', ev.starts_at,
    'registrations', n_reg, 'attended', n_att));

  -- Credentials and attendance cascade from registrations; scans cascade from the event.
  delete from public.registrations where event_id = p_event_id;
  delete from public.events where id = p_event_id;

  return jsonb_build_object('ok', true, 'registrations', n_reg, 'attended', n_att);
end $$;

revoke all on function public.delete_event(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.delete_event(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Student ID format: 2021-00195 → 2021001955 (10 digits: year + 6-digit number).
--    Only events still using the old built-in default are migrated.
-- ---------------------------------------------------------------------------
alter table public.events alter column student_id_pattern set default '^[0-9]{10}$';
alter table public.events alter column student_id_hint set default 'Format: 2021001955 (10 digits, no dash)';
update public.events
   set student_id_pattern = '^[0-9]{10}$',
       student_id_hint = 'Format: 2021001955 (10 digits, no dash)'
 where student_id_pattern in ('^[0-9]{4}-[0-9]{5}$', '^[0-9]{4}-[0-9]{6}$');

-- ----------------------------------------------------------------------------
-- 20261019000004_student_registration_ownership.sql
-- ----------------------------------------------------------------------------
-- AttendSure: per-registration ownership for student accounts.
-- Run after 20261019000003_student_accounts_event_delete.sql. Safe to re-run.
--
-- An account sees only registrations it created, or proved with that registration's
-- own reference code (registrations.linked_profile_id). Matching on student ID alone
-- would let anyone who registers with another student's ID see and use their passes.

do $$
begin
  -- The unique constraint only exists before this migration has run, so the one-time
  -- cleanup below never repeats (re-running must not wipe links made since).
  if exists (select 1 from pg_constraint where conname = 'profiles_student_id_digest_key') then
    -- The first version of student signup linked every registration sharing the student ID.
    -- Which one was actually proven isn't recorded, so clear them; students re-add a
    -- registration from their dashboard with its reference code (one step).
    update public.registrations set linked_profile_id = null where linked_profile_id is not null;

    -- The digest stays on the profile to keep IDs consistent, but is no longer unique:
    -- an impostor claiming an ID first must not lock out the real student.
    alter table public.profiles drop constraint profiles_student_id_digest_key;
  end if;
end $$;

create index if not exists profiles_student_id_digest_idx on public.profiles (student_id_digest);
create index if not exists registrations_linked_profile_idx on public.registrations (linked_profile_id);

-- ----------------------------------------------------------------------------
-- 20261019000005_student_profiles.sql
-- ----------------------------------------------------------------------------
-- AttendSure: student profiles independent of events.
-- Run after 20261019000004_student_registration_ownership.sql.
--
-- Students sign up once with their details; registering for an event then takes one tap.
-- Name and student ID are stored 3DES-encrypted (same envelope as registrations);
-- student_id_digest (added in 000003) is the keyed HMAC used for matching.

alter table public.profiles
  add column if not exists full_name_encrypted  text,
  add column if not exists student_id_encrypted text,
  add column if not exists section              text check (char_length(section) <= 40),
  add column if not exists year_level           text check (char_length(year_level) <= 20),
  add column if not exists department           text check (char_length(department) <= 120);

-- Student ID format: 10 digits, e.g. 2020001234.
alter table public.events alter column student_id_pattern set default '^[0-9]{10}$';
alter table public.events alter column student_id_hint set default 'e.g. 2020001234 (10 digits, no dash)';
update public.events
   set student_id_pattern = '^[0-9]{10}$',
       student_id_hint = 'e.g. 2020001234 (10 digits, no dash)'
 where student_id_pattern in ('^[0-9]{4}-[0-9]{5}$', '^[0-9]{4}-[0-9]{6}$', '^[0-9]{10}$');

-- Make the API pick up the new columns and functions immediately.
notify pgrst, 'reload schema';

commit;
