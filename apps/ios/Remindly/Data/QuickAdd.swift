import Foundation

// Port of apps/web/lib/calendar/quickAdd.ts — keep the two in step (the same
// test phrases run against both). Turns "lunch with Sam fri at noon #social"
// into an event draft with plain pattern matching: instant and predictable.
// Anything it doesn't recognize stays in the title.

struct QuickAdd: Equatable {
    var title: String
    var day: Day
    /// False when the day is just the default (today, or tomorrow if the time has passed).
    var dateMentioned: Bool
    /// Minutes since midnight; nil for all-day.
    var startMinutes: Int?
    var endMinutes: Int?
    var repeatRule: RepeatRule?
    var isTask: Bool
    /// Set when a #tag matched one of the user's categories.
    var categoryId: UUID?

    var allDay: Bool { startMinutes == nil }

    /// The draft to save, or to open in the editor.
    func toEvent(calendar: Calendar = .current) -> CalendarEvent {
        if isTask {
            var task = CalendarEvent.newTask(on: day)
            task.title = title
            task.categoryId = categoryId
            return task
        }
        var event = CalendarEvent(start: day.date(calendar), end: day.date(calendar))
        event.title = title
        event.categoryId = categoryId
        event.repeatRule = repeatRule
        if let startMinutes, let endMinutes {
            // Through the calendar (not +seconds) so DST days keep their wall-clock times.
            let midnight = day.date(calendar)
            event.start = calendar.date(bySettingHour: startMinutes / 60, minute: startMinutes % 60, second: 0, of: midnight) ?? midnight
            event.end = calendar.date(bySettingHour: endMinutes / 60, minute: endMinutes % 60, second: 0, of: midnight) ?? midnight
        } else {
            event.allDay = true
        }
        return event
    }
}

enum QuickAddParser {
    private static let weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    private static let months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

    // "sun", "sat" and "wed" are ordinary words, so short forms of those only count after on/next/this/every.
    private static let wdFull = "sunday|monday|tuesday|wednesday|thursday|friday|saturday"
    private static let wdSafeShort = "mon|tues?|thu(?:rs?)?|fri"
    private static let wdAnyShort = "sun|mon|tues?|wed|thu(?:rs?)?|fri|sat"
    private static let monthPattern = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
    // A clock time: 3, 3pm, 3:30, 3:30 p.m. — never part of a date like 10/20.
    private static let time = #"(?<![\d/:])(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|a|p)?(?![\d/:])"#

