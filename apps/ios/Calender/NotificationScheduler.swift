import Foundation
import UserNotifications

@MainActor
final class NotificationScheduler: ObservableObject {
    @Published var authorizationStatus: UNAuthorizationStatus = .notDetermined

    func requestAuthorization() async {
        do {
            _ = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
            await refreshSettings()
        } catch {
            await refreshSettings()
        }
    }

    func refreshSettings() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        authorizationStatus = settings.authorizationStatus
    }

    func schedule(events: [CalendarEvent]) async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        let existingIdentifiers = pending
            .map(\.identifier)
            .filter { $0.hasPrefix("calender.event.") }

        if !existingIdentifiers.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: existingIdentifiers)
        }

        for event in events where event.deletedAt == nil && !event.isArchived {
            for reminder in event.reminders ?? [] where reminder.dueAt > Date() {
                let content = UNMutableNotificationContent()
                content.title = event.title
                content.body = reminder.offsetMinutes == 0 ? "Starting now" : "Starts in \(reminder.offsetMinutes) minutes"
                content.sound = .default
                content.threadIdentifier = event.id.uuidString
                content.userInfo = [
                    "eventId": event.id.uuidString,
                    "deepLinkUrl": "calender://events/\(event.id.uuidString)"
                ]

                let dateComponents = Calendar.current.dateComponents(
                    [.year, .month, .day, .hour, .minute, .second],
                    from: reminder.dueAt
                )
                let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: false)
                let request = UNNotificationRequest(
                    identifier: "calender.event.\(event.id.uuidString).\(reminder.offsetMinutes)",
                    content: content,
                    trigger: trigger
                )

                try? await center.add(request)
            }
        }
    }
}
