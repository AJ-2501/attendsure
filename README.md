# AttendSure

Event registration and QR attendance for the UA College of Nursing and Pharmacy.
Students sign up with their UA Google account, register for events and get a QR pass;
staff scan passes at the door (time-in / time-out), manage events and export encrypted reports.

## Repository layout

```
attendsure/
├── frontend/   Next.js 16 app: pages, API routes (src/app/api), server logic (src/lib), tests
└── backend/    Supabase database: schema migrations, RLS policies, SQL functions, admin setup
```

The API runs inside the Next.js app (route handlers and server actions), so `frontend/` is the
only thing you deploy. `backend/` is the database the app talks to, see [backend/README.md](backend/README.md).

## Getting started

Requirements: Node.js 22, a Supabase project.

1. Set up the database: follow [backend/README.md](backend/README.md).
2. Configure the app:
   ```bash
   cd frontend
   cp .env.example .env.local   # then fill in the values (see comments in the file)
   npm ci
   ```
3. Run it:
   ```bash
   npm run dev        # http://localhost:3000
   ```

| Command (in `frontend/`) | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `node scripts/generate-favicons.mjs` | Regenerate icons from `assets/brand/` |

## Google sign-in (students): allow every origin you run on

Students sign in with Google through Supabase Auth. The app asks Supabase to return to
`<current origin>/auth/callback`, but Supabase only honours that if the URL is on its allow-list;
otherwise it silently falls back to the **Site URL** (e.g. the production site), so signing in
from `localhost` lands you on the deployed landing page.

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL**: the production URL, e.g. `https://attendsure.vercel.app`
- **Redirect URLs**: add the callback for each origin, ending in `**` so the callback's query
  string (`?from=…&next=…`) matches. Allow only the callback path, not the whole site:
  - `https://attendsure.vercel.app/auth/callback**` (production)
  - `http://localhost:3000/auth/callback**` (local development)
  - `https://*-<your-vercel-team>.vercel.app/auth/callback**` (optional: Vercel preview deployments)

No code or environment change is needed; changes apply immediately. In Google Cloud Console the
OAuth client's authorized redirect URI stays the single Supabase URL
(`https://<project-ref>.supabase.co/auth/v1/callback`).

## Deploying (Vercel)

In **Vercel → Project Settings → General**, set **Root Directory** to `frontend`, and add every
variable from `frontend/.env.example` under **Environment Variables**.

## Security notes

- Never commit `.env.local` or any real key. Only `frontend/.env.example` (names, no values) is tracked.
- Personal data (names, student IDs, emails) is stored encrypted; exports stay encrypted and can
  only be decrypted on `/admin/decrypt`, where every access is audited.
