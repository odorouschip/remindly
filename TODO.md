# Remindly — Todo

Living document. Check things off as they're done; add new items freely. Loosely ordered by priority within each section.

Items marked *(release only)* aren't needed while Remindly is a personal tool. They're kept for a possible public launch.

## Next up

1. **Try the iOS app on a real phone** — see iOS app → Functionality still needed.
2. **Run the Google Tasks import on the real Takeout file** (built and tested against a sample; Google doesn't document the format).
3. **Import from Apple Calendar on iOS** (EventKit; covers iCloud, Google and work calendars added on the phone).
4. Web week view: overlapping events side by side (port `WeekLayout.swift`).
5. Drag to reschedule in the week views.

---

## Branding & assets

- [x] *(Italic "r" with a coral dot on paper, web and iOS.)* **New logo.** Current mark is a generic calendar glyph on a dark rounded square. It lives in one place — [components/ui/Logo.tsx](apps/web/components/ui/Logo.tsx) — plus the generated icons ([public/icon.svg](apps/web/public/icon.svg), `icon-192.png`, `icon-512.png`, [app/apple-icon.png](apps/web/app/apple-icon.png)).
- [x] *(Moot — the Import tab is gone until imports exist.)* **Real import provider logos.** Settings → Import currently shows letters "G", "O", "Y" and a blank circle for Apple (see `IMPORT_SOURCES` in [CalendarApp.tsx](apps/web/components/CalendarApp.tsx)). The real SVG icons already exist in [LoginScreen.tsx](apps/web/components/LoginScreen.tsx) (`GoogleIcon`, `AppleIcon`, `MicrosoftIcon`, `GitHubIcon`) — extract them and add a `YahooIcon`.
- [x] **Favicon** — missing entirely. `/favicon.ico` 404s on every page load (visible in the console at runtime); no file in [apps/web/public/](apps/web/public/).
- [x] **PWA manifest icons** — [apps/web/app/manifest.ts](apps/web/app/manifest.ts) only declares a single `/icon.svg` with `sizes: "any"`. iOS Home Screen and Android splash screens won't use SVG — need explicit 192×192 and 512×512 PNGs (and ideally an `apple-touch-icon` set).
- [x] **Manifest brand name mismatches the UI.** [manifest.ts](apps/web/app/manifest.ts) declares `name: "Calender"` and `short_name: "Calender"`, while the in-app brand is "Remindly". An installed PWA would show "Calender" on the home screen. Pick one and align everywhere (including page title in [layout.tsx](apps/web/app/layout.tsx) which is also "Calender").
- [x] **Manifest `theme_color` vs `<meta theme-color>` mismatch.** [manifest.ts](apps/web/app/manifest.ts) sets `theme_color: "#1f3d36"` (forest green — leftover from the dead globals.css palette), while [layout.tsx](apps/web/app/layout.tsx) sets `themeColor: "#f4f0e8"` (paper). Different surfaces (browser chrome vs installed PWA) will tint differently. Pick one or compute both from the active theme.
- [x] **iOS app icon** — needs to match the new logo.

---

## UI polish

### Medium
- [x] **`backdropFilter: blur(20px)` overuse.** Applied to sidebar, topbar, agenda panel, create panel — even on themes without a scene gradient (Ivory, Linen) where there's nothing behind to blur. Only apply when `theme.scene` is set.
- [x] **Type scale.** ~12 font sizes scattered (9, 10, 11, 12, 13, 13.5, 14, 15, 17, 18, 20, 22, 24) with no pattern. Define a small `fs` constant and standardize.
- [x] **Spacing scale.** Same problem with paddings — define an `sp` constant (4 / 6 / 8 / 12 / 16 / 20 / 24).
- [x] **`accent + "22"` hex-alpha tint shorthand.** Used ~20 places. Centralize into a `tint(color, level)` helper.
- [x] **Button consistency.** The topbar "New" button, create-panel "Cancel" / "Add Task" buttons, and settings modal "Done" button are three different inline-style approaches. Should share one `Button` component.

### Low
- [x] Mini-cal weekday letters at 9px are nearly illegible.
- [x] "Pick a view above" empty state (when all view toggles are off) could be friendlier.
- [ ] Right-side agenda panel auto-hides when create panel opens — feels jumpy; revisit.

---

## Bugs / dev warnings

- [x] **`%%META%%` JSON sentinel leaks into the description for some events.** Visible in the Upcoming side panel and the full Agenda view: events like "Independence Day", "Labor Day", "Columbus Day", "Veterans Day", "NYC Trip Day 2/3" all show their description as raw `%%META%%{"cat":"personal","isTask":false}` text. Root cause: `META_SENTINEL = "\n\n%%META%%"` in [CalendarApp.tsx](apps/web/components/CalendarApp.tsx) requires the leading `\n\n`, but these rows in the DB store the sentinel without the leading newlines. `unpackNotes` does `indexOf(META_SENTINEL)`, finds -1, returns the full raw `notes` value as `desc`. Fix options: (a) make `unpackNotes` match `%%META%%` with or without leading whitespace, (b) run a one-time SQL backfill to normalize stored notes, (c) both.
- [x] **React warning on theme switch: shorthand/longhand `background` conflict.** The `WebCalendar` root div at [CalendarApp.tsx:745](apps/web/components/CalendarApp.tsx#L745) sets `background: theme.bg` (shorthand) alongside `backgroundImage`, `backgroundSize: "cover"`, `backgroundAttachment: "fixed"` (longhand). When `theme.bg` changes on theme switch, the shorthand resets all background-related properties to their initial values and React's longhand reapply collides — Next.js dev warns this can cause styling bugs. Fix: replace `background: theme.bg` with `backgroundColor: theme.bg` so the shorthand doesn't collide. Logs two console errors per theme switch (one each for `backgroundAttachment` and `backgroundSize`). **Confirmed reproducing in the signed-in audit on 2026-05-29.**
- [x] **Stale service worker breaks dev assets after a code reload.** Observed during the audit: after editing source and reloading, the SW from a previous session intercepted `_next/static/css/app/layout.css`, `_next/static/chunks/webpack.js`, `main-app.js`, `app-pages-internals.js`, `app/layout.js`, `app/page.js`, `manifest.webmanifest`, and `favicon.ico` — all 8 returned `net::ERR_FAILED` because the SW's `fetch(...).catch(() => caches.match(...))` returns `undefined` for un-cached URLs, which rejects `respondWith`. The page wouldn't hydrate until I unregistered the SW manually. Either remove the SW until it has a real strategy (already in PWA section) or scope its fetch handler to non-`_next/*` paths so dev assets pass through.

---

## Functional gaps (currently mockup-y)

### Sidebar
- [x] **Sidebar "MY CALENDARS" / "OTHER CALENDARS" filter does nothing.** Toggling "US Holidays" / "Work" doesn't actually hide events. Either remove until real calendars exist, or implement filtering by an event's calendar_id.
- [x] **Only the 14×14 checkbox is clickable, not the row.** Clicking on "US Holidays" / "My Calendar" / "Work" / "Birthdays" label or anywhere else in the row does nothing — only the small checkbox itself toggles. Move the onClick to the outer row div so the whole strip is a click target.
- [x] **Categories dropdown** in sidebar duplicates Settings → Categories tab. Pick one.

### Settings modal
- [x] **Account tab** has placeholder inputs (`defaultValue=""`) that don't read or write anything. Wire to Supabase `user_metadata`.
- [ ] *(release only)* **Profile picture.** Account tab currently shows an "R" initials avatar. Replace with a real avatar upload (Supabase Storage bucket), fallback to initials. Show the avatar in the sidebar header too.
- [ ] *(release only)* **Make Settings feel like a real app, not a mockup.** Current Account tab is three lonely inputs. Add: change-password flow, connected providers list, sign-out button (currently in sidebar), notification preferences, default view / week-start (already collected at signup but never editable after), delete-account.
- [x] **Categories tab** is read-only ("managed inline on each event for now"). Either make it editable (add/rename/delete categories) or delete the tab.
- [x] **Import tab** buttons don't import. Build the OAuth flow + ICS upload, or hide the section.
- [ ] **Reorder categories on the web.** `sort_order` exists and iOS can reorder (Settings → Edit Categories); the web category editor can't yet.

### Calendar views
- [x] **Week view is fixed 7am–11pm.** Events outside that range silently disappear. Make it 24h, fit-to-events, or scrollable/zoomable.
- [ ] **No day view** — standard calendar pattern; missing.
- [ ] **Drag-and-drop to reschedule** events between days/times.
- [ ] **Drag-to-resize** events in week view.
- [x] *(All-day events can span days; timed events keep a multi-day end. Shown on each day they cover.)* **Multi-day events** — currently every event is bound to one date.
- [x] **Repeating events** — repeat rule is stored but the views don't expand recurrences into the grid; only the original instance shows.
- [x] **Month-view overflow days are dead.** The grid shows the last few days of the previous month and the first few of the next (grayed) for layout, but `onClick` and `onDoubleClick` both gate on `isCur` (`isCur && onSelect(ds)`) so clicking them does nothing. Expected behavior: clicking should navigate to that month and select the day.
- [x] *(Single click now shows that day in the side panel, which has a + button; double-click still creates.)* **Creating an event in the month view requires a double-click on an empty area** — undiscoverable. Single click currently just selects the day. Either show a hint, or have single-click on empty area open the create panel.
- [x] **Week-view empty time slots aren't clickable.** Clicking a 9am Tuesday slot should open a new-event panel with that date/time pre-filled; currently nothing happens.
- [x] **Week-view day-number headers aren't clickable.** Clicking "Mon 3" in the header should jump to the day view (when day view exists).
- [x] **Week-view events outside 7am–11pm render at negative top / below grid instead of being hidden or moved.** `topFrac = (sh - 7) + sm/60` in [CalendarApp.tsx](apps/web/components/CalendarApp.tsx) — a 6am event renders with `top: -51px` (above the visible grid), a 11pm event renders below. Caught in audit: a 6am event appears as a partial colored block at the top of the Thursday column with no label visible. Either clip these, scroll them into view, or stack them in an "earlier"/"later" overflow row.
- [ ] **Month-view "today" highlight is only on the day-number circle, not the whole column or cell.** Week view also only marks the day-number, not the column — most calendars tint the entire today column for stronger visual anchor. (The iOS week view tints it.)
- [ ] **Web week view stacks overlapping events on top of each other.** Port the cascade layout from [WeekLayout.swift](apps/ios/Remindly/Data/WeekLayout.swift).
- [x] **All three view toggles can be off simultaneously** → "Pick a view above" dead state. Month/Week aren't mutually exclusive (re-clicking the active one toggles it off); Agenda is overloaded (side panel when grid view is on, full view when no grid view). Reasonable redesign: Month / Week / Day / Agenda as a true mutually-exclusive radio set with Agenda always available as a separate toggle for the side panel.
- [x] **No way to view past events as a list.** Upcoming side panel filters `e.date >= todayLocalIso`; Agenda-only view does the same. A user who searches for "conference" and the matching events are in the past sees an empty Upcoming with no hint that the matches exist. Add a "show past" toggle on Agenda, or a separate Past view.

### Search
- [x] Filters silently — no result count, no "clear" button, no empty state when no matches.
- [x] No keyboard shortcut to focus the search input.

### Create panel
- [x] **Default tab is "Task", not "Event".** Clicking + New opens a Task form. Most calendar users want to create events, not tasks. Default should be Event (or remember the user's last choice).
- [x] "Custom…" reminder offset button selects a "custom" option but doesn't open any UI to actually pick the custom offset. Confirmed in audit.
- [x] **Repeat end date.** When a repeat option is selected (Daily / Weekly / Monthly / Yearly), show an "Ends on" date input so the recurrence isn't open-ended forever. The DB column `repeat_until` already exists in the events table; just unused in the UI.
- [x] **No "all-day event" option.** The UI offers Task (treated as all-day under the hood) or Event (timed); there's no way to create a real all-day Event like "Anniversary" or "Conference Day 1". The `is_all_day` column exists and is currently only set for tasks.
- [x] **All-day-like events render as "8:00 PM – 7:59 PM" instead of "All day".** Confirmed in audit: holiday rows (Independence Day, Labor Day, Columbus Day, Veterans Day) are stored ~00:00–23:59 UTC and the UI renders them in local TZ raw as "8:00 PM – 7:59 PM" with no awareness of `is_all_day`. The Upcoming panel, Agenda view, and event chip all need to check `is_all_day` (or detect ~24h span) and render "All day" instead of the literal timed range.
- [x] **No way to mark a task complete.** Tasks store the title with a `" ✓"` suffix on create ([CalendarApp.tsx](apps/web/components/CalendarApp.tsx) `handleSave` for the task tab) but there's no toggle / checkbox in the UI to flip the state later.
- [x] No location field on events.
- [ ] *(release only)* No attendees / invitees.
- [ ] No way to attach a file or note longer than a textarea.

---

## Database / backend

Current schema: [202610170001_schema_v2.sql](supabase/migrations/202610170001_schema_v2.sql) plus later migrations in [supabase/migrations](supabase/migrations) (the original `202604300001_init.sql` is superseded). RLS is per-user (`auth.uid() = user_id`).

### Schema additions (prerequisites for features above)
- [x] *(Folded into editable categories — one concept, toggled in the sidebar.)* **Calendars table.** Sidebar pretends "My Calendar", "Work", "Birthdays", "US Holidays" exist but nothing is stored. Add `public.calendars` (id, user_id, name, color, kind: personal/shared/holiday, is_visible). Add a `calendar_id` FK on `events`. Backfill existing rows into a default "My Calendar" per user. This is the prerequisite for the sidebar filter feature in Functional gaps.
- [x] **Categories as a real column (or table).** Today `cat` (work/personal/health/social) is packed into `notes` as `%%META%%` JSON — see `packNotes` / `unpackNotes` in [notes.ts](apps/web/lib/calendar/notes.ts). Move to a real `category` column on `events`. If categories should be user-customizable (per Themes section), promote to a `categories` table instead.
- [x] *(`kind`, `priority`, `completed_at`.)* **Priority + `is_task` as real columns.** Both also currently in the meta JSON. Move to real columns so they're queryable (e.g., "show me all high-priority tasks").
- [x] *(Created on signup with name + time zone; avatar etc. still to come.)* *(release only)* **Profiles table.** No place to store display name, avatar URL, theme preference, week_start, default_view. Two options: (a) shove into `auth.users.user_metadata` (simplest, JSON blob, no extra table); (b) create `public.profiles` mirrored from `auth.users` via a trigger (Supabase convention, queryable, RLS-friendly). Recommend **(b)** — needed anyway for avatar URL (Storage bucket) and to read another user's display name if sharing ever happens.
- [x] *(`source` + `external_id` columns, unique per user.)* **Import source tracking.** When calendar imports work, events need `source` (google/apple/outlook/ics/manual), `external_id` (for sync dedup), `last_synced_at`. Add columns to `events`, or a separate `event_external_links` table if one event can sync from multiple sources.

### Data integrity / schema cleanup
- [x] **"Yearly" recurrence is invisible to SQL.** `RECUR_TO_DB` in [supabaseBackend.ts](apps/web/lib/calendar/supabaseBackend.ts) maps `Yearly → "none"` and stashes the actual frequency in the meta JSON. Any query like `where repeat_frequency = 'yearly'` will find nothing. Either add `'yearly'` to the `repeat_frequency` CHECK constraint and store it, or remove the Yearly option until recurrence expansion handles it properly.
- [x] **`is_archived` column is dead.** Defined in [the init migration](supabase/migrations/202604300001_init.sql) but never read or written by the web app. Either build an archive flow (events that don't show but aren't deleted) or drop the column in a follow-up migration.
- [ ] **`devices.platform` enforces `'ios' | 'web'` but no web row ever gets created.** When/if web push is added, need a flow to register the browser as a device.

### US Holidays — pick an approach
- [ ] *(release only)* **Decision: Option A (shared) vs Option B (per-user copy).** Recommend **A**.

  **Option A — shared read-only holidays table.** Create a `public.holidays` row per holiday tied to a special `calendars` row with no `user_id`. Public-read RLS so any authenticated user can SELECT. Calendar UI fetches user events UNION holidays (or two queries merged client-side) when the "US Holidays" toggle is on.
  - Pros: single source of truth, update once per year, no per-user storage bloat, trivially extends to UK / Canada / religious calendars.
  - Cons: events query has to UNION or you need two reads.

  **Option B — seed each user's events with holidays on signup.** Use a `handle_new_user()` Postgres trigger to INSERT US Holidays for the next ~5 years into the user's events with a `source = "holiday"` flag.
  - Pros: zero schema work — they're just events.
  - Cons: ~50+ duplicate rows per user, painful to update if a holiday changes or you want to backfill new years, painful to add a new region retroactively.
- [ ] **If A wins:** build the `holidays` table + seed script for US 2026–2030, wire the UI to merge them in when toggled.
- [ ] **If B wins:** build the on-signup `handle_new_user()` trigger and an admin script to refresh holiday rows each year.

### Recurrence storage
- [x] **Edit or skip one occurrence** (web + iOS). "This event / All events" on save, "This event / This and following / All events" on delete.
- [ ] **"This and following" for edits** (split the series in two) — only delete has it so far.
- [ ] An occurrence can't drop the series' category (a null override means "same as the series").
- [x] **Decide expansion strategy.** Today `events` stores `repeat_frequency` + `repeat_until` but the views never expand the rule into instances — only the original date renders (tracked in Functional gaps → Calendar views). Three approaches: (a) expand client-side on read from the single stored row, (b) generate occurrence rows in a database view, (c) materialize the next N occurrences into a separate table via a job. **(a) is the simplest start** — defer (c) until performance forces it.
- [x] *(Table exists and reminders honor it; the web UI to skip/move one occurrence is still to build.)* **Exceptions table.** Once recurrence is expanded, users will want to move or delete a single instance of a repeating event. Add `recurrence_exceptions` (event_id, occurrence_date, action: cancelled / modified, override_event_id).

### Search
- [ ] *(release only)* **Server-side search** (deferred). Today search is `events.filter()` over the locally loaded list — fine for small datasets, breaks once a user has 1000+ events. Add a `tsvector` index on `title || notes` and an RPC. Not urgent.

### Maintenance
- [ ] *(release only)* **Soft-delete purge job.** `deleted_at` is set but never cleaned. Add a scheduled function to permanently delete rows where `deleted_at < now() - interval '30 days'`.
- [x] **Migration discipline.** Right now everything lives in `202604300001_init.sql`. Future schema changes should land as new timestamped migrations — never edit a shipped one.
- [ ] **Backups.** Verify the Supabase project has point-in-time recovery turned on (requires Pro plan); document the restore procedure.

### Edge function (dispatch-reminders)
- [x] **Repeating events only get server reminders for their first occurrence.** The web app now expands repeats in every view, but reminder rows (`due_at`) are written once per event from `starts_at`, so APNs/Live Activity reminders fire for the first instance only. The dispatcher needs to compute the next occurrence (e.g. reuse `expandOccurrences` from `@calender/shared`) or a job needs to roll reminders forward.
- [x] **`delivered_at` is set even when every APNs send fails.** [dispatch-reminders/index.ts](supabase/functions/dispatch-reminders/index.ts) (~line 96) updates `delivered_at = now()` unconditionally after the device loop, regardless of `sendResults`. If APNs is unreachable, every token is stale, or there are zero devices for the user, the reminder is silently marked delivered and lost. Fix: only mark delivered if at least one send returned `ok: true` (or branch into a retry/backoff path).
- [x] *(release only)* **APNs JWT is regenerated for every reminder.** `createApnsJwt()` is called inside `dispatchReminder` (per-reminder), but JWTs are valid ~50 minutes and re-use is encouraged by Apple. Move JWT creation to the top of the cron invocation and reuse across all reminders in the batch.
- [ ] *(release only)* **Only `platform = 'ios'` devices are queried** (`.eq("platform", "ios")` in `dispatchReminder`). If web push or another platform is ever added, those device rows will silently never receive reminders.
- [x] **`live_activity_runs` has no dedup.** Each successful Live Activity start `INSERT`s a row; if the same event has multiple reminders that all fire near each other (e.g., 1-day, 30-min, at-time), multiple runs are created. Add a unique constraint on `(event_id, device_id, phase)` or check before insert.
- [x] **APNs token rotation.** `devices.apns_device_token` + `activity_push_to_start_token` are stored but there's no flow for invalidating stale tokens when APNs returns `Unregistered` / `BadDeviceToken`.
- [x] **Idempotency.** If the 1-minute cron double-fires (or misses then re-runs), make sure the same reminder isn't dispatched twice. The `delivered_at` column is the natural latch — verify the function actually checks + sets it atomically.

---

## Auth screens

- [x] **Terms / Privacy links** are `#` placeholders ([LoginScreen.tsx](apps/web/components/LoginScreen.tsx) footer + Signup step 1).
- [ ] *(release only)* **OAuth buttons** call `signInWithOAuth` but Google/Apple/Microsoft/GitHub providers need to actually be configured in Supabase.
- [x] **OAuth failure strands the user on a Supabase JSON error page.** Confirmed in audit: clicking "Continue with Google" with the provider not enabled redirects the browser to `https://<project>.supabase.co/auth/v1/authorize?...` which responds with raw JSON `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`. The user is now on Supabase's domain with no way back. Fix: pass `options: { skipBrowserRedirect: true }` to `signInWithOAuth`, then `window.location.assign(data.url)` only after a sanity check, OR (simpler) hide buttons whose provider isn't enabled.
- [x] **OAuth button labels wrap into 3 lines on narrow screens.** At ≤375px width the 2-column grid + "Continue with Google" label wraps as `Continue / with / Google`. Either collapse to single-column on narrow widths or shorten labels to "Google" / "Apple" / etc. at small breakpoints.
- [x] **Brand panel design differs across the three auth screens.** Login = decorative circles + calendar preview card. Signup = circles + feature pills + tagline. Forgot Password = lock icon card + circles + tagline. Three different visual identities for the same product. Pick one brand-panel layout and reuse it.
- [x] **Signup → preferences step** stores `defaultView`, `weekStart`, etc. in localStorage but the calendar app doesn't read them back yet.
- [ ] *(release only)* **Forgot password** OTP flow works but the email Supabase sends is the default template — customize it.

---

## Themes

Light, Dark and System today (tokens in [globals.css](apps/web/app/globals.css)). The 7 colorful themes were dropped in the Notion-style redesign; they could come back as options later.

- [ ] **More themes.** Bring back some colorful options, or add a high-contrast / accessibility theme.
- [x] **System theme preference.** Match the OS light/dark setting on first visit.
- [x] **Per-category color customization.** The 4 category colors are `--cat-*` tokens in [globals.css](apps/web/app/globals.css). Let users pick their own.
- [ ] **Custom accent color** independent of theme (Notion-style).

---

## Bigger picture

### Smart command bar / natural-language input
- [x] Add a global command bar (Cmd/Ctrl-K) that does more than search — Notion Calendar / Cron / Fantastical style. Should: search events, jump to dates ("next monday"), create events from natural language ("Lunch with Sam tomorrow at noon"), and run app commands ("switch to week view", "new task").
- [ ] **Next: AI fallback.** The local parser ([quickAdd.ts](apps/web/lib/calendar/quickAdd.ts)) handles dates, times, ranges, durations, repeats, #category and task prefixes. Phrases it can't place ("the friday after thanksgiving", "every other week") should go to a model through a server route — needs the self-hosted server or a Supabase Edge Function for the API key.
- [x] If natural-language event creation uses an LLM, it should round-trip locally for the simple cases (dates, times, durations) and only call the model for ambiguous input — avoids latency and cost on every keystroke.

### iOS Live Activities (the headline feature)
- [x] *(Ink/paper/coral from the new icon; serif title; flips to "Now" with a progress ring at the start time.)* Live Activity styling should match the (eventual) new web brand.
- [ ] Confirm the Live Activity surfaces the next event with a glanceable countdown — this is the whole reason for building Remindly vs. using stock Calendar. *(Part of the real-phone check below.)*
- [ ] *(Needs a paid developer account.)* Test push-to-start Live Activities on iOS 17.2+ so events can launch a Live Activity from the server when due.

### Cross-platform sync
- [ ] Conflict resolution when web and iOS edit the same event while one is offline.
- [x] *(Settings → Import → Google Tasks, from a Takeout `Tasks.json`.)* **Import from Google Tasks** — bring existing Google Tasks over as Remindly tasks (title, notes, due date, done state), so Google Tasks can be retired.
- [ ] **Import from Apple Calendar on iOS** (EventKit, read-only copies tagged with `source` / `external_id`). Covers whatever calendars are on the phone, including Google and work accounts.
- [ ] Google Calendar / Outlook one-way mirror on the web (only needed if the Apple Calendar import isn't enough).
- [ ] *(release only)* Share-calendar-with-another-user (longer term).

### PWA story
- [x] *(Removed for now; revisit if offline support is ever wanted.)* **Service worker has no real strategy.** [apps/web/public/sw.js](apps/web/public/sw.js) pre-caches `/` and `/icon.svg`, then does network-first with cache fallback. But `/` is a Server Component HTML that depends on auth state, so cached HTML is mostly useless. No JS/CSS/asset caching, no offline event store. Either commit to a real offline-first design (cache the app shell properly, queue mutations while offline, sync on reconnect) or take the SW out until the design is ready — right now it's vaporware that adds confusion.
- [ ] **App shell route.** If the SW is going to work, the calendar app needs a stable shell route that doesn't depend on session — `/app` or similar, with auth checked client-side after hydration.

### Quality bar before public
- [ ] *(release only)* Marketing site.
- [ ] *(release only)* Real Privacy Policy + Terms of Service.
- [ ] *(release only)* Onboarding tour for first sign-in.
- [ ] Empty states for every major surface (no events, no upcoming, no search matches, etc.).
- [ ] Error states for network/Supabase failures (currently just the small `status` string at the bottom of auth).

---

## iOS app

Native SwiftUI (tab bar, native forms and sheets, system light/dark colors), with the brand colors on the Live Activity and icon. Live Activity items live above under "Bigger picture → iOS Live Activities".

### UI redesign
- [x] *(Native, with the brand on the icon, Live Activity and widgets.)* **Decide the iOS visual direction.** Should it mirror the web (sidebar + theming + 7 themes) or lean into native iOS patterns (NavigationStack, tab bar, native sheets, system colors)? Probably native — but the web brand needs to be visible.
- [x] *(Replaced rather than audited.)* **Audit current screens** — [RootView.swift](apps/ios/Calender/RootView.swift), [EventsView.swift](apps/ios/Calender/EventsView.swift), [EventEditorView.swift](apps/ios/Calender/EventEditorView.swift) — list everything that needs to change. (Quick pass before redesign begins.)
- [x] *(Native Upcoming list for now: overdue tasks, days ahead, checkboxes, pull to refresh. Month/week views still to come.)* **Rebuild events list / agenda view** with the new design language.
- [x] **Rebuild event editor** (currently `EventEditorView.swift`) — should feel like a native iOS form, not a port of the web create panel.
- [x] *(Month grid with category dots + selected day's list; Week timeline with a Month / Week switch.)* **Add month / week views** on iPad / larger phones.
- [ ] **Pinch to zoom the iOS week timeline**, and drag to move / resize events there.
- [x] *(Moot: the app uses system colors, which follow light/dark; brand and category colors are in [Style.swift](apps/ios/Remindly/Views/Style.swift) and [CategoryPalette.swift](apps/ios/Shared/CategoryPalette.swift).)* **App-wide theming layer** — match the web's light/dark tokens.

### Functionality still needed
- [x] **Background refresh.** `BGAppRefreshTask` every ≥3h (iOS decides); needs an on-device check since the simulator can't run it — see apps/ios/README.md.
- [x] **Edit categories on iOS** — Settings → Edit Categories: rename, recolor, add, reorder, delete.
- [ ] **Forgot password on iOS** (sign-in is email + password; reset points to the web for now).
- [ ] *(release only)* **Sign in with Apple** — should be the primary sign-in on iOS per App Store guidelines.
- [ ] **Offline editing + sync conflict handling.**
- [x] *(Local notifications are the main path until there's a paid developer account.)* **Push notifications fallback** when Live Activities aren't supported (older iOS, iPad without Dynamic Island, etc.).
- [ ] **iCloud / device-local backup** of preferences (theme choice, default view, etc.).
- [x] **Calendar widgets** (Home Screen + Lock Screen) beyond the Live Activity.
- [ ] **Try it on a real phone.** Everything so far has only run in the simulator. Check: reminders arrive with the app closed, background refresh picks up web changes, Home / Lock Screen widgets (App Group on the free team, Lock Screen tinting), the Live Activity countdown in the Dynamic Island and on the Lock Screen, and a full week of daily use.
- [ ] Tap-to-complete checkbox for tasks in the widgets (needs an App Intent that can write to Supabase).
- [ ] **Share extension** so events can be created from other apps (e.g., from a Safari page).

### Polish / quality
- [x] *(Temporary italic "r" mark; dark and date-number variants planned for when Remindly replaces the stock Calendar.)* **App icon** — needs to match the new logo.
- [ ] **Launch screen** — currently default.
- [ ] *(release only)* **Onboarding** — first-launch flow asking for notification permission, Live Activity opt-in, calendar imports.
- [ ] *(release only)* **Dynamic Type** support across all screens.
- [ ] *(release only)* **VoiceOver** labels for all interactive elements.

---

## Recently done

### Repeating tasks, TODO cleanup — 2026-10-18
- [x] Tasks can repeat (web + iOS editors and quick add, e.g. "task: water plants every sunday"). Like Google Tasks, a repeating task shows once, at its current due date; checking it off moves it to the next repeat after today, and it's only done once the repeat ends. Reminders follow the due date with no database change (checked against a local Postgres).
- [x] **Google Tasks import** (web, Settings → Import): reads the `Tasks.json` from a Google Takeout export ([googleTasks.ts](apps/web/lib/calendar/googleTasks.ts)), previews it, maps each list to a category (same-named one picked automatically), sets one reminder choice, and optionally includes completed tasks. Undated tasks are due on the import day; subtasks come over as tasks with a note. Tagged `source = 'google_tasks'` + the Google id, so importing again skips what's already there. Repeats aren't in Google's export — set them in the editor afterwards.
- [x] TODO.md brought up to date (done items checked off, stale paths fixed, "Next up" list).

### One occurrence of a repeating event — 2026-10-18
- [x] Opening an occurrence of a repeating event (web and iOS) now shows that occurrence, not the first one. Saving asks **This event / All events** (repeat, all-day and kind changes always apply to all); deleting offers **This event / This and following / All events**. "This event" writes an `event_exceptions` row, so it stays part of the series and the reminder scheduler already honors it; "All events" moves the whole series by the same number of days.
- [x] Exceptions applied when expanding repeats on web ([recurrence.ts](apps/web/lib/calendar/recurrence.ts)) and iOS ([Recurrence.swift](apps/ios/Remindly/Data/Recurrence.swift)), including occurrences moved in from outside the visible range. Edit logic in [occurrenceEdits.ts](apps/web/lib/calendar/occurrenceEdits.ts) ↔ [OccurrenceEdits.swift](apps/ios/Remindly/Data/OccurrenceEdits.swift).
- [x] New migration [202610180001_exception_location_category.sql](supabase/migrations/202610180001_exception_location_category.sql): exceptions can also override location and category (category must be the user's own). Checked against a local Postgres: scheduling around skipped/moved occurrences, upserts, RLS, category deletion.

### iOS widgets — 2026-10-18
- [x] **Up Next** (small, Lock Screen rectangular + inline): the event on now or next, then the one after. **Today** (medium, large): what's left today with overdue tasks first, then the coming days; rows open their event. Fed by a two-week snapshot the app writes to the App Group after each sync/change ([WidgetSnapshot.swift](apps/ios/Shared/WidgetSnapshot.swift), [WidgetSync.swift](apps/ios/Remindly/Data/WidgetSync.swift)); widgets reload only when it changes and roll forward at each event start/end and midnight.
- [x] `Day` and the category palette moved to `apps/ios/Shared` — one palette for the app, Live Activity and widgets.

### Week view on iPhone — 2026-10-18
- [x] Calendar tab has a Month / Week switch (remembered). Week ([WeekView.swift](apps/ios/Remindly/Views/WeekView.swift), layout in [WeekLayout.swift](apps/ios/Remindly/Data/WeekLayout.swift)): day headers, all-day bars spanning the days they cover (folds to "+N" past three rows), a 24-hour timeline with a now line, overnight events split at midnight like the web, overlapping events cascaded like Calendar's. Tap an empty slot to add an event at that half hour; swipe to change weeks; tap / press and hold events as in the lists.

### Quick add on iPhone, web logo — 2026-10-18
- [x] iOS quick add / search sheet (✨🔍 button on both tabs): natural-language create, "Add details first…", jump to a date, find events. Parser ported to Swift ([QuickAdd.swift](apps/ios/Remindly/Data/QuickAdd.swift)) and checked against the web's test phrases.
- [x] Fixed "the 2nd" (on the 15th) jumping to next year instead of next month — in both parsers.
- [x] iOS category editing.
- [x] Web logo, favicon, Apple touch icon and PWA icons switched to the italic "r" mark.

### iOS redesign, part 1 — 2026-10-18
- [x] New app icon (light italic "r" with coral dot) and matching sign-in logo.
- [x] Calendar tab: month grid with category dots, swipe/arrows between months, Today button, selected day's schedule below. Upcoming moved to its own tab.
- [x] Swipe a task to complete it, swipe to delete (repeating events confirm first), press-and-hold menu with Edit / Done / Delete.
- [x] Live Activity redesign: ink background, category bar, serif title, coral countdown, "r" mark in the Dynamic Island; turns to "Now" at the start time without an app update, and finished ones are cleared when the app opens.

### Background refresh, battery pass, hosting prep — 2026-10-18
- [x] iOS background refresh ([BackgroundRefresh.swift](apps/ios/Remindly/Data/BackgroundRefresh.swift)): syncs and reschedules reminders while the app is closed.
- [x] Battery/efficiency: foreground re-sync skipped if synced <2 min ago; notifications diffed instead of all removed and re-added; agenda built once per change (and on day rollover) instead of every redraw.
- [x] Web: production builds without Supabase keys show a setup error instead of demo data; service worker removed (it cached nothing useful and risked stale deploys); basic security headers. Vercel + custom-domain steps in the README.
- [x] iOS links to the web app for password reset / category editing once `REMINDLY_WEB_HOST` is set.

### iOS data layer + native shell — 2026-10-17
- [x] Generated [Remindly.xcodeproj](apps/ios/Remindly.xcodeproj) (app + Live Activity widget, folders auto-synced); renamed everything from Calender to Remindly, incl. the `remindly://` scheme. Supabase keys come from `apps/web/.env.local` via [sync-secrets.sh](apps/ios/scripts/sync-secrets.sh).
- [x] New data layer in [apps/ios/Remindly/Data](apps/ios/Remindly/Data): Keychain-backed login with automatic token refresh, models for schema v2, repeat expansion ported from the web, local notifications for the next 60 reminders (rescheduled on every sync), Live Activities started from the editor.
- [x] Native shell: sign in / sign up, Upcoming list, form-based editor, settings. Debug builds accept `-demo` (sample data) and `-open-event <id>`.
- [x] Done tasks keep their reminder rows on web and iOS, so un-checking restores the reminder.
- [x] Multi-day timed events no longer look like a daily repeat: first day shows the start, middle days "All day", last day "Until …" (web + iOS). Web week view puts ≥24h events in the all-day row and splits shorter overnight ones at midnight; the web editor has an end date for timed events. iOS loads the agenda before asking for notification permission.

### Schema v2 + editable categories — 2026-10-17
- [x] New migration [202610170001_schema_v2.sql](supabase/migrations/202610170001_schema_v2.sql) replaces the original tables: `profiles`, `categories`, `events` (events + tasks, real columns, date-based all-day, repeat interval), `event_exceptions`, `reminders` (rules with a DB-maintained `next_due_at`), `reminder_deliveries`, `devices` (one row per device), `live_activity_runs`. The JSON-in-notes metadata is gone.
- [x] Reminder scheduling lives in Postgres (`next_reminder()`, triggers, `claim_due_reminders()`), so repeats remind every time, nothing double-sends, failures retry. Verified against a local Postgres with 24 behavior checks (signup defaults, DST-safe repeats, exceptions, RLS isolation, claiming/retries).
- [x] Categories are editable in Settings (rename, 9-color palette, add, delete → events become uncategorized); `#tags` in quick add match them by name.
- [x] Repeat interval in the editor and quick add ("every other week", "every 3 days", "biweekly"); location field; multi-day all-day events.
- [x] Dispatcher rewritten on top of the new tables: one JWT per run, deliveries marked sent only when Apple accepts them, dead tokens disabled, Live Activity runs upserted per occurrence.
- [x] **iOS models are now out of date** with the schema — they get rebuilt in the iOS pass.

### Command bar — 2026-10-15
- [x] ⌘K / Ctrl+K (or "Quick add" in the sidebar) opens a command bar: create events/tasks from a phrase, jump to a date, find events (past ones too), switch views/theme, open settings.
- [x] Local natural-language parser with tests ([quickAdd.ts](apps/web/lib/calendar/quickAdd.ts), [test/quickAdd.test.ts](apps/web/test/quickAdd.test.ts)): "lunch with Sam fri at noon", "gym every monday 6-7pm #health", "task: pay rent nov 1", "dinner 10/20 at 7", "trip in 2 weeks".
- [x] Creating from the bar saves immediately, jumps to the day and shows a confirmation; "Add details first…" opens it in the editor instead.

### Day panel, tasks, icons — 2026-10-15
- [x] Clicking a day shows its schedule in the right-side panel (replaces "Upcoming"), with "Coming up" for the next two weeks and a + to add an event that day ([DayPanel.tsx](apps/web/components/calendar/DayPanel.tsx)).
- [x] Clicking an empty week-view slot opens a new event at that half hour.
- [x] Tasks have a completion checkbox (stored as `done` in the meta blob; done tasks get no reminders).
- [x] Agenda has "Show earlier"; searching lists past matches too, and "Show as list" jumps from month/week to them.
- [x] New icon set (SVG favicon, Apple touch icon, 192/512 PNGs); manifest renamed to Remindly with matching colors.
- [x] Tagged items only needed for a public release.

### Bug fixes + auth screens — 2026-10-14
- [x] `%%META%%` no longer leaks into descriptions: [notes.ts](apps/web/lib/calendar/notes.ts) matches the sentinel with or without the leading blank lines (iOS writes it bare) and never shows a corrupt blob.
- [x] All-day events: real "All day" switch on events; rows flagged `is_all_day` or spanning a full day render as "All day" on the right date (UTC-midnight imports no longer slide to the previous evening). All-day events get no midnight countdown reminders.
- [x] Repeating events expand in month, week, agenda and Upcoming ([recurrence.ts](apps/web/lib/calendar/recurrence.ts)); monthly/yearly skip months without that day. Opening an occurrence edits the series. New "Ends" field writes `repeat_until`.
- [x] "Custom…" task reminder opens an amount + unit picker (stored as `remindMin` in the meta blob; iOS ignores it safely).
- [x] Event editor blocks end-before-start (the DB check constraint used to reject it with a raw error) and moving the start keeps the duration.
- [x] Unit tests for notes parsing, recurrence and row mapping ([apps/web/test](apps/web/test)); `npm test` runs them.
- [x] Auth screens rebuilt Notion-style in [components/auth/](apps/web/components/auth): one centered column, light/dark, shared logo. Removed things that never worked: "Remember me", `#` Terms/Privacy links, signup preferences + import step, password strength meter.
- [x] OAuth buttons only show for providers listed in `NEXT_PUBLIC_AUTH_PROVIDERS` (see [.env.example](apps/web/.env.example)), so nobody lands on Supabase's JSON error page.
- [x] Password reset: verifying the code no longer drops you into the calendar before you've set the new password.
- [x] Network failures show "Couldn't reach the server…" instead of "Failed to fetch".

### Notion-style redesign + refactor — 2026-10-14
- [x] Split the 1,541-line `CalendarApp.tsx` into [components/calendar/](apps/web/components/calendar/) (one file + CSS module per piece) and shared [components/ui/controls.tsx](apps/web/components/ui/controls.tsx) (`Button`, `IconButton`, `Segmented`). All hover states are CSS now, not JS handlers.
- [x] Design tokens (colors, type scale, spacing, radii) live in [globals.css](apps/web/app/globals.css) as CSS variables. Category tints use `color-mix()`.
- [x] Dropped the 7 themes for **Light / Dark / System** (Settings → Appearance). No flash on load — an inline script in [layout.tsx](apps/web/app/layout.tsx) applies the saved choice before paint. Inter replaces DM Sans in the app (auth screens still use DM Sans).
- [x] Storage goes through one interface — [lib/calendar/backend.ts](apps/web/lib/calendar/backend.ts) — with a Supabase implementation and an in-memory **demo backend**. With no Supabase keys (or `NEXT_PUBLIC_DEMO_MODE=true`) the app runs on sample data dated around today. A self-hosted API later = one more backend.
- [x] Month view: neutral text + category dot instead of colored text on tinted chips; red "today" marker; times drop out cleanly when a cell is too narrow.
- [x] Week view: full 24h, opens scrolled to 7 AM, tasks in an "All day" row, current-time line, prev/next moves by week.
- [x] View switch is a real Month / Week / Agenda radio; the Upcoming panel has its own toggle.
- [x] Sidebar: fake "My calendars / Other calendars" removed; Categories is now a working filter. Account row at the bottom.
- [x] Settings trimmed to what works (Appearance, Account info). Import and Categories tabs removed until they're real.
- [x] Event panel: Notion-style property rows, Escape closes, Enter saves.
- [x] Page title is "Remindly"; service worker only registers in production builds.

### High-impact UI polish pass — 2026-05-28
- [x] **Themed focus rings** on inputs/selects/textareas. Added a `--accent` CSS variable that updates with the active theme; global `:focus-visible` rule uses `color-mix` to draw a tinted ring without touching the inline border styles.
- [x] **Mini-cal day cells** are now responsive (`width:100%` + `aspectRatio:"1/1"`) — ~26 px in the current sidebar, above WCAG AA. Added hover background, bumped weekday letters from 9 → 10 px (were nearly illegible), increased grid gap from 1 → 2 px.
- [x] **Mini-cal nav arrows** now use the shared `IconButton` (hover bg + color shift).
- [x] **Topbar nav cluster** (Prev / Today / Next) refactored to a new `OutlinedButton` helper with hover background + color shift.
- [x] **View toggle buttons** (Month / Week / Agenda) — inactive ones now nudge color toward `textSoft` on hover.
- [x] **Month-view event chips** hover increases the colored background alpha (15% → 28%) with a 120ms transition.
- [x] **Week-view event blocks** hover darkens the bg ~14% and grows the colored shadow.
- [x] **Sign-out button** now uses `OutlinedButton` (hover bg).
- [x] **Create panel Cancel** uses `OutlinedButton`; **Delete** button gets a hover that intensifies the red bg + border.
- [x] Note: sidebar calendar rows and right-side agenda list items already had hover before this pass, so they're untouched. The TODO line saying otherwise was inaccurate.

### Earlier UI polish pass — 2026-05-28
- [x] Swapped raw `‹ › ×` chars for lucide icons across topbar, mini cal, settings modal, create panel.
- [x] Replaced inline custom SVGs in sidebar (cog / search / two section chevrons) with lucide icons — consistent stroke weight.
- [x] Added `IconButton` wrapper with real hover state — sidebar cog no longer feels dead.
- [x] Removed hardcoded `#F0A896` blush on the "New" button — `HoverButton` now uses the active theme accent.
- [x] Deleted the duplicate 5px category color bars under the event form (CATEGORY dropdown is the single selector now).
- [x] Wired `color-scheme` to active theme — date/time pickers and scrollbars adapt to Midnight.
- [x] Softened native date/time picker indicator opacity in [globals.css](apps/web/app/globals.css).
- [x] Dropped noise `letterSpacing: "-0.01em"` on the 12px theme-name pill.
- [x] Cleaned [globals.css](apps/web/app/globals.css) from 441 → ~95 lines (removed dead `.auth-screen`, `.workspace`, `.editor`, `.event-card`, `.reminder-fieldset`, etc.).
- [x] Removed dangling `className="shell"` from the setup screen (never defined in CSS).
