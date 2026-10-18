import SwiftUI
import WidgetKit

// The Home Screen / Lock Screen widget views. They live in Shared so the app's
// debug widget gallery (`-widgets`) can draw them too; the widget configurations
// are in RemindlyWidgets/RemindlyWidgets.swift.

// MARK: - Up Next

/// The event happening now, or the next one coming up.
struct UpNextView: View {
    let snapshot: WidgetSnapshot?
    let date: Date
    let family: WidgetFamily

    private var upcoming: [WidgetSnapshot.Item] { snapshot?.upcomingTimed(at: date) ?? [] }

    var body: some View {
        let upcoming = upcoming
        if let message = WidgetMessage(snapshot: snapshot, isEmpty: upcoming.isEmpty, empty: "Nothing coming up") {
            message.view(family: family)
        } else {
            let next = upcoming[0]
            let then = upcoming.dropFirst().first
            switch family {
            case .accessoryInline:
                Text("\(isNow(next) ? "Now" : shortWhen(next)) · \(next.title)")
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 0) {
                    Text(isNow(next) ? "Now · until \(next.end.formatted(date: .omitted, time: .shortened))" : when(next))
                        .font(.headline)
                        .widgetAccentable()
                        .lineLimit(1)
                    Text(next.title)
                        .font(.body)
                        .lineLimit(1)
                    if let detail = next.location.nilIfEmpty ?? then.map({ "Then \(shortWhen($0)) \($0.title)" }) {
                        Text(detail)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            default:
                small(next, then: then)
            }
        }
    }

    private func small(_ next: WidgetSnapshot.Item, then: WidgetSnapshot.Item?) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 5) {
                Circle()
                    .fill(CategoryPalette.color(next.tint))
                    .frame(width: 7, height: 7)
                Text(isNow(next) ? "NOW" : "UP NEXT")
                    .font(.caption2.weight(.bold))
                    .tracking(0.5)
                    .foregroundStyle(isNow(next) ? Color.red : .secondary)
            }
            Text(next.title)
                .font(.headline)
                .lineLimit(3)
                .padding(.top, 2)
            Text(isNow(next) ? "Until \(next.end.formatted(date: .omitted, time: .shortened))" : when(next))
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            if let location = next.location.nilIfEmpty {
                Text(location)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            if let then {
                HStack(spacing: 4) {
                    RoundedRectangle(cornerRadius: 1)
                        .fill(CategoryPalette.color(then.tint))
                        .frame(width: 2.5, height: 12)
                    Text("\(shortWhen(then)) \(then.title)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func isNow(_ item: WidgetSnapshot.Item) -> Bool { item.start <= date }

    /// "12:30 – 1:30 PM", "Tomorrow, 9:30 AM", "Tue, 9:30 AM".
    private func when(_ item: WidgetSnapshot.Item) -> String {
        let today = Day(date)
        if item.firstDay == today {
            return "\(item.start.formatted(date: .omitted, time: .shortened)) – \(item.end.formatted(date: .omitted, time: .shortened))"
        }
        return "\(dayName(item.firstDay, today: today)), \(item.start.formatted(date: .omitted, time: .shortened))"
    }

    /// "6 PM", "Tomorrow 9:30 AM".
    private func shortWhen(_ item: WidgetSnapshot.Item) -> String {
        let today = Day(date)
        let time = Calendar.current.component(.minute, from: item.start) == 0
            ? item.start.formatted(.dateTime.hour())
            : item.start.formatted(date: .omitted, time: .shortened)
        return item.firstDay == today ? time : "\(dayName(item.firstDay, today: today)) \(time)"
    }
}

// MARK: - Today

/// What's left today (overdue tasks first), then the next few days.
struct TodayView: View {
    let snapshot: WidgetSnapshot?
    let date: Date
    let family: WidgetFamily

    var body: some View {
        let today = Day(date)
        if let message = WidgetMessage(snapshot: snapshot, isEmpty: false, empty: "") {
            message.view(family: family)
        } else if family == .systemLarge {
            large(today)
        } else {
            medium(today)
        }
    }

    private func medium(_ today: Day) -> some View {
        let content = TodayContent(snapshot: snapshot!, date: date, capacity: 4, headerForToday: false)
        return HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 0) {
                Text(date.formatted(.dateTime.weekday(.wide)).uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.red)
                Text("\(today.day)")
                    .font(.system(size: 40, weight: .regular))
                    .monospacedDigit()
                Spacer(minLength: 0)
                if content.todayCount > 0 {
                    Text(content.todayCount == 1 ? "1 left today" : "\(content.todayCount) left today")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 78, alignment: .leading)
            rows(content, compact: true)
        }
    }

    private func large(_ today: Day) -> some View {
        let content = TodayContent(snapshot: snapshot!, date: date, capacity: 8, headerForToday: false)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(date.formatted(.dateTime.weekday(.wide)))
                    .font(.title3.weight(.bold))
                    .foregroundStyle(.red)
                Text(date.formatted(.dateTime.month(.wide).day()))
                    .font(.title3.weight(.semibold))
                Spacer()
            }
            rows(content, compact: false)
        }
    }

    private func rows(_ content: TodayContent, compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: compact ? 6 : 8) {
            ForEach(content.rows) { row in
                switch row.kind {
                case .header(let day):
                    Text(dayName(day, today: Day(date)).uppercased())
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.top, compact ? 0 : 4)
                case .empty(let text):
                    Text(text)
                        .font(compact ? .caption : .subheadline)
                        .foregroundStyle(.secondary)
                case .item(let item, let day, let overdue):
                    Link(destination: item.url) {
                        WidgetItemRow(item: item, day: day, overdue: overdue, compact: compact)
                    }
                    .buttonStyle(.plain)
                }
            }
            if content.hiddenToday > 0 {
                Text("+\(content.hiddenToday) more today")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The rows the Today widget shows: today's leftovers, then following days with headers.
struct TodayContent {
    struct Row: Identifiable {
        enum Kind {
            case header(Day)
            case empty(String)
            case item(WidgetSnapshot.Item, day: Day, overdue: Bool)
        }
        let id: String
        let kind: Kind
    }

    private(set) var rows: [Row] = []
    /// Items left today (overdue tasks included), shown or not.
    private(set) var todayCount = 0
    /// Today's items that didn't fit.
    private(set) var hiddenToday = 0

    init(snapshot: WidgetSnapshot, date: Date, capacity: Int, headerForToday: Bool) {
        let today = Day(date)
        let overdue = snapshot.overdue(asOf: today)
        let left = snapshot.remaining(on: today, at: date)
        todayCount = overdue.count + left.count

        var todayRows = overdue.map { Row(id: "o|\($0.id)", kind: .item($0, day: today, overdue: true)) }
            + left.map { Row(id: "\(today)|\($0.id)", kind: .item($0, day: today, overdue: false)) }
        // Leave room to show at least the start of tomorrow when today's done.
        if todayRows.isEmpty { todayRows = [Row(id: "empty", kind: .empty("Nothing else today"))] }
        if headerForToday { rows.append(Row(id: "h|\(today)", kind: .header(today))) }
        let fit = min(todayRows.count, capacity - rows.count)
        rows += todayRows.prefix(fit)
        hiddenToday = todayCount > 0 ? todayRows.count - fit : 0
        if hiddenToday > 0 {
            // "+N more" takes the last line.
            if rows.count == capacity, rows.count > 1 { rows.removeLast(); hiddenToday += 1 }
            return
        }

        for group in snapshot.days where group.day > today {
            guard rows.count + 1 < capacity else { break }
            rows.append(Row(id: "h|\(group.day)", kind: .header(group.day)))
            for item in group.items where rows.count < capacity {
                rows.append(Row(id: "\(group.day)|\(item.id)", kind: .item(item, day: group.day, overdue: false)))
            }
        }
    }
}

/// One event or task: a color bar (or a checkbox), the title and when.
struct WidgetItemRow: View {
    let item: WidgetSnapshot.Item
    let day: Day
    let overdue: Bool
    let compact: Bool

    var body: some View {
        let color = CategoryPalette.color(item.tint)
        HStack(alignment: compact ? .center : .top, spacing: 7) {
            if item.isTask {
                Image(systemName: item.isDone ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: compact ? 12 : 14, weight: .medium))
                    .foregroundStyle(color)
                    .frame(width: compact ? 12 : 14)
            } else {
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(color)
                    .frame(width: 3, height: compact ? 26 : 32)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(item.title)
                    .font(compact ? .caption.weight(.semibold) : .subheadline.weight(.semibold))
                    .strikethrough(item.isDone)
                    .foregroundStyle(item.isDone ? .secondary : .primary)
                    .lineLimit(1)
                if let detail {
                    Text(detail)
                        .font(compact ? .caption2 : .caption)
                        .foregroundStyle(overdue ? AnyShapeStyle(Color.red) : AnyShapeStyle(.secondary))
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
    }

    private var detail: String? {
        var parts: [String] = []
        if overdue {
            parts.append("Overdue")
        } else if let time = item.timeText(on: day) {
            parts.append(time)
        }
        if !compact, let location = item.location.nilIfEmpty { parts.append(location) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

extension WidgetSnapshot.Item {
    /// Like the app's rows: multi-day events show their start on the first day,
    /// "All day" in between and their end on the last day. Tasks have no time.
    func timeText(on day: Day) -> String? {
        if isTask { return nil }
        if allDay { return "All day" }
        let start = start.formatted(date: .omitted, time: .shortened)
        let end = end.formatted(date: .omitted, time: .shortened)
        if firstDay == lastDay { return "\(start) – \(end)" }
        if day == firstDay { return "From \(start)" }
        if day == lastDay { return "Until \(end)" }
        return "All day"
    }
}

// MARK: - Shared bits

/// Signed out, or nothing to show.
private struct WidgetMessage {
    let text: String
    let symbol: String

    init?(snapshot: WidgetSnapshot?, isEmpty: Bool, empty: String) {
        guard let snapshot, snapshot.signedIn else {
            text = "Open Remindly to sign in"
            symbol = "person.crop.circle"
            return
        }
        guard isEmpty else { return nil }
        text = empty
        symbol = "calendar"
    }

    @ViewBuilder
    func view(family: WidgetFamily) -> some View {
        switch family {
        case .accessoryInline:
            Text(text)
        case .accessoryRectangular:
            Label(text, systemImage: symbol)
                .font(.caption)
                .frame(maxWidth: .infinity, alignment: .leading)
        default:
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: symbol)
                    .font(.title3)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
                Text(text)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

/// "Today", "Tomorrow", or "Tue, Oct 20".
private func dayName(_ day: Day, today: Day) -> String {
    if day == today { return "Today" }
    if day == today.adding(days: 1) { return "Tomorrow" }
    return day.date().formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
