import Foundation

// Port of apps/web/lib/calendar/recurrence.ts (and public.next_reminder() in
// the v2 migration). Repeats keep their local wall-clock time across DST, and
// monthly/yearly repeats skip months without the start's day (the 31st, Feb 29).

/// One occurrence of an event. Repeating events have one per repeat.
struct Occurrence: Identifiable, Hashable {
    let event: CalendarEvent
    /// The day this occurrence starts.
    let day: Day
    let start: Date
    let end: Date

    var id: String { "\(event.id)|\(day)" }
    /// The last day it covers (later than `day` for multi-day events). A timed
    /// event ending at midnight doesn't reach into that day.
    var lastDay: Day { event.allDay ? Day(end) : max(day, Day(end.addingTimeInterval(-1))) }

    enum Part { case only, first, middle, last }

    /// Which day of a multi-day occurrence `shown` is.
    func part(on shown: Day) -> Part {
        if day == lastDay { return .only }
        if shown <= day { return .first }
        return shown >= lastDay ? .last : .middle
    }
}

extension CalendarEvent {
    var firstDay: Day { Day(start) }

    /// Days covered after the first one (0 for single-day events).
    var extraDays: Int {
        allDay ? max(0, firstDay.days(until: Day(end))) : max(0, firstDay.days(until: Day(end.addingTimeInterval(-1))))
    }

    /// Occurrences that overlap the days `from...to`.
    func occurrences(from: Day, to: Day, calendar: Calendar = .current) -> [Occurrence] {
        guard let rule = repeatRule else {
            let occurrence = Occurrence(event: self, day: firstDay, start: start, end: end)
            return occurrence.day <= to && occurrence.lastDay >= from ? [occurrence] : []
        }
        // Start early enough to catch a multi-day occurrence already underway.
        let earliest = from.adding(days: -extraDays, calendar: calendar)
        let last = rule.until.map { min($0, to) } ?? to
        return repeatDays(rule, from: earliest, to: last, calendar: calendar).map { occurrence(on: $0, calendar: calendar) }
    }

    func occurrence(on day: Day, calendar: Calendar = .current) -> Occurrence {
        if allDay {
            let start = day.date(calendar)
            return Occurrence(event: self, day: day, start: start, end: day.adding(days: extraDays, calendar: calendar).date(calendar))
        }
        let time = calendar.dateComponents([.hour, .minute, .second], from: start)
        let occurrenceStart = calendar.date(
            bySettingHour: time.hour ?? 0, minute: time.minute ?? 0, second: time.second ?? 0, of: day.date(calendar)
        ) ?? day.date(calendar)
        return Occurrence(event: self, day: day, start: occurrenceStart, end: occurrenceStart.addingTimeInterval(end.timeIntervalSince(start)))
    }

    private func repeatDays(_ rule: RepeatRule, from: Day, to: Day, calendar: Calendar) -> [Day] {
        guard from <= to else { return [] }
        let every = max(1, rule.interval)
        var days: [Day] = []

        switch rule.frequency {
        case .daily, .weekly:
            let step = (rule.frequency == .daily ? 1 : 7) * every
            // Jump straight to the first occurrence on or after `from`.
            let gap = firstDay.days(until: from, calendar: calendar)
            var i = max(0, Int((Double(gap) / Double(step)).rounded(.up)))
            while true {
                let day = firstDay.adding(days: i * step, calendar: calendar)
                if day > to { break }
                days.append(day)
                i += 1
            }

        case .monthly, .yearly:
            let stepMonths = (rule.frequency == .monthly ? 1 : 12) * every
            let base = firstDay.date(calendar)
            // Cap the loop so a corrupt rule can't spin forever (≈ 800 years of months).
            for i in 0..<10_000 {
                guard let date = calendar.date(byAdding: .month, value: i * stepMonths, to: base) else { break }
                let day = Day(date, calendar: calendar)
                if day > to { break }
                // Adding months clamps (Jan 31 + 1 month = Feb 28); skip those.
                if day.day == firstDay.day && day >= from { days.append(day) }
            }
        }
        return days
    }
}
