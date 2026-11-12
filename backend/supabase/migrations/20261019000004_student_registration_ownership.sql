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
