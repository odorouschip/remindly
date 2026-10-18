import SwiftUI

/// Sign-in when signed out; the agenda (synced and with reminders scheduled) when signed in.
struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(CalendarStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if auth.isSignedIn || isDemo {
                AgendaView()
            } else {
                SignInView()
            }
        }
        .task(id: auth.session?.userId) {
            if auth.isSignedIn || isDemo {
                // Load first so the agenda isn't blank while the permission prompt is up.
                await store.load()
                await store.notifications.requestAuthorization()
                await store.notifications.reschedule(events: store.events)
            } else {
                await store.reset()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                // Pick up changes made on the web, unless we synced moments ago.
                if auth.isSignedIn && !isDemo && store.hasLoaded {
                    Task { await store.refreshIfStale() }
                } else {
                    store.rollOverIfNeeded()
                }
            case .background:
                if auth.isSignedIn || isDemo { BackgroundRefresh.schedule() }
            default:
                break
            }
        }
        // Midnight, a time zone change or the clock being set: "Today" moves.
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in
            store.rollOverIfNeeded()
        }
    }

    private var isDemo: Bool {
        #if DEBUG
        DemoData.isEnabled
        #else
        false
        #endif
    }
}
