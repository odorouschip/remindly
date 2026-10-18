import Foundation
import UserNotifications

/// Turns reminders into local notifications on this device.
///
/// iOS keeps at most 64 pending notifications per app, so this schedules the
/// soonest ones and is re-run after every sync. (Server push via the
/// dispatch-reminders function needs a paid developer account; if that's ever
/// turned on, this should stand down to avoid double alerts.)
@MainActor
final class NotificationScheduler {
    private static let prefix = "remindly."
    private static let limit = 60
    /// How far ahead to look for occurrences to remind about.
    private static let horizonDays = 60

    private var center: UNUserNotificationCenter { .current() }

    func requestAuthorization() async {
        _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
    }

    func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    func reschedule(events: [CalendarEvent]) async {
        let stale = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(Self.prefix) }
        center.removePendingNotificationRequests(withIdentifiers: stale)

        let now = Date()
        let today = Day.today
        let horizon = today.adding(days: Self.horizonDays)
        var upcoming: [(fire: Date, occurrence: Occurrence, offset: Int)] = []
        for event in events where !(event.isTask && event.isDone) {
            let offsets = reminderOffsets(for: event)
            guard !offsets.isEmpty else { continue }
            for occurrence in event.occurrences(from: today, to: horizon) {
                for offset in offsets {
                    let fire = occurrence.start.addingTimeInterval(TimeInterval(-offset * 60))
                    if fire > now { upcoming.append((fire, occurrence, offset)) }
                }
            }
        }

        for item in upcoming.sorted(by: { $0.fire < $1.fire }).prefix(Self.limit) {
            let content = UNMutableNotificationContent()
            content.title = item.occurrence.event.title
            content.body = Self.body(for: item.occurrence.event, offset: item.offset)
            content.sound = .default
            content.threadIdentifier = item.occurrence.event.id.uuidString
            content.userInfo = ["eventId": item.occurrence.event.id.uuidString]

            let when = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: item.fire)
            let request = UNNotificationRequest(
                identifier: "\(Self.prefix)\(item.occurrence.id).\(item.offset)",
                content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: when, repeats: false)
            )
            try? await center.add(request)
        }
    }

    /// Same wording as the server dispatcher's alertBody().
    static func body(for event: CalendarEvent, offset minutes: Int) -> String {
        if event.isTask {
            if minutes <= 0 { return "Due today" }
            if minutes <= 1440 { return "Due tomorrow" }
            return "Due in \(Int((Double(minutes) / 1440).rounded(.up))) days"
        }
        if minutes <= 0 { return "Starting now" }
        if minutes < 60 { return "Starts in \(minutes) minutes" }
        if minutes % 1440 == 0 { return minutes == 1440 ? "Tomorrow" : "In \(minutes / 1440) days" }
        if minutes % 60 == 0 { return minutes == 60 ? "Starts in 1 hour" : "Starts in \(minutes / 60) hours" }
        return "Starts in \(minutes) minutes"
    }
}
