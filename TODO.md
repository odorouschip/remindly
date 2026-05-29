# Remindly — Todo

Living document. Check things off as they're done; add new items freely. Loosely ordered by priority within each section.

---

## Branding & assets

- [ ] **New logo.** Current is a generic orange rounded-square with a calendar grid SVG inside. Used in:
  - Sidebar header — [apps/web/components/CalendarApp.tsx](apps/web/components/CalendarApp.tsx) (the inline SVG inside the `Remindly` heading)
  - Login brand panel — [apps/web/components/LoginScreen.tsx](apps/web/components/LoginScreen.tsx)
  - Signup + Forgot Password brand panels — [apps/web/components/SignupScreen.tsx](apps/web/components/SignupScreen.tsx), [apps/web/components/ForgotPasswordScreen.tsx](apps/web/components/ForgotPasswordScreen.tsx)
  - Supabase-not-configured setup screen uses lucide `<CalendarDays>` as a placeholder
- [ ] **Real import provider logos.** Settings → Import currently shows letters "G", "O", "Y" and a blank circle for Apple (see `IMPORT_SOURCES` in [CalendarApp.tsx](apps/web/components/CalendarApp.tsx)). The real SVG icons already exist in [LoginScreen.tsx](apps/web/components/LoginScreen.tsx) (`GoogleIcon`, `AppleIcon`, `MicrosoftIcon`, `GitHubIcon`) — extract them and add a `YahooIcon`.
- [ ] **Favicon** — missing entirely. `/favicon.ico` 404s on every page load (visible in the console at runtime); no file in [apps/web/public/](apps/web/public/).
- [ ] **PWA manifest icons** — [apps/web/app/manifest.ts](apps/web/app/manifest.ts) only declares a single `/icon.svg` with `sizes: "any"`. iOS Home Screen and Android splash screens won't use SVG — need explicit 192×192 and 512×512 PNGs (and ideally an `apple-touch-icon` set).
- [ ] **Manifest brand name mismatches the UI.** [manifest.ts](apps/web/app/manifest.ts) declares `name: "Calender"` and `short_name: "Calender"`, while the in-app brand is "Remindly". An installed PWA would show "Calender" on the home screen. Pick one and align everywhere (including page title in [layout.tsx](apps/web/app/layout.tsx) which is also "Calender").
- [ ] **Manifest `theme_color` vs `<meta theme-color>` mismatch.** [manifest.ts](apps/web/app/manifest.ts) sets `theme_color: "#1f3d36"` (forest green — leftover from the dead globals.css palette), while [layout.tsx](apps/web/app/layout.tsx) sets `themeColor: "#f4f0e8"` (paper). Different surfaces (browser chrome vs installed PWA) will tint differently. Pick one or compute both from the active theme.
- [ ] **iOS app icon** — needs to match the new logo.

---

## UI polish

### Medium
- [ ] **`backdropFilter: blur(20px)` overuse.** Applied to sidebar, topbar, agenda panel, create panel — even on themes without a scene gradient (Ivory, Linen) where there's nothing behind to blur. Only apply when `theme.scene` is set.
- [ ] **Type scale.** ~12 font sizes scattered (9, 10, 11, 12, 13, 13.5, 14, 15, 17, 18, 20, 22, 24) with no pattern. Define a small `fs` constant and standardize.
- [ ] **Spacing scale.** Same problem with paddings — define an `sp` constant (4 / 6 / 8 / 12 / 16 / 20 / 24).
- [ ] **`accent + "22"` hex-alpha tint shorthand.** Used ~20 places. Centralize into a `tint(color, level)` helper.
- [ ] **Button consistency.** The topbar "New" button, create-panel "Cancel" / "Add Task" buttons, and settings modal "Done" button are three different inline-style approaches. Should share one `Button` component.

### Low
- [ ] Mini-cal weekday letters at 9px are nearly illegible.
- [ ] "Pick a view above" empty state (when all view toggles are off) could be friendlier.
- [ ] Right-side agenda panel auto-hides when create panel opens — feels jumpy; revisit.

---

## Bugs / dev warnings

