-- AttendSure: every event uses a 10-digit student ID and requires a school email.
-- The app enforces both regardless of stored values; this keeps the stored data consistent.
alter table public.events alter column student_id_pattern set default '^[0-9]{10}$';
alter table public.events alter column required_fields set default '{"department":true,"year_level":true,"email":true}'::jsonb;
update public.events
   set student_id_pattern = '^[0-9]{10}$',
       required_fields = coalesce(required_fields, '{}'::jsonb) || '{"email": true}'::jsonb
 where student_id_pattern is distinct from '^[0-9]{10}$'
    or coalesce((required_fields ->> 'email')::boolean, false) = false;
