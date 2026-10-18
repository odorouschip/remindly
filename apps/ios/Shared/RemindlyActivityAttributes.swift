import ActivityKit
import Foundation

struct RemindlyActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var eventId: String
        var title: String
        var startsAt: String
        var endsAt: String
        var phase: String
        var urgency: String
        var deepLinkUrl: String
        /// Category palette name (e.g. "blue"). Optional so server pushes without it still decode.
        var tint: String?
    }

    var eventId: String
    var title: String
}

extension RemindlyActivityAttributes.ContentState {
    var startsAtDate: Date {
        ISO8601DateFormatter.supabase.date(from: startsAt) ?? Date()
    }

    var endsAtDate: Date {
        ISO8601DateFormatter.supabase.date(from: endsAt) ?? Date()
    }
}

extension ISO8601DateFormatter {
    static let supabase: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
