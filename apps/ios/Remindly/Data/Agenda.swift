import Foundation

/// The Upcoming list, built once per data change (not on every redraw):
/// overdue tasks, then each of the next few weeks' days with what's on them.
struct Agenda {
    struct DayGroup: Identifiable {
        let day: Day
        let occurrences: [Occurrence]
        var id: Day { day }
    }

    static let daysAhead = 45

    let today: Day
    let overdue: [Occurrence]
    let days: [DayGroup]

    var isEmpty: Bool { overdue.isEmpty && days.isEmpty }

    init(events: [CalendarEvent] = [], today: Day = .today) {
        self.today = today
        overdue = events
            .filter { $0.isTask && !$0.isDone && $0.firstDay < today }
            .map { $0.occurrence(on: $0.firstDay) }
            .sorted { $0.start < $1.start }

        let byDay = Self.byDay(events: events, from: today, to: today.adding(days: Self.daysAhead))
        days = byDay.keys.sorted().map { DayGroup(day: $0, occurrences: byDay[$0]!) }
    }

    /// What's on each day in `from...to`, each day sorted for display.
    /// Multi-day events appear on every day they cover.
    static func byDay(events: [CalendarEvent], from: Day, to: Day) -> [Day: [Occurrence]] {
        var byDay: [Day: [Occurrence]] = [:]
        for event in events {
            for occurrence in event.occurrences(from: from, to: to) {
                var day = max(occurrence.day, from)
                while day <= occurrence.lastDay && day <= to {
                    byDay[day, default: []].append(occurrence)
                    day = day.adding(days: 1)
                }
            }
        }
        for (day, list) in byDay {
            byDay[day] = list.sorted { sortKey($0, on: day) < sortKey($1, on: day) }
        }
        return byDay
    }

    /// All-day items (and the middle days of long events) first, then by when they start that day.
    private static func sortKey(_ occurrence: Occurrence, on day: Day) -> Date {
        if occurrence.event.allDay { return .distantPast }
        switch occurrence.part(on: day) {
        case .middle: return .distantPast
        case .last: return day.date()
        case .only, .first: return occurrence.start
        }
    }
}
