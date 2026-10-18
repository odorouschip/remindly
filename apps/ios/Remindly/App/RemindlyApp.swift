import SwiftUI
import UserNotifications

@main
struct RemindlyApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var auth: AuthStore
    @State private var store: CalendarStore

    init() {
        let auth = AuthStore()
        _auth = State(initialValue: auth)
        _store = State(initialValue: CalendarStore(auth: auth))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .environment(store)
                .tint(.remindly)
                .onAppear {
                    appDelegate.store = store
                    #if DEBUG
                    if let id = DemoData.eventToOpen { store.pendingEventId = id }
                    #endif
                }
                // remindly://events/<id> opens that event (Live Activities and notifications use it).
                .onOpenURL { url in
                    guard url.scheme == "remindly", url.host == "events",
                          let id = UUID(uuidString: url.lastPathComponent) else { return }
                    store.pendingEventId = id
                }
        }
        // iOS launches the app in the background now and then to run this.
        .backgroundTask(.appRefresh(BackgroundRefresh.identifier)) {
            await store.backgroundRefresh()
            BackgroundRefresh.schedule()
        }
    }
}

/// Shows reminders while the app is open and opens the event when one is tapped.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    weak var store: CalendarStore?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard let raw = response.notification.request.content.userInfo["eventId"] as? String,
              let id = UUID(uuidString: raw) else { return }
        await MainActor.run { store?.pendingEventId = id }
    }
}
