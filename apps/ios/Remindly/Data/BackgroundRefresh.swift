import BackgroundTasks
import Foundation
import os

/// Lets iOS wake Remindly now and then to sync, so reminders for events added
/// on the web get scheduled without opening the app.
///
/// Battery: iOS decides when (and whether) to run this based on how often the
/// app is used, battery level and network. Each run is two small requests plus
/// a notification diff, typically well under a few seconds.
enum BackgroundRefresh {
    static let identifier = (Bundle.main.bundleIdentifier ?? "com.odorouschip.Remindly") + ".refresh"
    static let log = Logger(subsystem: Bundle.main.bundleIdentifier ?? "Remindly", category: "refresh")

    /// Don't ask to run more often than this; iOS may still wait longer.
    private static let minimumInterval: TimeInterval = 3 * 60 * 60

    /// Asks iOS for the next refresh. Re-submitting replaces any pending request.
    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        request.earliestBeginDate = Date().addingTimeInterval(minimumInterval)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            // Expected in the simulator and when Background App Refresh is off in Settings.
            log.debug("Couldn't schedule refresh: \(error.localizedDescription, privacy: .public)")
        }
    }
}
