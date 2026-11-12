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
