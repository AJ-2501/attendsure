-- =============================================================================
-- AttendSure: create (or reset) the ONE admin account that signs in at /login.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query -> paste this file ->
-- change v_username / v_password below -> Run. Do NOT commit your real password.
--
-- Safe to run again: if the account exists, its password is reset to v_password.
-- The username maps to <username>@staff.attendsure.invalid (an internal address
-- that can never receive mail); the sign-in page does this mapping for you.
-- =============================================================================
do $$
declare
  v_username text := 'as_admin';      -- 3-32 chars: a-z, 0-9, . _ - (lowercase)
  v_password text := 'CHANGE-ME';     -- at least 12 characters
  v_email    text;
  v_uid      uuid;
begin
  v_username := lower(trim(v_username));
  if v_username !~ '^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$' then
    raise exception 'Invalid username "%": use 3-32 lowercase letters, numbers, dots, hyphens or underscores.', v_username;
  end if;
  if v_password = 'CHANGE-ME' or length(v_password) < 12 then
    raise exception 'Set v_password to a strong password (at least 12 characters) before running.';
  end if;
  v_email := v_username || '@staff.attendsure.invalid';

  select id into v_uid from auth.users where email = v_email;
  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      -- GoTrue reads these as strings: they must be '' rather than NULL.
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', 'Administrator'), now(), now(),
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  else
    update auth.users
       set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')), updated_at = now()
     where id = v_uid;
  end if;

  -- handle_new_user() created a 'student' profile; promote it.
  update public.profiles set role = 'super_admin', display_name = 'Administrator' where auth_user_id = v_uid;
  raise notice 'Admin account ready. Sign in at /login with username: %', v_username;
end $$;