    private static let numberWords = ["a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "other": 2]

    /// "Side project" and #sideproject / #side-project all compare equal.
    private static func tagKey(_ s: String) -> String {
        String(s.lowercased().unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) })
    }

    private static func weekdayIndex(_ word: String) -> Int {
        let prefix = word.prefix(3).lowercased()
        return weekdays.firstIndex { $0.hasPrefix(prefix) } ?? 0
    }

    private static func monthIndex(_ word: String) -> Int {
        months.firstIndex(of: word.prefix(3).lowercased()) ?? 0
    }

    /// Minutes since midnight, or nil when the hour/minute aren't a real clock time.
    private static func toMinutes(_ hourText: String, _ minuteText: String?, _ meridiem: String?, inferPM: Bool) -> Int? {
        guard var hour = Int(hourText) else { return nil }
        let minute = minuteText.flatMap(Int.init) ?? 0
        if minute > 59 { return nil }
        if let mer = meridiem?.first?.lowercased() {
            if hour < 1 || hour > 12 { return nil }
            if mer == "p" && hour != 12 { hour += 12 }
            if mer == "a" && hour == 12 { hour = 0 }
        } else {
            if hour > 23 { return nil }
            // "at 3" almost always means the afternoon.
            if inferPM && (1...7).contains(hour) { hour += 12 }
        }
        return hour * 60 + minute
    }

    static func parse(_ input: String, now: Date = Date(), categories: [Category] = [], calendar: Calendar = .current) -> QuickAdd {
        let today = Day(now, calendar: calendar)
        var rest = " \(input) "

        /// Removes the first match of `pattern` that `use` accepts.
        func take(_ pattern: String, _ use: ([String?]) -> Bool) {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
                assertionFailure("Bad pattern: \(pattern)")
                return
            }
            let text = rest as NSString
            for match in regex.matches(in: rest, range: NSRange(location: 0, length: text.length)) {
                let groups: [String?] = (0..<match.numberOfRanges).map { i in
                    let range = match.range(at: i)
                    return range.location == NSNotFound ? nil : text.substring(with: range)
                }
                if use(groups) {
                    rest = text.replacingCharacters(in: match.range, with: " ")
                    return
                }
            }
        }

        func nextWeekday(_ weekday: Int, strictlyAfter: Bool) -> Day {
            var diff = (weekday - today.weekday(calendar: calendar) + 7) % 7
            if diff == 0 && strictlyAfter { diff = 7 }
            return today.adding(days: diff, calendar: calendar)
        }

        /// A month/day with no year means the next time that date comes around.
        /// `month` is 0-based and may run past December.
        func upcoming(month: Int, day: Int, year: Int? = nil) -> Day? {
            let baseYear = year ?? today.year
            let candidate = Day(year: baseYear + month / 12, month: month % 12 + 1, day: day)
            // Reject dates that don't exist, like Feb 31.
            guard Day(candidate.date(calendar), calendar: calendar) == candidate else { return nil }
            if year == nil && candidate < today {
                let next = Day(year: candidate.year + 1, month: candidate.month, day: day)
                return Day(next.date(calendar), calendar: calendar) == next ? next : nil
            }
            return candidate
        }

        var isTask = false
        var categoryId: UUID?
        var frequency: RepeatFrequency?
        var interval = 1
        var date: Day?
        var start: Int?
        var end: Int?
        var duration: Int?
        var allDayWord = false
        var tonight = false

        take(#"^\s*(?:task|todo)\s*:\s*"#) { _ in isTask = true; return true }
        take(#"^\s*remind me to\s+"#) { _ in isTask = true; return true }
        take(#"(?:^|\s)#([\p{L}\p{N}_-]+)"#) { g in
            guard let tag = g[1], let match = categories.first(where: { tagKey($0.name) == tagKey(tag) }) else {
                return false // unknown tags stay in the title
            }
            categoryId = match.id
            return true
        }

        // Repeats. "every other X" / "every 3 Xs" set an interval.
        let everyN = #"every\s+(?:(other|\d{1,2}|two|three|four|five|six)\s+)?"#
        func intervalFrom(_ word: String?) -> Int {
            guard let word else { return 1 }
            return numberWords[word.lowercased()] ?? Int(word) ?? 1
        }
        take(#"\b\#(everyN)(\#(wdFull)|\#(wdAnyShort))s?\b"#) { g in
            frequency = .weekly
            interval = intervalFrom(g[1])
            date = nextWeekday(weekdayIndex(g[2]!), strictlyAfter: false)
            return true
        }
        take(#"\b\#(everyN)(day|week|month|year)s?\b"#) { g in
            switch g[2]!.lowercased() {
            case "day": frequency = .daily
            case "week": frequency = .weekly
            case "month": frequency = .monthly
            default: frequency = .yearly
            }
            interval = intervalFrom(g[1])
            return true
        }
        take(#"\bbiweekly\b"#) { _ in frequency = .weekly; interval = 2; return true }
        take(#"\bdaily\b"#) { _ in frequency = .daily; return true }
        take(#"\bweekly\b"#) { _ in frequency = .weekly; return true }
        take(#"\bmonthly\b"#) { _ in frequency = .monthly; return true }
        take(#"\b(?:yearly|annually)\b"#) { _ in frequency = .yearly; return true }

        take(#"\ball[- ]day\b"#) { _ in allDayWord = true; return true }

        // Times: a range first ("3-4pm", "from 10 to 11:30"), then a single time.
        take(#"(\b(?:from|at)\s+)?\#(time)\s*(?:-|–|to|until|till)\s*\#(time)"#) { g in
            let (prefix, h1, m1, mer1, h2, m2, mer2) = (g[1], g[2]!, g[3], g[4], g[5]!, g[6], g[7])
            if prefix == nil && mer1 == nil && mer2 == nil && m1 == nil && m2 == nil { return false } // "2-3 people"
            guard var s = toMinutes(h1, m1, mer1, inferPM: false), let e = toMinutes(h2, m2, mer2, inferPM: mer2 == nil) else {
                return false
            }
            // "3-4pm": the start borrows the end's am/pm unless that would put it after the end.
            if mer1 == nil && mer2 != nil {
                if let borrowed = toMinutes(h1, m1, mer2, inferPM: false), borrowed < e { s = borrowed }
            } else if mer1 == nil && mer2 == nil {
                s = toMinutes(h1, m1, nil, inferPM: true) ?? s
            }
            start = s
            end = e
            return true
        }
        if start == nil {
            take(#"\b(?:at\s+)?(noon|midday|midnight)\b"#) { g in
                start = g[1]!.lowercased() == "midnight" ? 0 : 720
                return true
            }
        }
        if start == nil {
            take(#"(\bat\s+)?\#(time)"#) { g in
                let (at, h, minute, mer) = (g[1], g[2]!, g[3], g[4])
                if at == nil && mer == nil && minute == nil { return false } // a bare number is part of the title
                guard let t = toMinutes(h, minute, mer, inferPM: true) else { return false }
                start = t
                return true
            }
        }
        take(#"\bfor\s+(\d+(?:\.\d+)?|an?|half an?)\s*(h|hrs?|hours?|m|mins?|minutes?)\b"#) { g in
            let amountText = g[1]!.lowercased()
            let amount = amountText.hasPrefix("half") ? 0.5 : numberWords[amountText].map(Double.init) ?? Double(amountText) ?? 0
            duration = Int((amount * (g[2]!.lowercased().hasPrefix("h") ? 60 : 1)).rounded())
            return true
        }

        // Dates
        take(#"\btonight\b"#) { _ in date = today; tonight = true; return true }
        take(#"\b(?:on\s+)?today\b"#) { _ in date = today; return true }
        take(#"\b(?:on\s+)?(?:tomorrow|tmrw|tmr)\b"#) { _ in date = today.adding(days: 1, calendar: calendar); return true }
        take(#"\bin\s+(\d+|a|an|one|two|three|four|five|six)\s+(days?|weeks?|months?)\b"#) { g in
            let n = numberWords[g[1]!.lowercased()] ?? Int(g[1]!) ?? 0
            let unit = g[2]!.lowercased()
            date = unit.hasPrefix("d") ? today.adding(days: n, calendar: calendar)
                : unit.hasPrefix("w") ? today.adding(days: n * 7, calendar: calendar)
                : today.addingMonths(n, calendar: calendar)
            return true
        }
        take(#"\b(?:on\s+)?(?:(next|this)\s+)?(\#(wdFull)|\#(wdSafeShort))\b"#) { g in
            date = nextWeekday(weekdayIndex(g[2]!), strictlyAfter: g[1]?.lowercased() == "next")
            return true
        }
        take(#"\b(on|next|this)\s+(\#(wdAnyShort))\b"#) { g in
            date = nextWeekday(weekdayIndex(g[2]!), strictlyAfter: g[1]!.lowercased() == "next")
            return true
        }
        take(#"\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(\#(monthPattern))\b"#) { g in
            guard let d = upcoming(month: monthIndex(g[2]!), day: Int(g[1]!)!) else { return false }
            date = d
            return true
        }
        take(#"\b(?:on\s+)?(\#(monthPattern))\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?"#) { g in
            guard let d = upcoming(month: monthIndex(g[1]!), day: Int(g[2]!)!, year: g[3].flatMap(Int.init)) else { return false }
            date = d
            return true
        }
        take(#"\b(?:on\s+)?(\d{1,2})/(\d{1,2})(?:/(\d{2}|\d{4}))?\b"#) { g in
            let year = g[3].map { $0.count == 2 ? 2000 + Int($0)! : Int($0)! }
            guard let month = Int(g[1]!), month >= 1, let d = upcoming(month: month - 1, day: Int(g[2]!)!, year: year) else { return false }
            date = d
            return true
        }
        take(#"\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b"#) { g in
            // This month if it's still ahead, otherwise next month (not next year).
            let day = Int(g[1]!)!
            for offset in 0...1 {
                let month = today.startOfMonth.addingMonths(offset, calendar: calendar)
                let candidate = Day(year: month.year, month: month.month, day: day)
                if Day(candidate.date(calendar), calendar: calendar) == candidate && candidate >= today {
                    date = candidate
                    return true
                }
            }
            return false
        }

        if tonight && start == nil { start = 19 * 60 }

        // Whatever is left is the title, minus connecting words stranded at the edges.
        let edge = #"^(?:on|at|from|for|in|by|this|next|every|and|,|-|–)\s+|\s+(?:on|at|from|for|in|by|this|next|every|and|,|-|–)$"#
        var title = rest.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces)
        var previous = ""
        while previous != title {
            previous = title
            title = title.replacingOccurrences(of: edge, with: "", options: [.regularExpression, .caseInsensitive]).trimmingCharacters(in: .whitespaces)
        }
        if title.range(of: #"^(?:on|at|from|for|in|by|this|next|every|and)$"#, options: [.regularExpression, .caseInsensitive]) != nil {
            title = ""
        }
        title = title.prefix(1).uppercased() + title.dropFirst()

        let dateMentioned = date != nil
        var finalDay = date ?? today
        // "gym at 7am" typed at 9pm means tomorrow.
        if !dateMentioned, let start, !isTask {
            let c = calendar.dateComponents([.hour, .minute], from: now)
            if start <= (c.hour ?? 0) * 60 + (c.minute ?? 0) { finalDay = today.adding(days: 1, calendar: calendar) }
        }

        var startMinutes: Int?
        var endMinutes: Int?
        if !isTask && !allDayWord, let start {
            startMinutes = start
            let natural = end ?? start + (duration ?? 60)
            // Past midnight (e.g. "11pm-1am") stops at the end of the day.
            endMinutes = natural > start ? min(natural, 24 * 60 - 1) : 24 * 60 - 1
        }

        return QuickAdd(
            title: title,
            day: finalDay,
            dateMentioned: dateMentioned,
            startMinutes: startMinutes,
            endMinutes: endMinutes,
            repeatRule: isTask ? nil : frequency.map { RepeatRule(frequency: $0, interval: interval) },
            isTask: isTask,
            categoryId: categoryId
        )
    }
}
