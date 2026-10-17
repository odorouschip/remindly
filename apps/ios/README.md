# Remindly iOS

SwiftUI app plus a WidgetKit extension for Live Activities.

## Layout

| Path | What |
|---|---|
| `Remindly.xcodeproj` | The project. Open this in Xcode. |
| `Remindly/` | App target sources and assets. |
| `RemindlyWidgets/` | Widget extension (Live Activity UI). |
| `Shared/` | Code compiled into both targets (`RemindlyActivityAttributes`). |
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

## Command-line build

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project apps/ios/Remindly.xcodeproj -scheme Remindly \
  -destination 'platform=iOS Simulator,name=iPhone 18 Pro' build
```