- [ ] **React warning on theme switch: shorthand/longhand `background` conflict.** The `WebCalendar` root div at [CalendarApp.tsx:745](apps/web/components/CalendarApp.tsx#L745) sets `background: theme.bg` (shorthand) alongside `backgroundImage`, `backgroundSize: "cover"`, `backgroundAttachment: "fixed"` (longhand). When `theme.bg` changes on theme switch, the shorthand resets all background-related properties to their initial values and React's longhand reapply collides — Next.js dev warns this can cause styling bugs. Fix: replace `background: theme.bg` with `backgroundColor: theme.bg` so the shorthand doesn't collide. Logs two console errors per theme switch (one each for `backgroundAttachment` and `backgroundSize`).

---

## Functional gaps (currently mockup-y)

### Sidebar
- [ ] **Sidebar "MY CALENDARS" / "OTHER CALENDARS" filter does nothing.** Toggling "US Holidays" / "Work" doesn't actually hide events. Either remove until real calendars exist, or implement filtering by an event's calendar_id.
- [ ] **Categories dropdown** in sidebar duplicates Settings → Categories tab. Pick one.

### Settings modal
- [ ] **Account tab** has placeholder inputs (`defaultValue=""`) that don't read or write anything. Wire to Supabase `user_metadata`.
- [ ] **Profile picture.** Account tab currently shows an "R" initials avatar. Replace with a real avatar upload (Supabase Storage bucket), fallback to initials. Show the avatar in the sidebar header too.
- [ ] **Make Settings feel like a real app, not a mockup.** Current Account tab is three lonely inputs. Add: change-password flow, connected providers list, sign-out button (currently in sidebar), notification preferences, default view / week-start (already collected at signup but never editable after), delete-account.
- [ ] **Categories tab** is read-only ("managed inline on each event for now"). Either make it editable (add/rename/delete categories) or delete the tab.
- [ ] **Import tab** buttons don't import. Build the OAuth flow + ICS upload, or hide the section.

### Calendar views
- [ ] **Week view is fixed 7am–11pm.** Events outside that range silently disappear. Make it 24h, fit-to-events, or scrollable/zoomable.
- [ ] **No day view** — standard calendar pattern; missing.
- [ ] **Drag-and-drop to reschedule** events between days/times.
- [ ] **Drag-to-resize** events in week view.
- [ ] **Multi-day events** — currently every event is bound to one date.
- [ ] **Repeating events** — repeat rule is stored but the views don't expand recurrences into the grid; only the original instance shows.
- [ ] **Month-view overflow days are dead.** The grid shows the last few days of the previous month and the first few of the next (grayed) for layout, but `onClick` and `onDoubleClick` both gate on `isCur` (`isCur && onSelect(ds)`) so clicking them does nothing. Expected behavior: clicking should navigate to that month and select the day.
- [ ] **Creating an event in the month view requires a double-click on an empty area** — undiscoverable. Single click currently just selects the day. Either show a hint, or have single-click on empty area open the create panel.
- [ ] **Week-view empty time slots aren't clickable.** Clicking a 9am Tuesday slot should open a new-event panel with that date/time pre-filled; currently nothing happens.
- [ ] **Week-view day-number headers aren't clickable.** Clicking "Mon 3" in the header should jump to the day view (when day view exists).

### Search
- [ ] Filters silently — no result count, no "clear" button, no empty state when no matches.
- [ ] No keyboard shortcut to focus the search input.

### Create panel
- [ ] "Custom…" reminder offset button doesn't open anything.
- [ ] **Repeat end date.** When a repeat option is selected (Daily / Weekly / Monthly / Yearly), show an "Ends on" date input so the recurrence isn't open-ended forever. The DB column `repeat_until` already exists in the events table; just unused in the UI.
- [ ] **No "all-day event" option.** The UI offers Task (treated as all-day under the hood) or Event (timed); there's no way to create a real all-day Event like "Anniversary" or "Conference Day 1". The `is_all_day` column exists and is currently only set for tasks.
- [ ] **No way to mark a task complete.** Tasks store the title with a `" ✓"` suffix on create ([CalendarApp.tsx](apps/web/components/CalendarApp.tsx) `handleSave` for the task tab) but there's no toggle / checkbox in the UI to flip the state later.
- [ ] No location field on events.
- [ ] No attendees / invitees.
- [ ] No way to attach a file or note longer than a textarea.

---

## Database / backend

Current schema lives in [supabase/migrations/202604300001_init.sql](supabase/migrations/202604300001_init.sql): `events`, `reminders`, `devices`, `live_activity_runs`. RLS is per-user (`auth.uid() = user_id`). Several things the UI pretends to support don't exist in the DB yet.

### Schema additions (prerequisites for features above)
- [ ] **Calendars table.** Sidebar pretends "My Calendar", "Work", "Birthdays", "US Holidays" exist but nothing is stored. Add `public.calendars` (id, user_id, name, color, kind: personal/shared/holiday, is_visible). Add a `calendar_id` FK on `events`. Backfill existing rows into a default "My Calendar" per user. This is the prerequisite for the sidebar filter feature in Functional gaps.
- [ ] **Categories as a real column (or table).** Today `cat` (work/personal/health/social) is packed into `notes` as `%%META%%` JSON — see `packNotes` / `unpackNotes` in [CalendarApp.tsx](apps/web/components/CalendarApp.tsx). Move to a real `category` column on `events`. If categories should be user-customizable (per Themes section), promote to a `categories` table instead.
- [ ] **Priority + `is_task` as real columns.** Both also currently in the meta JSON. Move to real columns so they're queryable (e.g., "show me all high-priority tasks").
- [ ] **Profiles table.** No place to store display name, avatar URL, theme preference, week_start, default_view. Two options: (a) shove into `auth.users.user_metadata` (simplest, JSON blob, no extra table); (b) create `public.profiles` mirrored from `auth.users` via a trigger (Supabase convention, queryable, RLS-friendly). Recommend **(b)** — needed anyway for avatar URL (Storage bucket) and to read another user's display name if sharing ever happens.
- [ ] **Import source tracking.** When calendar imports work, events need `source` (google/apple/outlook/ics/manual), `external_id` (for sync dedup), `last_synced_at`. Add columns to `events`, or a separate `event_external_links` table if one event can sync from multiple sources.

### Data integrity / schema cleanup
- [ ] **"Yearly" recurrence is invisible to SQL.** `RECUR_TO_DB` in [CalendarApp.tsx](apps/web/components/CalendarApp.tsx) maps `Yearly → "none"` and stashes the actual frequency in the meta JSON. Any query like `where repeat_frequency = 'yearly'` will find nothing. Either add `'yearly'` to the `repeat_frequency` CHECK constraint and store it, or remove the Yearly option until recurrence expansion handles it properly.
- [ ] **`is_archived` column is dead.** Defined in [the init migration](supabase/migrations/202604300001_init.sql) but never read or written by the web app. Either build an archive flow (events that don't show but aren't deleted) or drop the column in a follow-up migration.
- [ ] **`devices.platform` enforces `'ios' | 'web'` but no web row ever gets created.** When/if web push is added, need a flow to register the browser as a device.

### US Holidays — pick an approach
- [ ] **Decision: Option A (shared) vs Option B (per-user copy).** Recommend **A**.

  **Option A — shared read-only holidays table.** Create a `public.holidays` row per holiday tied to a special `calendars` row with no `user_id`. Public-read RLS so any authenticated user can SELECT. Calendar UI fetches user events UNION holidays (or two queries merged client-side) when the "US Holidays" toggle is on.
  - Pros: single source of truth, update once per year, no per-user storage bloat, trivially extends to UK / Canada / religious calendars.
  - Cons: events query has to UNION or you need two reads.

  **Option B — seed each user's events with holidays on signup.** Use a `handle_new_user()` Postgres trigger to INSERT US Holidays for the next ~5 years into the user's events with a `source = "holiday"` flag.
  - Pros: zero schema work — they're just events.
  - Cons: ~50+ duplicate rows per user, painful to update if a holiday changes or you want to backfill new years, painful to add a new region retroactively.
- [ ] **If A wins:** build the `holidays` table + seed script for US 2026–2030, wire the UI to merge them in when toggled.
- [ ] **If B wins:** build the on-signup `handle_new_user()` trigger and an admin script to refresh holiday rows each year.

### Recurrence storage
- [ ] **Decide expansion strategy.** Today `events` stores `repeat_frequency` + `repeat_until` but the views never expand the rule into instances — only the original date renders (tracked in Functional gaps → Calendar views). Three approaches: (a) expand client-side on read from the single stored row, (b) generate occurrence rows in a database view, (c) materialize the next N occurrences into a separate table via a job. **(a) is the simplest start** — defer (c) until performance forces it.
- [ ] **Exceptions table.** Once recurrence is expanded, users will want to move or delete a single instance of a repeating event. Add `recurrence_exceptions` (event_id, occurrence_date, action: cancelled / modified, override_event_id).

### Search
- [ ] **Server-side search** (deferred). Today search is `events.filter()` over the locally loaded list — fine for small datasets, breaks once a user has 1000+ events. Add a `tsvector` index on `title || notes` and an RPC. Not urgent.

### Maintenance
- [ ] **Soft-delete purge job.** `deleted_at` is set but never cleaned. Add a scheduled function to permanently delete rows where `deleted_at < now() - interval '30 days'`.
- [ ] **Migration discipline.** Right now everything lives in `202604300001_init.sql`. Future schema changes should land as new timestamped migrations — never edit a shipped one.
- [ ] **Backups.** Verify the Supabase project has point-in-time recovery turned on (requires Pro plan); document the restore procedure.

### Edge function (dispatch-reminders)
- [ ] **`delivered_at` is set even when every APNs send fails.** [dispatch-reminders/index.ts](supabase/functions/dispatch-reminders/index.ts) (~line 96) updates `delivered_at = now()` unconditionally after the device loop, regardless of `sendResults`. If APNs is unreachable, every token is stale, or there are zero devices for the user, the reminder is silently marked delivered and lost. Fix: only mark delivered if at least one send returned `ok: true` (or branch into a retry/backoff path).
- [ ] **APNs JWT is regenerated for every reminder.** `createApnsJwt()` is called inside `dispatchReminder` (per-reminder), but JWTs are valid ~50 minutes and re-use is encouraged by Apple. Move JWT creation to the top of the cron invocation and reuse across all reminders in the batch.
- [ ] **Only `platform = 'ios'` devices are queried** (`.eq("platform", "ios")` in `dispatchReminder`). If web push or another platform is ever added, those device rows will silently never receive reminders.
- [ ] **`live_activity_runs` has no dedup.** Each successful Live Activity start `INSERT`s a row; if the same event has multiple reminders that all fire near each other (e.g., 1-day, 30-min, at-time), multiple runs are created. Add a unique constraint on `(event_id, device_id, phase)` or check before insert.
- [ ] **APNs token rotation.** `devices.apns_device_token` + `activity_push_to_start_token` are stored but there's no flow for invalidating stale tokens when APNs returns `Unregistered` / `BadDeviceToken`.
- [ ] **Idempotency.** If the 1-minute cron double-fires (or misses then re-runs), make sure the same reminder isn't dispatched twice. The `delivered_at` column is the natural latch — verify the function actually checks + sets it atomically.

---

## Auth screens

- [ ] **Terms / Privacy links** are `#` placeholders ([LoginScreen.tsx](apps/web/components/LoginScreen.tsx) footer + Signup step 1).
- [ ] **OAuth buttons** call `signInWithOAuth` but Google/Apple/Microsoft/GitHub providers need to actually be configured in Supabase.
- [ ] **OAuth failure strands the user on a Supabase JSON error page.** Confirmed in audit: clicking "Continue with Google" with the provider not enabled redirects the browser to `https://<project>.supabase.co/auth/v1/authorize?...` which responds with raw JSON `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`. The user is now on Supabase's domain with no way back. Fix: pass `options: { skipBrowserRedirect: true }` to `signInWithOAuth`, then `window.location.assign(data.url)` only after a sanity check, OR (simpler) hide buttons whose provider isn't enabled.
- [ ] **OAuth button labels wrap into 3 lines on narrow screens.** At ≤375px width the 2-column grid + "Continue with Google" label wraps as `Continue / with / Google`. Either collapse to single-column on narrow widths or shorten labels to "Google" / "Apple" / etc. at small breakpoints.
- [ ] **Brand panel design differs across the three auth screens.** Login = decorative circles + calendar preview card. Signup = circles + feature pills + tagline. Forgot Password = lock icon card + circles + tagline. Three different visual identities for the same product. Pick one brand-panel layout and reuse it.
- [ ] **Signup → preferences step** stores `defaultView`, `weekStart`, etc. in localStorage but the calendar app doesn't read them back yet.
- [ ] **Forgot password** OTP flow works but the email Supabase sends is the default template — customize it.

---

## Themes

7 themes exist today: Ivory, Linen, Sage, Ocean, Sunset, Lavender, Midnight (see `THEMES` array in [CalendarApp.tsx](apps/web/components/CalendarApp.tsx)).

- [ ] **Refine the existing 7.** Audit each theme for contrast (especially Sage / Sunset on body text), scene gradients (Linen has none — feels flatter than the others), and chip/card colors. Midnight in particular needs a hover/selected pass.
- [ ] **More themes.** Ideas: a true monochrome / paper-white, a higher-contrast accessibility theme, seasonal variants, a "focus" minimal theme with no scene gradient.
- [ ] **System theme preference.** Match the OS light/dark setting on first visit instead of defaulting to Ivory.
- [ ] **Per-category color customization.** Today the 4 category colors are baked into the `CATS` constant. Let users pick their own.
- [ ] **Theme preview in settings** could be larger / interactive — currently you only see the swatch dot + a stripe of gradient.
- [ ] **Custom accent color** independent of theme (Notion-style).

---

## Bigger picture

### Smart command bar / natural-language input
- [ ] Add a global command bar (Cmd/Ctrl-K) that does more than search — Notion Calendar / Cron / Fantastical style. Should: search events, jump to dates ("next monday"), create events from natural language ("Lunch with Sam tomorrow at noon"), and run app commands ("switch to week view", "new task").
- [ ] If natural-language event creation uses an LLM, it should round-trip locally for the simple cases (dates, times, durations) and only call the model for ambiguous input — avoids latency and cost on every keystroke.

### iOS Live Activities (the headline feature)
- [ ] Live Activity styling should match the (eventual) new web brand.
- [ ] Confirm the Live Activity surfaces the next event with a glanceable countdown — this is the whole reason for building Remindly vs. using stock Calendar.
- [ ] Test push-to-start Live Activities on iOS 17.2+ so events can launch a Live Activity from the server when due.

### Cross-platform sync
- [ ] Conflict resolution when web and iOS edit the same event while one is offline.
- [ ] Apple Calendar / Google Calendar / Outlook one-way mirror in.
- [ ] Share-calendar-with-another-user (longer term).

### PWA story
- [ ] **Service worker has no real strategy.** [apps/web/public/sw.js](apps/web/public/sw.js) pre-caches `/` and `/icon.svg`, then does network-first with cache fallback. But `/` is a Server Component HTML that depends on auth state, so cached HTML is mostly useless. No JS/CSS/asset caching, no offline event store. Either commit to a real offline-first design (cache the app shell properly, queue mutations while offline, sync on reconnect) or take the SW out until the design is ready — right now it's vaporware that adds confusion.
- [ ] **App shell route.** If the SW is going to work, the calendar app needs a stable shell route that doesn't depend on session — `/app` or similar, with auth checked client-side after hydration.

### Quality bar before public
- [ ] Marketing site.
- [ ] Real Privacy Policy + Terms of Service.
- [ ] Onboarding tour for first sign-in.
- [ ] Empty states for every major surface (no events, no upcoming, no search matches, etc.).
- [ ] Error states for network/Supabase failures (currently just the small `status` string at the bottom of auth).

---

## iOS app

The iOS side is significantly less developed than the web side and the entire UI needs a redesign. Most items here are placeholders — flesh them out as direction firms up. Live Activity items live above under "Bigger picture → iOS Live Activities" for now.

### UI redesign (currently unsatisfactory — full overhaul planned)
- [ ] **Decide the iOS visual direction.** Should it mirror the web (sidebar + theming + 7 themes) or lean into native iOS patterns (NavigationStack, tab bar, native sheets, system colors)? Probably native — but the web brand needs to be visible.
- [ ] **Audit current screens** — [RootView.swift](apps/ios/Calender/RootView.swift), [EventsView.swift](apps/ios/Calender/EventsView.swift), [EventEditorView.swift](apps/ios/Calender/EventEditorView.swift) — list everything that needs to change. (Quick pass before redesign begins.)
- [ ] **Rebuild events list / agenda view** with the new design language.
- [ ] **Rebuild event editor** (currently `EventEditorView.swift`) — should feel like a native iOS form, not a port of the web create panel.
- [ ] **Add month / week views** on iPad / larger phones.
- [ ] **App-wide theming layer** — [Theme.swift](apps/ios/Calender/Theme.swift) exists; verify it covers the 7 web themes (or whichever subset makes sense on iOS).

### Functionality still needed
- [ ] **Auth UI** — verify the iOS sign-in matches the redesigned web auth (Google / Apple / Microsoft / GitHub buttons, forgot password, signup with preferences).
- [ ] **Sign in with Apple** — should be the primary sign-in on iOS per App Store guidelines.
- [ ] **Offline editing + sync conflict handling.**
- [ ] **Push notifications fallback** when Live Activities aren't supported (older iOS, iPad without Dynamic Island, etc.).
- [ ] **iCloud / device-local backup** of preferences (theme choice, default view, etc.).
- [ ] **Calendar widgets** (Home Screen + Lock Screen) beyond the Live Activity.
- [ ] **Share extension** so events can be created from other apps (e.g., from a Safari page).

### Polish / quality
- [ ] **App icon** — needs to match the new logo.
- [ ] **Launch screen** — currently default.
- [ ] **Onboarding** — first-launch flow asking for notification permission, Live Activity opt-in, calendar imports.
- [ ] **Dynamic Type** support across all screens.
- [ ] **VoiceOver** labels for all interactive elements.

---

## Recently done

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
