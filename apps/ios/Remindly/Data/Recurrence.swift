import Foundation

// Port of apps/web/lib/calendar/recurrence.ts (and public.next_reminder() in
// the v2 migration). Repeats keep their local wall-clock time across DST, and
// monthly/yearly repeats skip months without the start's day (the 31st, Feb 29).

/// One occurrence of an event. Repeating events have one per repeat, with any
/// change made to just that occurrence already applied to `event`.
struct Occurrence: Identifiable, Hashable {
    let event: CalendarEvent
    /// The day it would normally fall on — identifies it even after it's been moved.
    let occurrenceDate: Day
    /// The day this occurrence starts.
    let day: Day
    let start: Date
    let end: Date

    var id: String { "\(event.id)|\(occurrenceDate)" }
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

    /// Occurrences that overlap the days `from...to`, skipped and changed ones applied.
    /// A repeating task shows once, at its current due date; checking it off moves it on (`nextDue`).
    func occurrences(from: Day, to: Day, calendar: Calendar = .current) -> [Occurrence] {
        guard let rule = repeatRule, !isTask else {
            let occurrence = Occurrence(event: self, occurrenceDate: firstDay, day: firstDay, start: start, end: end)
            return occurrence.day <= to && occurrence.lastDay >= from ? [occurrence] : []
        }
        // Start early enough to catch a multi-day occurrence already underway.
        let earliest = from.adding(days: -extraDays, calendar: calendar)
        let last = rule.until.map { min($0, to) } ?? to
        var result = repeatDays(rule, from: earliest, to: last, calendar: calendar).compactMap { day -> Occurrence? in
            // Skipped, or moved (added below).
            if let x = exceptions[day], x.cancelled || x.start != nil { return nil }
            return occurrence(on: day, calendar: calendar)
        }
        // A moved occurrence can land in the range from anywhere.
        for (day, x) in exceptions where !x.cancelled && x.start != nil && isRepeatDay(day, calendar: calendar) {
            let moved = occurrence(on: day, calendar: calendar)
            if moved.day <= to && moved.lastDay >= from { result.append(moved) }
        }
        return result
    }

    /// The occurrence that normally falls on `day`, with its exception (if any) applied.
    func occurrence(on day: Day, calendar: Calendar = .current) -> Occurrence {
        let natural = naturalOccurrence(on: day, calendar: calendar)
        guard let x = exceptions[day] else { return natural }
        var event = self
        if let title = x.title { event.title = title }
        if let notes = x.notes { event.notes = notes }
        if let location = x.location { event.location = location }
        if let categoryId = x.categoryId { event.categoryId = categoryId }
        let start = x.start ?? natural.start, end = x.end ?? natural.end
        return Occurrence(event: event, occurrenceDate: day, day: Day(start, calendar: calendar), start: start, end: end)
    }

    /// The occurrence on `day` as the series alone would have it.
    func naturalOccurrence(on day: Day, calendar: Calendar = .current) -> Occurrence {
        if allDay {
            let start = day.date(calendar)
            return Occurrence(event: self, occurrenceDate: day, day: day, start: start, end: day.adding(days: extraDays, calendar: calendar).date(calendar))
        }
        let time = calendar.dateComponents([.hour, .minute, .second], from: start)
        let occurrenceStart = calendar.date(
            bySettingHour: time.hour ?? 0, minute: time.minute ?? 0, second: time.second ?? 0, of: day.date(calendar)
        ) ?? day.date(calendar)
        return Occurrence(event: self, occurrenceDate: day, day: day, start: occurrenceStart, end: occurrenceStart.addingTimeInterval(end.timeIntervalSince(start)))
    }

    /// Where a repeating task moves when it's checked off, like Google Tasks: its
    /// first repeat after both its current due date and `today`. Nil when the
    /// repeat has ended, so the task is simply done.
    func nextDue(after today: Day, calendar: Calendar = .current) -> Day? {
        guard let rule = repeatRule else { return nil }
        let from = max(firstDay, today).adding(days: 1, calendar: calendar)
        // Twelve periods covers months without the start's day (the 31st) and Feb 29 (every 4 years).
        let period = switch rule.frequency {
        case .daily: 1
        case .weekly: 7
        case .monthly: 31
        case .yearly: 366
        }
        let window = from.adding(days: 12 * period * max(1, rule.interval), calendar: calendar)
        return repeatDays(rule, from: from, to: rule.until.map { min($0, window) } ?? window, calendar: calendar).first
    }

    /// Whether the series has an occurrence on `day` (before any exceptions).
    func isRepeatDay(_ day: Day, calendar: Calendar = .current) -> Bool {
        guard let rule = repeatRule, day >= firstDay, rule.until.map({ day <= $0 }) ?? true else { return false }
        return repeatDays(rule, from: day, to: day, calendar: calendar) == [day]
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
