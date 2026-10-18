import Foundation

// Editing one occurrence of a repeating event ("This event" / "All events").
// Port of apps/web/lib/calendar/occurrenceEdits.ts; keep them in step.

/// How much of a repeating event a save or delete applies to.
enum OccurrenceScope {
    case this, following, all
}

extension CalendarEvent {
    /// An occurrence as the editor shows it: its own title, times and so on, with the series' id and repeat rule.
    init(editing occurrence: Occurrence) {
        self = occurrence.event
        start = occurrence.start
        end = occurrence.end
    }

    /// Changes that only make sense for the whole series, so the editor doesn't ask which occurrences.
    func changesSeriesOnly(from before: CalendarEvent) -> Bool {
        repeatRule != before.repeatRule || allDay != before.allDay || kind != before.kind
    }

    /// Whether saving this over `before` changes anything at all.
    func hasChanges(from before: CalendarEvent) -> Bool {
        changesSeriesOnly(from: before)
            || title != before.title || notes != before.notes || location != before.location
            || categoryId != before.categoryId || start != before.start || end != before.end
    }

    /// What to store so this series' occurrence on `day` looks like `edited`
    /// ("This event"). Nil when it matches the series again, so the exception
    /// can go. An occurrence can't drop the series' category: a nil override
    /// means "same as the series".
    func override(on day: Day, toMatch edited: CalendarEvent) -> OccurrenceOverride? {
        let natural = naturalOccurrence(on: day)
        var x = OccurrenceOverride()
        if edited.title != title { x.title = edited.title }
        if edited.notes != notes { x.notes = edited.notes }
        if edited.location != location { x.location = edited.location }
        if let category = edited.categoryId, category != categoryId { x.categoryId = category }
        if edited.start != natural.start || edited.end != natural.end {
            x.start = edited.start
            x.end = edited.end
        }
        return x.isEmpty ? nil : x
    }

    /// Applies an edit made while looking at one occurrence (`shown`) to the
    /// whole series ("All events"). Field changes carry over; moving the
    /// occurrence by N days moves every occurrence by N days; times of day are
    /// taken as edited.
    func applying(_ edited: CalendarEvent, shownAs shown: CalendarEvent, calendar: Calendar = .current) -> CalendarEvent {
        let first = firstDay.adding(days: Day(shown.start).days(until: Day(edited.start)), calendar: calendar)
        var series = edited
        series.id = id
        series.isSaved = isSaved
        series.exceptions = exceptions
        if edited.allDay || edited.isTask {
            series.start = first.date(calendar)
            series.end = first.adding(days: Day(edited.start).days(until: Day(edited.end)), calendar: calendar).date(calendar)
        } else {
            let time = calendar.dateComponents([.hour, .minute], from: edited.start)
            series.start = calendar.date(bySettingHour: time.hour ?? 0, minute: time.minute ?? 0, second: 0, of: first.date(calendar)) ?? first.date(calendar)
            series.end = series.start.addingTimeInterval(edited.end.timeIntervalSince(edited.start))
        }
        return series
    }

    /// The series stopped before its occurrence on `day` ("This and following
    /// events"). Nil when that's the first occurrence — delete it all instead.
    func endingBefore(_ day: Day) -> CalendarEvent? {
        guard day > firstDay, repeatRule != nil else { return nil }
        var series = self
        series.repeatRule?.until = day.adding(days: -1)
        return series
    }
}
