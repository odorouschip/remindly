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
- [ ] **Favicon** — currently default Next.js favicon.
- [ ] **PWA manifest icons** — verify [apps/web/app/manifest.ts](apps/web/app/manifest.ts) points at real branded icons.
- [ ] **iOS app icon** — needs to match the new logo.
- [ ] **`themeColor` in metadata** — hardcoded `#f4f0e8` in [layout.tsx](apps/web/app/layout.tsx). Either pick one canonical brand color or make it match the active theme.

---

## UI polish

### High-impact
- [ ] **Hover states across the app.** Sidebar calendar rows, mini-cal day cells, month-view event chips, week-view event blocks, agenda list items, and the create-panel "Cancel" button all have no hover feedback. App feels static.
- [ ] **Mini-cal day cells** are 22×22 px — sub-spec for click targets. Bump to ~28+.
- [ ] **Themed focus rings on inputs.** Create panel + settings inputs/selects/textareas use raw browser focus outlines (or none). Add a `box-shadow: 0 0 0 3px <accent-alpha>` ring like LoginScreen already does.

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

## Functional gaps (currently mockup-y)

### Sidebar
- [ ] **Sidebar "MY CALENDARS" / "OTHER CALENDARS" filter does nothing.** Toggling "US Holidays" / "Work" doesn't actually hide events. Either remove until real calendars exist, or implement filtering by an event's calendar_id.
- [ ] **Categories dropdown** in sidebar duplicates Settings → Categories tab. Pick one.

### Settings modal
- [ ] **Account tab** has placeholder inputs (`defaultValue=""`) that don't read or write anything. Wire to Supabase `user_metadata`.
- [ ] **Categories tab** is read-only ("managed inline on each event for now"). Either make it editable (add/rename/delete categories) or delete the tab.
- [ ] **Import tab** buttons don't import. Build the OAuth flow + ICS upload, or hide the section.

### Calendar views
- [ ] **Week view is fixed 7am–11pm.** Events outside that range silently disappear. Make it 24h, fit-to-events, or scrollable/zoomable.
- [ ] **No day view** — standard calendar pattern; missing.
- [ ] **Drag-and-drop to reschedule** events between days/times.
- [ ] **Drag-to-resize** events in week view.
- [ ] **Multi-day events** — currently every event is bound to one date.
- [ ] **Repeating events** — repeat rule is stored but the views don't expand recurrences into the grid; only the original instance shows.

### Search
- [ ] Filters silently — no result count, no "clear" button, no empty state when no matches.
- [ ] No keyboard shortcut to focus the search input.

### Create panel
- [ ] "Custom…" reminder offset button doesn't open anything.
- [ ] No location field on events.
- [ ] No attendees / invitees.
- [ ] No way to attach a file or note longer than a textarea.

---

## Auth screens

- [ ] **Terms / Privacy links** are `#` placeholders ([LoginScreen.tsx](apps/web/components/LoginScreen.tsx) footer + Signup step 1).
- [ ] **OAuth buttons** call `signInWithOAuth` but Google/Apple/Microsoft/GitHub providers need to actually be configured in Supabase.
- [ ] **Signup → preferences step** stores `defaultView`, `weekStart`, etc. in localStorage but the calendar app doesn't read them back yet.
- [ ] **Forgot password** OTP flow works but the email Supabase sends is the default template — customize it.

---

## Bigger picture

### iOS Live Activities (the headline feature)
- [ ] Live Activity styling should match the (eventual) new web brand.
- [ ] Confirm the Live Activity surfaces the next event with a glanceable countdown — this is the whole reason for building Remindly vs. using stock Calendar.
- [ ] Test push-to-start Live Activities on iOS 17.2+ so events can launch a Live Activity from the server when due.

### Cross-platform sync
- [ ] Conflict resolution when web and iOS edit the same event while one is offline.
- [ ] Apple Calendar / Google Calendar / Outlook one-way mirror in.
- [ ] Share-calendar-with-another-user (longer term).

### Quality bar before public
- [ ] Marketing site.
- [ ] Real Privacy Policy + Terms of Service.
- [ ] Onboarding tour for first sign-in.
- [ ] Empty states for every major surface (no events, no upcoming, no search matches, etc.).
- [ ] Error states for network/Supabase failures (currently just the small `status` string at the bottom of auth).

---

## Recently done (UI polish pass — 2026-05-28)

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
