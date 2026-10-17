-- Development seed data. NEVER run on production.
-- Usage: psql <connection-string> -f supabase/seed.sql
--   or with Supabase CLI: supabase db reset (which runs migrations + seed)

-- Create a demo super-admin. Replace the UUID with the auth.users.id of your test user.
-- In Supabase: Dashboard → Authentication → Create User → copy the UUID.
-- The handle_new_user trigger already creates a 'student' profile;
-- this upsert promotes it to super_admin.
-- Uncomment and set your admin's email:
-- update public.profiles set role = 'super_admin', display_name = 'Dev Admin'
-- where auth_user_id = (select id from auth.users where email = 'admin@example.com');

-- Demo event
insert into public.events (
  id, name, description, venue, organizer, timezone,
  starts_at, ends_at,
  registration_opens_at, registration_closes_at,
  time_in_opens_at, time_in_closes_at,
  time_out_qr_ttl_seconds, capacity, status,
  student_id_pattern, student_id_hint,
  required_fields
) values (
  '3f1c2b4a-8d6e-4f7a-9b0c-1d2e3f4a5b6c',
  'IT Week 2027',
  'Annual IT Week celebration with competitions, seminars, and exhibits.',
  'College of Computer Studies, Main Building',
  'Student Council – CCS Chapter',
  'Asia/Manila',
  now() + interval '1 hour',
  now() + interval '9 hours',
  now() - interval '7 days',
  now() + interval '30 minutes',
  now() + interval '30 minutes',
  now() + interval '2 hours',
  900, 300, 'published',
  '^[0-9]{4}-[0-9]{5}$',
  'Format: 2024-12345',
  '{"department":true,"year_level":true,"email":false}'::jsonb
) on conflict (id) do nothing;
