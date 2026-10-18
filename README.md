# Remindly

Remindly is a cross-platform calendar and task manager with a polished web app, native iOS app with Live Activities, and a Supabase backend.

![Remindly web app](assets/calendar_screenshot.jpg)

## What's included

- **`apps/web`** — Next.js web app with month/week/agenda views, event and task creation, category colors, repeat rules, and reminder offsets.
- **`apps/ios`** — Native SwiftUI app with Supabase sync, local notifications, ActivityKit Live Activities, and a WidgetKit widget.
- **`supabase`** — Database migration, row-level security policies, and an Edge Function that dispatches due reminders to APNs.
- **`packages/shared`** — Shared TypeScript logic for recurrence, reminder offsets, and Live Activity state.

## First-time setup

Install dependencies:

```powershell
npm install
```

Create the web env file:

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
```

Fill in your Supabase project credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Start the web app:

```powershell
npm run dev:web
```

## Supabase setup

Apply the migrations in [supabase/migrations](supabase/migrations) in order. Either paste each file into the Supabase dashboard's **SQL Editor** and run it, or use the CLI:

```powershell
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

If you applied a migration through the SQL Editor and later switch to the CLI, mark it as applied first so it isn't run twice: `supabase migration repair --status applied <timestamp>`.

Set Edge Function secrets and deploy the reminder dispatcher:

```powershell
supabase secrets set --env-file supabase\functions\dispatch-reminders\.env
supabase functions deploy dispatch-reminders
```

Schedule `dispatch-reminders` to run once per minute in Supabase Scheduled Functions. If you set `CRON_SECRET`, pass it as a bearer token when invoking the function.

## Deploying the web app (Vercel)

1. Push the repo to GitHub, then on [vercel.com](https://vercel.com) choose **Add New → Project** and import it.
2. Set **Root Directory** to `apps/web`. Leave the framework (Next.js) and build/install commands on their defaults — Vercel installs the npm workspaces from the repo root.
3. Add **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same values as `apps/web/.env.local`; never the secret/service-role key). Optionally `NEXT_PUBLIC_AUTH_PROVIDERS`.
4. **Deploy.** If the keys are missing, the site says so instead of showing demo data.
5. **Custom domain:** Project → Settings → Domains → add e.g. `remindly.yourdomain.com`, then create the DNS record Vercel shows (usually a `CNAME` to `cname.vercel-dns.com`) at your domain registrar. HTTPS is automatic.
6. In Supabase → **Authentication → URL Configuration**, set **Site URL** to the production URL and add it (plus `http://localhost:3000`) under **Redirect URLs**, so confirmation and reset emails link to the right place.
7. Optional: set `REMINDLY_WEB_HOST` in `apps/ios/Config/Base.xcconfig` so the iOS app links to the web app.

Every push to `main` redeploys; other branches get preview URLs.

## iOS setup

See [apps/ios/README.md](apps/ios/README.md) for Xcode target configuration. The iOS app requires a real device, an Apple Developer account, and Push Notifications + Live Activities entitlements enabled.

## Useful commands

```powershell
npm run dev:web      # start web app at localhost:3000
npm run typecheck    # TypeScript check across all packages
npm run test         # run test suite
```

## Known limits

- No Apple Calendar / Google Calendar import yet.
- Recurring reminder dispatch works for simple rules; complex long-term recurrence should be validated before relying on it in production.
- Critical Alerts are not used (requires a special Apple entitlement).
