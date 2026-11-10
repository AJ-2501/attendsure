This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Google sign-in (students): allow every origin you run on

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
