-- Mirror profiles.role into auth.users.raw_app_meta_data.role so the sign-in response (and its JWT)
-- already carries the role: the sign-in form can reject the wrong portal without a second
-- round trip to `profiles`. app_metadata is not user-writable. profiles.role stays the
-- source of truth for every authorization decision on the server.
create or replace function public.sync_role_to_app_metadata() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new.role)
   where id = new.auth_user_id
     and (raw_app_meta_data->>'role') is distinct from new.role;
  return new;
end $$;

revoke all on function public.sync_role_to_app_metadata() from public, anon, authenticated;

drop trigger if exists profiles_sync_role on public.profiles;
create trigger profiles_sync_role
  after insert or update of role on public.profiles
  for each row execute function public.sync_role_to_app_metadata();

-- Backfill existing accounts.
update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role)
  from public.profiles p
 where p.auth_user_id = u.id
   and (u.raw_app_meta_data->>'role') is distinct from p.role;
