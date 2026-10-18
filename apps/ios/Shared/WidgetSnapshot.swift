import Foundation

/// What the app hands the Home Screen and Lock Screen widgets: overdue tasks and
/// the next two weeks, day by day. The app rewrites it in the App Group container
/// after every sync or change; the widgets only read it.
struct WidgetSnapshot: Codable, Equatable {
    struct Item: Codable, Hashable, Identifiable {
        var eventId: UUID
        var title: String
        var location: String
        var start: Date
        var end: Date
        var allDay: Bool
        var isTask: Bool
        var isDone: Bool
        /// Category palette name; nil when uncategorized.
        var tint: String?
        /// The days this occurrence covers (more than one for multi-day events).
        var firstDay: Day
        var lastDay: Day

        var id: String { "\(eventId)|\(firstDay)" }
        var url: URL { URL(string: "remindly://events/\(eventId.uuidString)")! }

        /// A timed event shorter than a day — what "Up Next" counts down to.
        /// (Longer ones sit in the all-day row in the app, too.)
        var isTimed: Bool { !allDay && !isTask && end.timeIntervalSince(start) < 86_400 }
    }

    struct DayItems: Codable, Equatable {
        var day: Day
        var items: [Item]
    }

    var signedIn: Bool
    /// Unfinished tasks due before the day the snapshot was written.
    var overdue: [Item]
    /// Days with something on them, in order.
    var days: [DayItems]

    static let daysAhead = 14
    static let appGroup = "group.com.odorouschip.Remindly"

    static var fileURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appendingPathComponent("widget-snapshot.json")
    }

    static func read() -> WidgetSnapshot? {
        guard let url = fileURL, let data = try? Data(contentsOf: url) else { return nil }
        return try? decoder.decode(WidgetSnapshot.self, from: data)
    }

    func encoded() throws -> Data { try Self.encoder.encode(self) }

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        e.outputFormatting = .sortedKeys
        return e
    }()
    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}

// MARK: - What to show at a given moment

extension WidgetSnapshot {
    func items(on day: Day) -> [Item] {
        days.first { $0.day == day }?.items ?? []
    }

    /// Unfinished tasks due before `day` (the snapshot's own overdue list plus
    /// any that have gone overdue since it was written).
    func overdue(asOf day: Day) -> [Item] {
        overdue + days.filter { $0.day < day }.flatMap { $0.items.filter { $0.isTask && !$0.isDone } }
    }

    /// Timed events still on or yet to start at `date`, soonest first, each once.
    func upcomingTimed(at date: Date) -> [Item] {
        var seen = Set<String>()
        return days.flatMap(\.items)
            .filter { $0.isTimed && $0.end > date && seen.insert($0.id).inserted }
            .sorted { $0.start < $1.start }
    }

    /// What's left of `day` at `date`: all-day items and tasks, and timed
    /// events that haven't ended yet.
    func remaining(on day: Day, at date: Date) -> [Item] {
        items(on: day).filter { $0.allDay || $0.isTask || $0.end > date }
    }

    /// Moments in `from..<to` when what the widgets show changes: events
    /// starting or ending, and midnight.
    func changeDates(from: Date, to: Date, calendar: Calendar = .current) -> [Date] {
        var dates = Set<Date>()
        for item in days.flatMap(\.items) where !item.allDay && !item.isTask {
            for date in [item.start, item.end] where date > from && date < to { dates.insert(date) }
        }
        var midnight = calendar.startOfDay(for: from)
        while let next = calendar.date(byAdding: .day, value: 1, to: midnight), next < to {
            dates.insert(next)
            midnight = next
        }
        return dates.sorted()
    }
}
