import Foundation

/// A calendar day with no time or zone ("2026-10-17"), like the database's `date` type.
struct Day: Hashable, Comparable, Codable, CustomStringConvertible {
    let year: Int
    let month: Int
    let day: Int

    init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    /// The local day `date` falls on.
    init(_ date: Date, calendar: Calendar = .current) {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        self.init(year: c.year ?? 1970, month: c.month ?? 1, day: c.day ?? 1)
    }

    /// Parses "YYYY-MM-DD" (anything after the first 10 characters is ignored).
    init?(string: String) {
        let parts = string.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        self.init(year: parts[0], month: parts[1], day: parts[2])
    }

    static var today: Day { Day(Date()) }

    var description: String { String(format: "%04d-%02d-%02d", year, month, day) }

    /// Local midnight at the start of this day.
    func date(_ calendar: Calendar = .current) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day)) ?? Date(timeIntervalSince1970: 0)
    }

    func adding(days: Int, calendar: Calendar = .current) -> Day {
        Day(calendar.date(byAdding: .day, value: days, to: date(calendar)) ?? date(calendar), calendar: calendar)
    }

    /// Whole days from this day to `other` (negative if `other` is earlier).
    func days(until other: Day, calendar: Calendar = .current) -> Int {
        calendar.dateComponents([.day], from: date(calendar), to: other.date(calendar)).day ?? 0
    }

    static func < (lhs: Day, rhs: Day) -> Bool {
        (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try container.decode(String.self)
        guard let day = Day(string: raw) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date: \(raw)")
        }
        self = day
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(description)
    }
}

/// Postgres `timestamptz` values as PostgREST sends them, e.g.
/// "2026-10-17T22:36:31.045731+00:00" or "2026-11-02T14:00:00+00:00".
enum Timestamp {
    private static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parse(_ string: String) -> Date? {
        // ISO8601DateFormatter only reads up to milliseconds; Postgres sends microseconds.
        let trimmed = string.replacingOccurrences(of: #"(\.\d{3})\d+"#, with: "$1", options: .regularExpression)
        return withFraction.date(from: trimmed) ?? plain.date(from: trimmed)
    }

    static func format(_ date: Date) -> String {
        plain.string(from: date)
    }
}

extension Day {
    /// The first day of this day's month.
    var startOfMonth: Day { Day(year: year, month: month, day: 1) }

    func addingMonths(_ months: Int, calendar: Calendar = .current) -> Day {
        Day(calendar.date(byAdding: .month, value: months, to: date(calendar)) ?? date(calendar), calendar: calendar)
    }

    /// 0 = Sunday … 6 = Saturday.
    func weekday(calendar: Calendar = .current) -> Int {
        calendar.component(.weekday, from: date(calendar)) - 1
    }
}
