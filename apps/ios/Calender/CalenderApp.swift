import SwiftUI
import UIKit

@main
struct CalenderApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var session = SessionStore()
    @StateObject private var api = SupabaseAPI()
    @StateObject private var notificationScheduler = NotificationScheduler()
    @StateObject private var liveActivities = LiveActivityController()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(api)
                .environmentObject(notificationScheduler)
                .environmentObject(liveActivities)
                .onOpenURL { url in
                    session.pendingDeepLink = url
                }
                .task {
                    appDelegate.configure(api: api, session: session)
                    await notificationScheduler.requestAuthorization()
                }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    private weak var api: SupabaseAPI?
    private weak var session: SessionStore?

    func configure(api: SupabaseAPI, session: SessionStore) {
        self.api = api
        self.session = session
    }

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        application.registerForRemoteNotifications()
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        guard let api, let session, let accessToken = session.accessToken, let userId = session.userId else { return }
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()

        Task {
            try? await api.upsertDevice(accessToken: accessToken, userId: userId, apnsToken: token, activityPushToStartToken: nil)
        }
    }
}
