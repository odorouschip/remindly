import ActivityKit
import Foundation

/// Starts and ends the Lock Screen / Dynamic Island countdown from inside the app.
/// (Starting one automatically while the app is closed needs server push.)
@MainActor
enum LiveActivityController {
    static var isAvailable: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }

    static func isRunning(for occurrence: Occurrence) -> Bool {
        Activity<RemindlyActivityAttributes>.activities.contains { $0.attributes.eventId == occurrence.id }
    }

    static func start(_ occurrence: Occurrence) throws {
        guard isAvailable else { throw APIError("Live Activities are turned off for Remindly in Settings.") }
        let attributes = RemindlyActivityAttributes(eventId: occurrence.id, title: occurrence.event.title)
        _ = try Activity.request(
            attributes: attributes,
            content: ActivityContent(state: state(for: occurrence), staleDate: occurrence.end),
            pushType: nil
        )
    }

    static func end(_ occurrence: Occurrence) async {
        for activity in Activity<RemindlyActivityAttributes>.activities where activity.attributes.eventId == occurrence.id {
            await activity.end(
                ActivityContent(state: state(for: occurrence, phase: "ended"), staleDate: nil),
                dismissalPolicy: .immediate
            )
        }
    }

    private static func state(for occurrence: Occurrence, phase: String? = nil) -> RemindlyActivityAttributes.ContentState {
        let now = Date()
        let minutesUntil = occurrence.start.timeIntervalSince(now) / 60
        let currentPhase: String
        if now >= occurrence.end { currentPhase = "ended" }
        else if now >= occurrence.start { currentPhase = "in_progress" }
        else if minutesUntil <= 1 { currentPhase = "starting" }
        else { currentPhase = "upcoming" }

        return RemindlyActivityAttributes.ContentState(
            eventId: occurrence.event.id.uuidString,
            title: occurrence.event.title,
            startsAt: ISO8601DateFormatter.supabase.string(from: occurrence.start),
            endsAt: ISO8601DateFormatter.supabase.string(from: occurrence.end),
            phase: phase ?? currentPhase,
            urgency: minutesUntil <= 1 ? "now" : minutesUntil <= 10 ? "soon" : "calm",
            deepLinkUrl: "remindly://events/\(occurrence.event.id.uuidString)"
        )
    }
}
