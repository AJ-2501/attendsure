-- Google sign-in sends the name as full_name / name (not display_name): use it for new students'
-- display name instead of falling back to the email's local part.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (auth_user_id, display_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    'student'
  )
  on conflict (auth_user_id) do nothing;
  return new;
end $$;
