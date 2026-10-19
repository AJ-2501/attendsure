-- AttendSure: per-registration ownership for student accounts.
-- Run after 20261019000003_student_accounts_event_delete.sql.
--
-- An account sees only registrations it created, or proved with that registration's
-- own reference code (registrations.linked_profile_id). Matching on student ID alone
-- would let anyone who registers with another student's ID see and use their passes.

-- The student ID digest is kept on the profile to keep IDs consistent, but is no
-- longer unique: an impostor claiming an ID first must not lock out the real student.
alter table public.profiles drop constraint if exists profiles_student_id_digest_key;
create index if not exists profiles_student_id_digest_idx on public.profiles (student_id_digest);

create index if not exists registrations_linked_profile_idx on public.registrations (linked_profile_id);

-- The first version of student signup linked every registration sharing the student ID.
-- Which one was actually proven isn't recorded, so clear them all; students re-add a
-- registration from their dashboard with its reference code (one step).
update public.registrations set linked_profile_id = null where linked_profile_id is not null;
