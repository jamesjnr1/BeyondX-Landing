# BeyondX — Deployment Guide (Vercel + Supabase + Resend)

This package contains your landing page plus two serverless functions that
make the forms actually work: "Get in touch" and the "Partner with us"
employer/worker registration.

## What's in here

```
public/index.html      → your landing page (static HTML, no build step needed)
api/contact.js         → handles the "Get in touch" form
api/register.js        → handles employer/worker registration
package.json            → dependencies (@supabase/supabase-js, resend)
vercel.json             → tells Vercel how to run the functions
supabase_schema.sql     → run this in Supabase before you deploy
```

## Step 1 — Create your Supabase project

1. Go to supabase.com and create a new project (or use an existing one).
2. Open **SQL Editor** → **New query**, paste the contents of
   `supabase_schema.sql`, and run it. This creates three tables:
   `contact_leads`, `employer_signups`, `worker_signups`.
3. Go to **Project Settings → API**. You'll need two values from here in
   Step 3: the **Project URL** and the **service_role** key (not the
   `anon` key — the service role key is required because it's the one
   allowed to bypass Row Level Security from the server).

## Step 2 — Create your Resend account

1. Go to resend.com and sign up.
2. Go to **API Keys** and create a new key. Copy it now — Resend only
   shows it once.
3. Go to **Domains** and add the domain you want to send from (e.g.
   `beyondx.org`, or whatever domain you control). Resend will give you
   DNS records (TXT/MX) to add wherever your domain is registered. Email
   won't send reliably until this is verified — sending from an
   unverified domain gets flagged as spam or blocked outright.
   - If you don't have a domain yet, Resend gives you a test sender
     (`onboarding@resend.dev`) that works immediately for testing, but
     you'll want your own verified domain before sharing this publicly.
4. Open `api/contact.js` and `api/register.js` and replace
   `notifications@yourdomain.com` with your real verified sending address.

## Step 3 — Deploy to Vercel

1. Push this folder to a GitHub repo (or drag-and-drop deploy via the
   Vercel dashboard).
2. In Vercel, **Add New Project** → import the repo.
3. Before deploying, add these **Environment Variables** (Project
   Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | from Supabase Project Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase Project Settings → API |
   | `RESEND_API_KEY` | from Resend → API Keys |
   | `NOTIFY_EMAIL` | `beyondx26@gmail.com` (optional — this is already the default) |

4. Deploy. Vercel will detect `api/contact.js` and `api/register.js`
   automatically and turn them into live endpoints at
   `https://yourproject.vercel.app/api/contact` and `/api/register`.

## Step 4 — Test it

Once deployed, fill out the "Get in touch" form on your live site with a
real email address you can check. You should see:
- A new row in Supabase's `contact_leads` table
- An email arriving at beyondx26@gmail.com (or whatever you set
  `NOTIFY_EMAIL` to)

Do the same for both the Employer and Worker tabs in the "Partner with
us" modal — check `employer_signups` and `worker_signups` in Supabase.

## Important security note before you go further

Right now, the worker registration form collects a 4-digit PIN and the
employer form collects a password, and both get stored as plain text in
Supabase. That's fine for an early prototype, but if real people are
going to log back in with these credentials later, plain-text storage is
a genuine risk — anyone with database access (including a future leak)
would see every password and PIN in the clear. Before this handles real
user accounts, you'll want to hash these (e.g. with bcrypt) in the API
function before the Supabase insert, rather than storing what the user
typed directly.

## Local testing note

Opening `public/index.html` directly in a browser (without deploying)
will show a "Could not reach the server" error if you submit a form —
that's expected, since there's no server running locally to talk to.
The forms only work once deployed on Vercel, where `/api/contact` and
`/api/register` actually exist.
