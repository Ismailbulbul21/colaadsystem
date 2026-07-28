# Colaad Notary Management System

Internal office software for **Colaad Public Notary Office**, Taleh Road, Hodan District, Mogadishu.

Registration takes the client → Admin approves any discount → ALT prepares the legal
document in Microsoft Word and uploads it → Finance receives payment and issues the
receipt. Every step is logged, role-protected and permanent.

## Stack

Vite · React 18 · React Router · Tailwind CSS · TanStack Query · Supabase
(Auth, PostgreSQL, Storage, Row Level Security, Realtime, Edge Functions) · Vercel.

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev
```

> Restart the dev server after changing `tailwind.config.js` — Vite reads the
> theme once at startup, and a stale config serves a 500 on the stylesheet.

## Environment variables

Only two, and both are safe to expose. The publishable key can do nothing that
Row Level Security does not already allow.

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable key |
| `VITE_AUTH_EMAIL_DOMAIN` | Domain appended to a username to form the auth email |

**Never add the service-role key.** Vite inlines every `VITE_*` value into the
browser bundle. Privileged work (creating employees, resetting passwords,
deleting accounts) runs in the `admin-actions` Edge Function, which holds that
key as a Supabase secret and verifies the caller is an active Admin first.

## Security model

Permissions live in the **database**, not in React. Hiding a button is a
convenience; the barrier is Row Level Security, which does not care what the
browser does.

- Registration cannot read `payments` — RLS returns zero rows.
- Registration cannot set a discount amount; only Admin can, and the final price locks.
- Finance cannot change a service price.
- `UPDATE payments` raises an exception for **every** role, including Admin.
  Corrections are recorded separately so the audit trail is never rewritten.
- Receipts store a full snapshot, so a reprint years later is identical to the original.
- `activity_logs` is append-only — no update or delete policy exists for anyone.
- Reads require an *active employee*, not merely an authenticated session.

## Deploying to Vercel

Framework preset **Vite**, build `npm run build`, output `dist`. Add the three
environment variables above. `vercel.json` rewrites all routes to `index.html`
so deep links survive a refresh.

## Before going live

- [ ] Disable public sign-up: Supabase → Authentication → Sign In / Providers →
      turn off **Allow new users to sign up**
- [ ] Enable leaked-password protection: Authentication → Passwords
- [ ] Change the Administrator password from the one used during setup
