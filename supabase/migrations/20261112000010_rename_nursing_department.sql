-- The College of Nursing is now the College of Nursing and Pharmacy. Fold the old name into
-- the new one so reports group them as a single department.
update public.registrations
   set department = 'College of Nursing and Pharmacy'
 where lower(btrim(department)) = 'college of nursing';

update public.profiles
   set department = 'College of Nursing and Pharmacy'
 where lower(btrim(department)) = 'college of nursing';
