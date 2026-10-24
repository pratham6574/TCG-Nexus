# Kaisuki Cooldown Command Center — Shared Web App

## What it does
- Email/password accounts through Supabase Auth.
- Invite-only approval gate: newly signed-up users are unapproved until admin approval.
- Shared server/channel last-drop timestamps, synced live through Supabase Realtime.
- Personal 10-minute card-claim and 2-hour `/tcg drop` cooldowns per user.
- Mobile-friendly responsive interface.
- Cloud persistence in Supabase Postgres.

## Important limitations
- It does not connect to Kaisuki or execute commands there. Users manually record actual drops and their own cooldown starts.
- The `last drop + 61 minutes` marker is only an earliest possible window, not a prediction.
- This scaffold is not live-hosted until you configure a Supabase project and deploy the frontend.

## Setup (one-time, needs an online dashboard)
1. Create a Supabase project at https://supabase.com/.
2. In Supabase SQL Editor, run all of `supabase/schema.sql`.
3. In Supabase Authentication settings, configure email/password. For invite-only, disable public self-service signups if you prefer the strictest model; accounts can be created by admin/invitation flow, and approvals remain required in the `profiles` table.
4. Copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable/anon key only; never use service-role key in the frontend).
5. Install Node.js on a computer or use a browser-based development environment that supports Node/Vite. Run `npm install` and `npm run build`.
6. Deploy the built `dist/` folder to a static host such as Netlify, Vercel, or Cloudflare Pages. Add the same two VITE environment variables in host settings.
7. To approve a user, in Supabase SQL Editor run:
   `update public.profiles set approved = true where id = (select id from auth.users where email = 'person@example.com');`
   Use the exact email, and only approve trusted people.
8. To invite-only gate accounts, keep new profiles unapproved by default and only approve selected people. For stronger invite-only signup enforcement, use Supabase invite emails from the dashboard and disable open signup.

## Security notes
- Row Level Security is enabled for all app tables.
- Personal cooldown rows are scoped to the authenticated user.
- Shared server channels require an approved profile.
- `invites` table is reserved for administrative workflows and has no client-facing read policy.
- The browser must only receive Supabase publishable/anon key. Never put a service-role key in `.env` or frontend code.
