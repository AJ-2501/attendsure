-- SmartAttend core schema. All timestamps are timestamptz (stored UTC).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: staff/student roles. Role is NEVER writable by the owning user.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  display_name  text,
  role          text not null default 'student'
                check (role in ('super_admin','event_admin','scanner_staff','student')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- events
-- status holds the *manual* lifecycle: draft | published | cancelled.
-- The effective status (upcoming/open/ongoing/completed) is derived from the
-- schedule by public.event_effective_status().
-- ---------------------------------------------------------------------------
create table public.events (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique default left(replace(gen_random_uuid()::text, '-', ''), 12),
  name                    text not null check (char_length(name) between 3 and 160),
  description             text not null default '' check (char_length(description) <= 4000),
  venue                   text not null check (char_length(venue) between 2 and 200),
  organizer               text not null default '' check (char_length(organizer) <= 160),
  timezone                text not null default 'Asia/Manila',
  starts_at               timestamptz not null,
  ends_at                 timestamptz not null,
  registration_opens_at   timestamptz not null,
  registration_closes_at  timestamptz not null,
  time_in_opens_at        timestamptz not null,
  time_in_closes_at       timestamptz not null,
  time_out_opens_at       timestamptz,          -- null => same as starts_at
  time_out_closes_at      timestamptz,          -- null => ends_at + 2h
  time_out_qr_ttl_seconds integer not null default 900
                          check (time_out_qr_ttl_seconds between 60 and 86400),
  capacity                integer not null check (capacity between 1 and 100000),
  allow_time_in           boolean not null default true,
  allow_time_out          boolean not null default true,
  require_time_out        boolean not null default true,  -- attendance requirement
  student_id_pattern      text not null default '^[0-9]{4}-[0-9]{5}$',
  student_id_hint         text not null default 'Format: 2024-12345',
  -- which optional registration fields are required: {"department":true,"year_level":true,"email":false}
  required_fields         jsonb not null default '{"department":true,"year_level":true,"email":false}'::jsonb,
  status                  text not null default 'draft'
                          check (status in ('draft','published','cancelled')),
  created_by              uuid references public.profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint events_time_order check (
    ends_at > starts_at
    and registration_closes_at > registration_opens_at
    and time_in_closes_at > time_in_opens_at
    and (time_out_closes_at is null or time_out_opens_at is null or time_out_closes_at > time_out_opens_at)
  )
);
create index events_starts_at_idx on public.events (starts_at);
create index events_status_idx on public.events (status);

-- ---------------------------------------------------------------------------
-- registrations: PII columns hold 3DES envelopes (see docs/ENCRYPTION.md).
-- section/year_level/department stay plaintext for analytics & filtering.
-- ---------------------------------------------------------------------------
create table public.registrations (
  id                         uuid primary key default gen_random_uuid(),
  event_id                   uuid not null references public.events(id) on delete restrict,
  reference_code             text not null unique,
  access_token_hash          text not null unique,      -- sha256 of participant link token
  participant_name_encrypted text not null,
  student_id_encrypted       text not null,
  email_encrypted            text,
  student_id_lookup_digest   text not null,             -- HMAC-SHA256(lookup key, normalized id)
  name_search_digest         text,                      -- reserved; name search done after decrypt
  section                    text not null check (char_length(section) between 1 and 40),
  year_level                 text check (char_length(year_level) <= 20),
  department                 text check (char_length(department) <= 120),
  linked_profile_id          uuid references public.profiles(id) on delete set null,
  registration_status        text not null default 'registered'
                             check (registration_status in ('registered','cancelled')),
  cancelled_reason           text,
  registered_at              timestamptz not null default now(),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint registrations_event_student_unique unique (event_id, student_id_lookup_digest)
);
create index registrations_event_idx on public.registrations (event_id, registration_status);
create index registrations_section_idx on public.registrations (event_id, section);

-- ---------------------------------------------------------------------------
-- qr_credentials: only SHA-256 of the random token is stored.
-- ---------------------------------------------------------------------------
create table public.qr_credentials (
  id               uuid primary key default gen_random_uuid(),
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  event_id         uuid not null references public.events(id) on delete cascade,
  action           text not null check (action in ('time_in','time_out')),
  token_hash       text not null unique,
  expires_at       timestamptz,
  used_at          timestamptz,
  used_by          uuid references public.profiles(id) on delete set null,
  revoked_at       timestamptz,
  revoked_reason   text,
  issued_by        uuid references public.profiles(id) on delete set null, -- null = system/self-service
  created_at       timestamptz not null default now()
);
-- at most one live (unused, unrevoked) credential per registration+action
create unique index qr_one_active_per_action
  on public.qr_credentials (registration_id, action)
  where used_at is null and revoked_at is null;
create index qr_registration_idx on public.qr_credentials (registration_id);

-- ---------------------------------------------------------------------------
-- attendance_records: exactly one per registration.
-- ---------------------------------------------------------------------------
create table public.attendance_records (
  id                    uuid primary key default gen_random_uuid(),
  registration_id       uuid not null unique references public.registrations(id) on delete cascade,
  event_id              uuid not null references public.events(id) on delete cascade,
  time_in_at            timestamptz,
  time_out_at           timestamptz,
  time_in_recorded_by   uuid references public.profiles(id) on delete set null,
  time_out_recorded_by  uuid references public.profiles(id) on delete set null,
  time_in_ref           text unique,
  time_out_ref          text unique,
  status                text not null default 'absent'
                        check (status in ('absent','checked_in','completed')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint attendance_sequence check (
    (time_out_at is null or time_in_at is not null)
    and (time_out_at is null or time_out_at >= time_in_at)
  )
);
create index attendance_event_status_idx on public.attendance_records (event_id, status);

-- ---------------------------------------------------------------------------
-- scan_attempts: every scan (accepted/rejected). No PII stored.
-- ---------------------------------------------------------------------------
create table public.scan_attempts (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid references public.events(id) on delete cascade,
  credential_id     uuid references public.qr_credentials(id) on delete set null,
  registration_id   uuid references public.registrations(id) on delete set null,
  credential_event_id uuid references public.events(id) on delete set null,
  actor_profile_id  uuid references public.profiles(id) on delete set null,
  action            text not null check (action in ('time_in','time_out')),
  method            text not null default 'qr' check (method in ('qr','manual')),
  result            text not null check (result in ('accepted','rejected')),
  result_code       text not null,
  confirmation_ref  text,
  recorded_at       timestamptz,
  idempotency_key   text unique,
  created_at        timestamptz not null default now()
);
create index scan_attempts_event_idx on public.scan_attempts (event_id, created_at desc);
create index scan_attempts_registration_idx on public.scan_attempts (registration_id);

-- ---------------------------------------------------------------------------
-- attendance_audit_logs: append-only.
-- ---------------------------------------------------------------------------
create table public.attendance_audit_logs (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid references public.events(id) on delete set null,
  registration_id  uuid references public.registrations(id) on delete set null,
  actor_user_id    uuid references public.profiles(id) on delete set null,
  action           text not null,
  reason           text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index audit_event_idx on public.attendance_audit_logs (event_id, created_at desc);
create index audit_registration_idx on public.attendance_audit_logs (registration_id);

create or replace function public.prevent_audit_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'audit logs are append-only';
end $$;
create trigger audit_no_update before update or delete on public.attendance_audit_logs
  for each row execute function public.prevent_audit_mutation();

-- ---------------------------------------------------------------------------
-- rate_limits (fixed window counters, service role only)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key, window_start)
);

-- updated_at triggers
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger t_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_events before update on public.events for each row execute function public.touch_updated_at();
create trigger t_regs before update on public.registrations for each row execute function public.touch_updated_at();
create trigger t_att before update on public.attendance_records for each row execute function public.touch_updated_at();

-- auto-create a 'student' profile for every new auth user (role cannot be chosen by the user)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (auth_user_id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 'student')
  on conflict (auth_user_id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
