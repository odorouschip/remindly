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
                await store.notifications.requestAuthorization()
                await store.load()
            } else {
                await store.reset()
            }
        }
        // Pick up changes made on the web whenever the app comes back to the foreground.
        .onChange(of: scenePhase) { _, phase in
            if phase == .active && auth.isSignedIn && !isDemo && store.hasLoaded {
                Task { await store.load() }
            }
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
