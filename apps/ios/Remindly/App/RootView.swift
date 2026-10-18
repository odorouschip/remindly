import SwiftUI

/// Sign-in when signed out; the agenda (synced and with reminders scheduled) when signed in.
struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(CalendarStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if isDemo && showsWidgetGallery {
                WidgetGallery()
            } else if auth.isSignedIn || isDemo {
                MainView()
            } else {
                SignInView()
            }
        }
        .task(id: auth.session?.userId) {
            if auth.isSignedIn || isDemo {
                // Load first so the agenda isn't blank while the permission prompt is up.
                await store.load()
                #if DEBUG
                if DemoData.startsLiveActivity, let next = store.agenda.days.lazy.flatMap(\.occurrences).first(where: { !$0.event.allDay && $0.start > Date() }) {
                    do {
                        try LiveActivityController.start(next, tint: store.category(next.event.categoryId)?.color)
                        BackgroundRefresh.log.notice("Demo Live Activity started for \(next.event.title, privacy: .public)")
                    } catch {
                        BackgroundRefresh.log.error("Demo Live Activity failed: \(String(describing: error), privacy: .public)")
                    }
                }
                #endif
                await store.notifications.requestAuthorization()
                await store.notifications.reschedule(events: store.events)
            } else {
                await store.reset()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                Task { await LiveActivityController.endFinished() }
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

    private var showsWidgetGallery: Bool {
        #if DEBUG
        DemoData.showsWidgetGallery
        #else
        false
        #endif
    }

    private var isDemo: Bool {
        #if DEBUG
        DemoData.isEnabled
        #else
        false
        #endif
    }
}
