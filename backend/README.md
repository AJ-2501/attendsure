# AttendSure backend (Supabase database)

Everything the database needs: tables, row-level security, and the SQL functions the app calls
(registration, scanning, attendance corrections, reports). All write functions are
`SECURITY DEFINER` and executable only by the `service_role` key, which lives on the server.

```
supabase/
├── migrations/                    Schema history, applied in filename order
├── APPLY_ATTENDSURE_UPDATES.sql   Every migration after the first two, in one file
├── create_admin.sql               Create or reset the staff admin account
└── seed.sql                       Demo event for development (never run on production)
```

## New database

In Supabase Dashboard → SQL Editor, run each file in `supabase/migrations/` in filename order.

Or with the Supabase CLI, from this `backend/` folder (`supabase init` is needed once, since
this repo has no `config.toml`):

```bash
supabase init
supabase link --project-ref <project-ref>
supabase db push
```

## Existing database (catching up)

Paste `supabase/APPLY_ATTENDSURE_UPDATES.sql` into the SQL Editor and run it. It is safe to run
more than once and runs as one transaction.

## Admin account

Open `supabase/create_admin.sql`, set `v_username` and a strong `v_password` (12+ characters),
then run it in the SQL Editor. Don't save the file with your real password. The password is
stored as a bcrypt hash; staff sign in at `/login` with the username.

## Adding a migration

Add a new file to `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`, and append the
same SQL to `APPLY_ATTENDSURE_UPDATES.sql` so existing deployments can catch up.
