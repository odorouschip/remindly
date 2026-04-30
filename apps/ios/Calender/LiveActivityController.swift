import ActivityKit
import Foundation

@MainActor
final class LiveActivityController: ObservableObject {
    @Published var activeActivityId: String?
    private var isObservingPushToStart = false

    func start(event: CalendarEvent) async throws {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            throw LiveActivityError.disabled
        }

        let attributes = CalenderActivityAttributes(
            eventId: event.id.uuidString,
            title: event.title
        )
        let content = ActivityContent(
            state: makeContentState(event: event),
            staleDate: event.endsAt
        )
        let activity = try Activity.request(
            attributes: attributes,
            content: content,
            pushType: .token
        )
        activeActivityId = activity.id
    }

    func update(event: CalendarEvent) async {
        for activity in Activity<CalenderActivityAttributes>.activities where activity.attributes.eventId == event.id.uuidString {
            await activity.update(ActivityContent(
                state: makeContentState(event: event),
                staleDate: event.endsAt
            ))
        }
    }

    func end(event: CalendarEvent) async {
        for activity in Activity<CalenderActivityAttributes>.activities where activity.attributes.eventId == event.id.uuidString {
            await activity.end(
                ActivityContent(state: makeContentState(event: event, phaseOverride: "ended"), staleDate: nil),
                dismissalPolicy: .after(Date().addingTimeInterval(20 * 60))
            )
        }
    }

    func registerPushToStartTokenIfAvailable(api: SupabaseAPI, session: SessionStore) async {
        guard #available(iOS 17.2, *), let accessToken = session.accessToken, let userId = session.userId else { return }
        guard !isObservingPushToStart else { return }
        isObservingPushToStart = true

        Task {
            for await token in Activity<CalenderActivityAttributes>.pushToStartTokenUpdates {
                let hexToken = token.map { String(format: "%02.2hhx", $0) }.joined()
                try? await api.upsertDevice(
                    accessToken: accessToken,
                    userId: userId,
                    apnsToken: nil,
                    activityPushToStartToken: hexToken
                )
            }
        }
    }

    private func makeContentState(event: CalendarEvent, phaseOverride: String? = nil) -> CalenderActivityAttributes.ContentState {
        CalenderActivityAttributes.ContentState(
            eventId: event.id.uuidString,
            title: event.title,
            startsAt: ISO8601DateFormatter.supabase.string(from: event.startsAt),
            endsAt: ISO8601DateFormatter.supabase.string(from: event.endsAt),
            phase: phaseOverride ?? phase(for: event),
            urgency: urgency(for: event),
            deepLinkUrl: "calender://events/\(event.id.uuidString)"
        )
    }

    private func phase(for event: CalendarEvent) -> String {
        let now = Date()
        if now >= event.endsAt { return "ended" }
        if now >= event.startsAt { return "in_progress" }
        if event.startsAt.timeIntervalSince(now) <= 60 { return "starting" }
        return "upcoming"
    }

    private func urgency(for event: CalendarEvent) -> String {
        let minutes = event.startsAt.timeIntervalSinceNow / 60
        if minutes <= 1 { return "now" }
        if minutes <= 10 { return "soon" }
        return "calm"
    }
}

enum LiveActivityError: LocalizedError {
    case disabled

    var errorDescription: String? {
        "Live Activities are disabled for this device or app."
    }
}
