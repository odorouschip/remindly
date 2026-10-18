import Foundation

// App-side models. Mirrors apps/web/lib/calendar/types.ts and the mapping in
// apps/web/lib/calendar/supabaseBackend.ts; keep them in step.

enum EventKind: String, Codable {
    case event, task
}

enum Priority: String, Codable, CaseIterable, Identifiable {
    case low, medium, high
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum RepeatFrequency: String, Codable, CaseIterable, Identifiable {
    case daily, weekly, monthly, yearly
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
    /// "week" in "Every 2 weeks".
    var unit: String {
        switch self {
        case .daily: "day"
        case .weekly: "week"
        case .monthly: "month"
        case .yearly: "year"
        }
    }
}

struct RepeatRule: Hashable {
    var frequency: RepeatFrequency
    var interval: Int = 1
    /// Last day it can repeat; nil repeats forever.
    var until: Day?
}

/// When a task reminds you, counted back from 9:00 AM on the due date.
enum TaskReminder: Hashable, Identifiable {
    case none
    case morningOf
    case thirtyMinutes
    case oneDay
    case oneWeek
    case twoWeeks
    case custom(minutesBeforeNine: Int)

    static let presets: [TaskReminder] = [.none, .morningOf, .thirtyMinutes, .oneDay, .oneWeek, .twoWeeks]
    var id: String { label }

    var label: String {
        switch self {
        case .none: "No reminder"
        case .morningOf: "Morning of (9 AM)"
        case .thirtyMinutes: "30 minutes before"
        case .oneDay: "1 day before"
        case .oneWeek: "1 week before"
        case .twoWeeks: "2 weeks before"
        case .custom: "Custom"
        }
    }

    var minutesBeforeNine: Int? {
        switch self {
        case .none: nil
        case .morningOf: 0
        case .thirtyMinutes: 30
        case .oneDay: 1440
        case .oneWeek: 10080
        case .twoWeeks: 20160
        case .custom(let minutes): minutes
        }
    }

    /// Reminder rows count from midnight of the due date; 9:00 AM is 540 minutes after.
    static let nineAM = 540

    var offsets: [Int] { minutesBeforeNine.map { [$0 - Self.nineAM] } ?? [] }

    init(offsets: [Int]) {
        guard let first = offsets.first else { self = .none; return }
        let minutes = first + Self.nineAM
        self = Self.presets.first { $0.minutesBeforeNine == minutes } ?? .custom(minutesBeforeNine: minutes)
    }
}

/// An event or task as the app works with it.
struct CalendarEvent: Identifiable, Hashable {
    /// Assigned on the device for new events, so inserts and updates use the same id.
    var id = UUID()
    var isSaved = false
    var kind: EventKind = .event
    var title = ""
    var notes = ""
    var location = ""
    var categoryId: UUID?
    var allDay = false
    /// Timed: the start instant. All-day: local midnight of the first day.
    var start: Date
    /// Timed: the end instant. All-day: local midnight of the last day (inclusive).
    var end: Date
    var repeatRule: RepeatRule?
    var priority: Priority = .medium
    var isDone = false
    /// Minutes before the start of each occurrence, as the reminders table stores them.
    var reminderOffsets: [Int] = []
    /// Repeating events: occurrences that were changed or skipped, keyed by the day each would normally fall on.
    var exceptions: [Day: OccurrenceOverride] = [:]

    var isTask: Bool { kind == .task }

    /// Countdown reminders every timed event gets (same as REMINDER_PRESETS_MINUTES on the web).
    static let eventReminderOffsets = [30, 10, 0]

    /// A new timed event, one hour long: at `minute` past midnight on `day` if given,
    /// otherwise the next whole hour (today) or 9 AM.
    static func newEvent(on day: Day, minute: Int? = nil) -> CalendarEvent {
        let calendar = Calendar.current
        let start: Date
        if let minute {
            start = calendar.date(bySettingHour: minute / 60, minute: minute % 60, second: 0, of: day.date()) ?? day.date()
        } else {
            let hour = day == .today ? min(calendar.component(.hour, from: Date()) + 1, 23) : 9
            start = calendar.date(bySettingHour: hour, minute: 0, second: 0, of: day.date()) ?? day.date()
        }
        return CalendarEvent(start: start, end: start.addingTimeInterval(3600))
    }

