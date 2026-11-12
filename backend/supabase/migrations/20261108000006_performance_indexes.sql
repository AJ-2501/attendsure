-- AttendSure: composite indexes for hot filtered + sorted reads (idempotent).

-- Landing page / student dashboard: published events ordered by start time.
create index if not exists events_status_starts_idx
  on public.events (status, starts_at);

-- Admin participant list and CSV export: one event's registrations by registration time.
create index if not exists registrations_event_registered_idx
  on public.registrations (event_id, registered_at desc);

-- Decrypt page "Recent decryptions" and other per-action audit lookups.
create index if not exists audit_action_created_idx
  on public.attendance_audit_logs (action, created_at desc);
