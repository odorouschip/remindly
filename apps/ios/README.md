# Calender iOS

This folder contains the native SwiftUI + ActivityKit source for the iPhone app and Live Activity widget.

## Xcode setup

1. On a Mac, create a new iOS app project named `Calender`.
2. Set the minimum deployment target to iOS 17.2.
3. Add the files in `apps/ios/Calender` to the main app target.
4. Add a Widget Extension target named `CalenderLiveActivity`.
5. Add `apps/ios/CalenderLiveActivity` to the widget extension target.
6. Add `apps/ios/Shared/CalenderActivityAttributes.swift` to both the app target and widget extension target.
7. Enable capabilities on the app target: Push Notifications, Background Modes > Remote notifications, and Live Activities.
8. Enable Live Activities on the widget extension target.
9. Replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `Calender/Info.plist`.
10. Set the bundle identifier to the same value used in Supabase function env var `APNS_BUNDLE_ID`.

## Device testing notes

Live Activities and APNs push-to-start should be tested on a real iPhone. The app also schedules local notifications as a fallback after syncing events.