    static func newTask(on day: Day) -> CalendarEvent {
        CalendarEvent(kind: .task, allDay: true, start: day.date(), end: day.date(), reminderOffsets: TaskReminder.oneDay.offsets)
    }
}

/// One occurrence of a repeating event that was skipped or changed (a row of
/// `event_exceptions`). Nil fields keep the series' value.
struct OccurrenceOverride: Hashable {
    var cancelled = false
    var title: String?
    var notes: String?
    var location: String?
    var categoryId: UUID?
    /// Moved: the new start and end (local midnight of the first and last day when all-day).
    var start: Date?
    var end: Date?

    var isEmpty: Bool { self == OccurrenceOverride() }
}

struct Category: Identifiable, Hashable, Decodable {
    let id: UUID
    var name: String
    var color: CategoryColor
    var sortOrder: Int
}

/// The palette names the database allows (categories.color).
enum CategoryColor: String, Codable, CaseIterable {
    case gray, brown, orange, yellow, green, blue, purple, pink, red
}

// MARK: - Database rows

/// A row of `events` with its reminders embedded (`select=*,reminders(offset_minutes)`).
struct EventRow: Decodable {
    struct ReminderRow: Decodable {
        let offsetMinutes: Int
    }

    let id: UUID
    let kind: EventKind
    let title: String
    let notes: String
    let location: String
    let categoryId: UUID?
    let allDay: Bool
    let startsAt: String?
    let endsAt: String?
    let startDate: Day?
    let endDate: Day?
    let repeatFreq: RepeatFrequency?
    let repeatInterval: Int
    let repeatUntil: Day?
    let priority: Priority?
    let completedAt: String?
    let reminders: [ReminderRow]
    /// Optional so a select without the embed still decodes.
    let eventExceptions: [ExceptionRow]?

    func toEvent() -> CalendarEvent? {
        let start: Date, end: Date
        if allDay {
            guard let startDate, let endDate else { return nil }
            start = startDate.date()
            end = endDate.date()
        } else {
            guard let s = startsAt.flatMap(Timestamp.parse), let e = endsAt.flatMap(Timestamp.parse) else { return nil }
            start = s
            end = e
        }
        return CalendarEvent(
            id: id,
            isSaved: true,
            kind: kind,
            title: title,
            notes: notes,
            location: location,
            categoryId: categoryId,
            allDay: allDay,
            start: start,
            end: end,
            repeatRule: repeatFreq.map { RepeatRule(frequency: $0, interval: repeatInterval, until: repeatUntil) },
            priority: priority ?? .medium,
            isDone: completedAt != nil,
            reminderOffsets: reminders.map(\.offsetMinutes).sorted(by: >),
            exceptions: repeatFreq == nil ? [:] : Dictionary(
                (eventExceptions ?? []).map { ($0.occurrenceDate, $0.toOverride(allDay: allDay, length: end.timeIntervalSince(start))) },
                uniquingKeysWith: { first, _ in first }
            )
        )
    }
}

/// A row of `event_exceptions`. Location and category arrive once the
/// 202610180001 migration is applied (optional until then).
struct ExceptionRow: Decodable {
    let occurrenceDate: Day
    let cancelled: Bool
    let title: String?
    let notes: String?
    let location: String?
    let categoryId: UUID?
    let startsAt: String?
    let endsAt: String?
    let startDate: Day?
    let endDate: Day?

