import Foundation

enum RepeatFrequency: String, Codable, CaseIterable, Identifiable {
    case none
    case daily
    case weekly
    case monthly

    var id: String { rawValue }
}

enum ReminderChannel: String, Codable {
    case liveActivity = "live_activity"
    case notification
}

struct CalendarEvent: Codable, Identifiable, Hashable {
    let id: UUID
    let userId: UUID
    var title: String
    var notes: String?
    var startsAt: Date
    var endsAt: Date
    var timezone: String
    var isAllDay: Bool
    var repeatFrequency: RepeatFrequency
    var repeatUntil: Date?
    var isArchived: Bool
    var deletedAt: Date?
    var reminders: [Reminder]?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case title
        case notes
        case startsAt = "starts_at"
        case endsAt = "ends_at"
        case timezone
        case isAllDay = "is_all_day"
        case repeatFrequency = "repeat_frequency"
        case repeatUntil = "repeat_until"
        case isArchived = "is_archived"
        case deletedAt = "deleted_at"
        case reminders
    }
}

struct Reminder: Codable, Identifiable, Hashable {
    let id: UUID
    let eventId: UUID
    let userId: UUID
    var offsetMinutes: Int
    var channel: ReminderChannel
    var dueAt: Date
    var deliveredAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case eventId = "event_id"
        case userId = "user_id"
        case offsetMinutes = "offset_minutes"
        case channel
        case dueAt = "due_at"
        case deliveredAt = "delivered_at"
    }
}

struct EventDraft: Encodable {
    var userId: UUID
    var title: String
    var notes: String?
    var startsAt: Date
    var endsAt: Date
    var timezone: String
    var isAllDay: Bool
    var repeatFrequency: RepeatFrequency
    var repeatUntil: Date?
    var isArchived = false
    var deletedAt: Date? = nil

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case title
        case notes
        case startsAt = "starts_at"
        case endsAt = "ends_at"
        case timezone
        case isAllDay = "is_all_day"
        case repeatFrequency = "repeat_frequency"
        case repeatUntil = "repeat_until"
        case isArchived = "is_archived"
        case deletedAt = "deleted_at"
    }
}

struct ReminderDraft: Encodable {
    var eventId: UUID
    var userId: UUID
    var offsetMinutes: Int
    var channel: ReminderChannel
    var dueAt: Date
    var deliveredAt: Date? = nil

    enum CodingKeys: String, CodingKey {
        case eventId = "event_id"
        case userId = "user_id"
        case offsetMinutes = "offset_minutes"
        case channel
        case dueAt = "due_at"
        case deliveredAt = "delivered_at"
    }
}

struct AuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    let user: AuthUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case user
    }
}

struct AuthUser: Decodable {
    let id: UUID
    let email: String?
}

extension JSONDecoder {
    static var supabase: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601WithFractionalSeconds
        return decoder
    }
}

extension JSONEncoder {
    static var supabase: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601WithFractionalSeconds
        return encoder
    }
}

extension JSONDecoder.DateDecodingStrategy {
    static let iso8601WithFractionalSeconds = custom { decoder in
        let container = try decoder.singleValueContainer()
        let value = try container.decode(String.self)
        if let date = ISO8601DateFormatter.supabase.date(from: value) {
            return date
        }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO8601 date: \(value)")
    }
}

extension JSONEncoder.DateEncodingStrategy {
    static let iso8601WithFractionalSeconds = custom { date, encoder in
        var container = encoder.singleValueContainer()
        try container.encode(ISO8601DateFormatter.supabase.string(from: date))
    }
}
