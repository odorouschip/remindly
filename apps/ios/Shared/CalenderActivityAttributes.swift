import ActivityKit
import Foundation

struct CalenderActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var eventId: String
        var title: String
        var startsAt: String
        var endsAt: String
        var phase: String
        var urgency: String
        var deepLinkUrl: String
    }

    var eventId: String
    var title: String
}

extension CalenderActivityAttributes.ContentState {
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