    /// Like occurrence_bounds() in SQL, a moved occurrence without an end keeps the series' length.
    func toOverride(allDay: Bool, length: TimeInterval) -> OccurrenceOverride {
        var x = OccurrenceOverride(cancelled: cancelled, title: title, notes: notes, location: location, categoryId: categoryId)
        if allDay, let startDate {
            x.start = startDate.date()
            x.end = (endDate ?? startDate).date()
        } else if !allDay, let start = startsAt.flatMap(Timestamp.parse) {
            x.start = start
            x.end = endsAt.flatMap(Timestamp.parse) ?? start.addingTimeInterval(length)
        }
        return x
    }
}

/// What gets sent to insert or update an `event_exceptions` row; nulls keep the series value.
func exceptionRow(seriesId: UUID, occurrenceDate: Day, allDay: Bool, _ x: OccurrenceOverride) -> [String: Any] {
    let moved = x.start.flatMap { start in x.end.map { (start, $0) } }
    return [
        "event_id": seriesId.uuidString,
        "occurrence_date": occurrenceDate.description,
        "cancelled": x.cancelled,
        "title": x.title ?? NSNull(),
        "notes": x.notes ?? NSNull(),
        "location": x.location ?? NSNull(),
        "category_id": x.categoryId?.uuidString ?? NSNull(),
        "starts_at": moved.map { allDay ? NSNull() : Timestamp.format($0.0) as Any } ?? NSNull(),
        "ends_at": moved.map { allDay ? NSNull() : Timestamp.format($0.1) as Any } ?? NSNull(),
        "start_date": moved.map { allDay ? Day($0.0).description as Any : NSNull() } ?? NSNull(),
        "end_date": moved.map { allDay ? Day($0.1).description as Any : NSNull() } ?? NSNull(),
    ]
}

/// What gets sent to insert or update an `events` row. Every column is
/// written, nulls included, so switching e.g. timed → all-day clears the old times.
struct EventPayload: Encodable {
    let event: CalendarEvent

    private enum Key: String, CodingKey {
        case id, kind, title, notes, location, categoryId = "category_id", allDay = "all_day"
        case startsAt = "starts_at", endsAt = "ends_at", startDate = "start_date", endDate = "end_date", timezone
        case repeatFreq = "repeat_freq", repeatInterval = "repeat_interval", repeatUntil = "repeat_until"
        case priority, completedAt = "completed_at"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Key.self)
        let e = event
        let allDay = e.isTask || e.allDay
        let trimmed = e.title.trimmingCharacters(in: .whitespacesAndNewlines)
        try c.encode(e.id, forKey: .id)
        try c.encode(e.kind, forKey: .kind)
        try c.encode(trimmed.isEmpty ? (e.isTask ? "Untitled task" : "Untitled event") : trimmed, forKey: .title)
        try c.encode(e.notes, forKey: .notes)
        try c.encode(e.location, forKey: .location)
        try c.encode(e.categoryId, forKey: .categoryId)
        try c.encode(allDay, forKey: .allDay)
        try c.encode(allDay ? nil : Timestamp.format(e.start), forKey: .startsAt)
        try c.encode(allDay ? nil : Timestamp.format(e.end), forKey: .endsAt)
        let firstDay = Day(e.start)
        try c.encode(allDay ? firstDay : nil, forKey: .startDate)
        try c.encode(allDay ? max(firstDay, e.isTask ? firstDay : Day(e.end)) : nil, forKey: .endDate)
        try c.encode(TimeZone.current.identifier, forKey: .timezone)
        let rule = e.isTask ? nil : e.repeatRule
        try c.encode(rule?.frequency, forKey: .repeatFreq)
        try c.encode(rule?.interval ?? 1, forKey: .repeatInterval)
        try c.encode(rule?.until, forKey: .repeatUntil)
        try c.encode(e.isTask ? e.priority : nil, forKey: .priority)
        try c.encode(e.isTask && e.isDone ? Timestamp.format(Date()) : nil, forKey: .completedAt)
    }
}

/// Reminder rows to write for an event, matching the web: tasks get their chosen
/// reminder, timed events the countdown set, all-day events none. A done task
/// keeps its rows (the database skips them) so un-checking it restores the reminder.
func reminderOffsets(for event: CalendarEvent) -> [Int] {
    if event.isTask { return event.reminderOffsets }
    return event.allDay ? [] : CalendarEvent.eventReminderOffsets
}
