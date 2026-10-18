import Foundation

/// Where a week's occurrences go in the week view. Like the web's week view,
/// all-day items, tasks and anything lasting 24 hours or more sit in the
/// all-day rows (here as bars across the days they cover); shorter events are
/// blocks on each day's timeline, with overnight ones split at midnight.
/// Blocks that overlap share the column side by side.
struct WeekLayout {
    /// A bar in the all-day rows, spanning `firstColumn...lastColumn`.
    struct Bar: Identifiable {
        let occurrence: Occurrence
        let firstColumn: Int
        let lastColumn: Int
        let row: Int
        var id: String { occurrence.id }
    }

    /// A block on one day's timeline. Minutes are local wall-clock time, 0...1440.
    struct Block: Identifiable {
        let occurrence: Occurrence
        let column: Int
        let part: Occurrence.Part
        let startMinute: Int
        let endMinute: Int
        /// Side-by-side position among the blocks it overlaps.
        var lane = 0
        var lanes = 1
        var id: String { "\(occurrence.id)|\(column)" }
    }

    static let dayMinutes = 1440
    /// Blocks are drawn at least this tall, so lanes treat them as at least this long.
    static let minimumMinutes = 30

    let days: [Day]
    let bars: [Bar]
    let rowCount: Int
    let blocks: [Block]

    init(days: [Day], occurrences: [Occurrence], calendar: Calendar = .current) {
        self.days = days
        guard let first = days.first, let last = days.last else {
            bars = []; rowCount = 0; blocks = []
            return
        }
        let column = { (day: Day) in first.days(until: day, calendar: calendar) }

        var long: [Occurrence] = []
        var blocks: [Block] = []
        for occurrence in occurrences {
            if Self.isAllDayRow(occurrence) {
                long.append(occurrence)
                continue
            }
            var day = max(occurrence.day, first)
            while day <= occurrence.lastDay && day <= last {
                let part = occurrence.part(on: day)
                let starts = part == .only || part == .first
                let ends = part == .only || part == .last
                let start = starts ? Self.minuteOfDay(occurrence.start, calendar: calendar) : 0
                // Ending at midnight the next day draws to the bottom of the column.
                var end = ends && Day(occurrence.end, calendar: calendar) == day ? Self.minuteOfDay(occurrence.end, calendar: calendar) : Self.dayMinutes
                if end <= start { end = Self.dayMinutes }
                blocks.append(Block(occurrence: occurrence, column: column(day), part: part, startMinute: start, endMinute: end))
                day = day.adding(days: 1, calendar: calendar)
            }
        }
        self.blocks = Self.assignLanes(blocks)

        // Longest first, so bars that start together stack predictably.
        long.sort {
            let a = (max($0.day, first), -$0.day.days(until: $0.lastDay), $0.event.isTask ? 1 : 0, $0.event.title)
            let b = (max($1.day, first), -$1.day.days(until: $1.lastDay), $1.event.isTask ? 1 : 0, $1.event.title)
            return a < b
        }
        var rowEnds: [Int] = []
        var bars: [Bar] = []
        for occurrence in long {
            let from = column(max(occurrence.day, first))
            let to = column(min(occurrence.lastDay, last))
            let row = rowEnds.firstIndex { $0 < from } ?? rowEnds.count
            if row == rowEnds.count { rowEnds.append(to) } else { rowEnds[row] = to }
            bars.append(Bar(occurrence: occurrence, firstColumn: from, lastColumn: to, row: row))
        }
        self.bars = bars
        rowCount = rowEnds.count
    }

    /// All-day items, tasks and timed events lasting a full day or more.
    static func isAllDayRow(_ occurrence: Occurrence) -> Bool {
        occurrence.event.allDay || occurrence.event.isTask || occurrence.end.timeIntervalSince(occurrence.start) >= 86_400
    }

    static func minuteOfDay(_ date: Date, calendar: Calendar = .current) -> Int {
        let time = calendar.dateComponents([.hour, .minute], from: date)
        return (time.hour ?? 0) * 60 + (time.minute ?? 0)
    }

    /// Bars in `row` that cover `column` — used to count what's hidden when the rows are collapsed.
    func bars(covering column: Int, fromRow row: Int) -> [Bar] {
        bars.filter { $0.row >= row && $0.firstColumn <= column && column <= $0.lastColumn }
    }

    /// Splits each day's overlapping blocks into side-by-side lanes. Blocks that
    /// overlap one another (directly or through a chain) share a lane count.
    private static func assignLanes(_ blocks: [Block]) -> [Block] {
        var result: [Block] = []
        for column in Set(blocks.map(\.column)).sorted() {
            let sorted = blocks.filter { $0.column == column }.sorted {
                ($0.startMinute, -$0.endMinute, $0.occurrence.event.title) < ($1.startMinute, -$1.endMinute, $1.occurrence.event.title)
            }
            var group: [Block] = []
            var laneEnds: [Int] = []
            var groupEnd = 0

            func finishGroup() {
                result += group.map { var b = $0; b.lanes = laneEnds.count; return b }
                group = []
                laneEnds = []
            }

            for var block in sorted {
                let end = max(block.endMinute, block.startMinute + minimumMinutes)
                if !group.isEmpty && block.startMinute >= groupEnd { finishGroup() }
                let lane = laneEnds.firstIndex { $0 <= block.startMinute } ?? laneEnds.count
                if lane == laneEnds.count { laneEnds.append(end) } else { laneEnds[lane] = end }
                block.lane = lane
                group.append(block)
                groupEnd = group.count == 1 ? end : max(groupEnd, end)
            }
            finishGroup()
        }
        return result
    }
}

extension Day {
    /// The first day of this day's week, going by the user's first weekday.
    func startOfWeek(calendar: Calendar = .current) -> Day {
        adding(days: -((weekday(calendar: calendar) - (calendar.firstWeekday - 1) + 7) % 7), calendar: calendar)
    }
}
