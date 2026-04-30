# Calender

Calender is a personal calendar MVP with a synced web app, Supabase backend, and native iOS source for notifications plus Live Activities.

## What is implemented

- `apps/web`: Next.js PWA for sign in, event CRUD, simple repeats, and reminder offsets.
- `packages/shared`: shared TypeScript calendar/reminder logic with recurrence and Live Activity state helpers.
- `supabase`: database migration, row-level security policies, and an Edge Function for dispatching due reminders to APNs.
- `apps/ios`: SwiftUI app source, Supabase REST sync, local notifications, ActivityKit control, and WidgetKit Live Activity UI.

## First-time setup

Install dependencies:

```powershell
npm install
```

Create the web env file:

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
```

Then fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Start the web app:

```powershell
npm run dev:web
```

## Supabase setup

Install and log in to the Supabase CLI, then link your project:

```powershell
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

Set Edge Function secrets:

```powershell
supabase secrets set --env-file supabase\functions\dispatch-reminders\.env
```

Deploy the reminder dispatcher:

```powershell
supabase functions deploy dispatch-reminders
```

Schedule `dispatch-reminders` to run once per minute in Supabase Scheduled Functions. If you set `CRON_SECRET`, send it as a bearer token when invoking the function.

## iOS setup

Open [apps/ios/README.md](apps/ios/README.md) on a Mac and follow the Xcode target setup. The iOS side needs a real device, an Apple Developer account, Push Notifications, and Live Activities enabled.

## Useful commands

```powershell
npm run dev:web
npm run typecheck
npm run test
```

## Current v1 limits

- Events are standalone inside Calender; Apple Calendar and Google Calendar import are not included yet.
- Simple repeats are supported in the shared model and UI, but recurring reminder dispatch should be expanded before relying on long-term recurring schedules.
- Critical Alerts are not used because Apple requires a special entitlement.
