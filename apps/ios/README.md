# Remindly iOS

SwiftUI app plus a WidgetKit extension for Live Activities.

## Layout

| Path | What |
|---|---|
| `Remindly.xcodeproj` | The project. Open this in Xcode. |
| `Remindly/` | App target sources and assets. |
| `RemindlyWidgets/` | Widget extension: Live Activity UI and the Home / Lock Screen widget configurations. |
| `Shared/` | Code compiled into both targets: `Day`, the category palette, Live Activity attributes, the widget snapshot and widget views. |
| `Config/` | Build settings and Info.plist pieces. `Secrets.xcconfig` is gitignored. |

The folders are synchronized with the project, so any file added inside them is picked up automatically — no need to add files in Xcode.

## First-time setup

1. Generate the Supabase settings from the web app's `.env.local`:
   ```sh
   apps/ios/scripts/sync-secrets.sh
   ```
   (Or copy `Config/Secrets.example.xcconfig` to `Config/Secrets.xcconfig` and fill it in.)
2. Open `apps/ios/Remindly.xcodeproj`, pick an iPhone simulator, press ⌘R.

## Running on your iPhone

Add your Apple ID in **Xcode → Settings → Accounts**, then set **Team** to your Personal Team on both targets (Signing & Capabilities). With a free account the app has to be re-run from Xcode every 7 days. Bundle IDs are `com.odorouschip.Remindly` and `com.odorouschip.Remindly.Widgets`; change both if that prefix is taken.

Both targets share the App Group `group.com.odorouschip.Remindly` (in `Config/*.entitlements`), which is how the widgets get their data. If Xcode can't register it for your team, pick another group name in Signing & Capabilities on both targets and update `WidgetSnapshot.appGroup` to match.

## Widgets

**Up Next** (small, Lock Screen rectangular and inline) shows the event happening now or the next one; **Today** (medium, large) shows what's left today, overdue tasks first, then the days ahead. After every sync or change the app writes the next two weeks to `widget-snapshot.json` in the App Group container ([WidgetSnapshot.swift](Shared/WidgetSnapshot.swift)) and asks the widgets to reload only if it changed. Background refresh keeps it current when the app is closed. The widgets plan their own updates for each event start/end and midnight.

The widget views live in `Shared/WidgetViews.swift` so a debug gallery can draw them: launch with `-demo -widgets`.

## Reminders and background refresh

Reminders are local notifications: after every sync the app keeps the next 60 scheduled (iOS allows 64), changing only the ones that differ. To pick up events added on the web without opening the app, it asks iOS for a background refresh at most every 3 hours; iOS decides the actual timing from how often you use the app, battery and network, and each run is two small requests.

Background refresh doesn't run in the simulator ("BGTaskScheduler is not available on this platform"). To test it on a phone: run from Xcode, send the app to the background, pause in the debugger (⌃⌘Y) and run

```
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.odorouschip.Remindly.refresh"]
```

then continue. "Background refresh started/finished" appears in the console (subsystem `com.odorouschip.Remindly`, category `refresh`). It also needs **Settings → General → Background App Refresh** on.

## Debug launch arguments

Edit Scheme → Run → Arguments (Debug builds only):

| Argument | Effect |
|---|---|
| `-demo` | Sample data, no account needed; edits stay in memory |
| `-tab upcoming` | Start on the Upcoming tab |
| `-tab week` / `-tab month` | Start on the Calendar tab in that view |
| `-open-event <uuid>` | Open that event on launch, as a tapped notification would; `<uuid>@YYYY-MM-DD` opens one occurrence of a repeating event (the demo Standup is `00000000-0000-0000-0000-00000000DE71`) |
| `-quick-add "<text>"` | Open quick add with the text typed in |
| `-live-activity` | Start a countdown for the next timed event |
| `-widgets` | Show the widget gallery (Home / Lock Screen widgets at their sizes) instead of the app |

## Command-line build

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project apps/ios/Remindly.xcodeproj -scheme Remindly \
  -destination 'platform=iOS Simulator,name=iPhone 18 Pro' build
```
