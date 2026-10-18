import SwiftUI

/// Seven days side by side: a header with the dates, all-day bars, then a
/// 24-hour timeline. Tap an empty slot to add an event at that half hour.
struct WeekView: View {
    @Environment(CalendarStore.self) private var store
    let actions: EventActions
    let selected: Day
    /// Which way the days slide when the week changes.
    let slideFrom: Edge
    let onSelect: (Day) -> Void
    let onChangeWeek: (Int) -> Void

    @State private var allDayExpanded = false

    static let hourHeight: CGFloat = 50
    static let gutterWidth: CGFloat = 46
    /// All-day rows shown before the rest fold into "+N".
    private static let collapsedRows = 3

    private var week: Day { selected.startOfWeek() }
    private var days: [Day] { (0..<7).map { week.adding(days: $0) } }

    var body: some View {
        let days = days
        let layout = WeekLayout(days: days, occurrences: store.occurrences(from: days[0], to: days[6]))

        VStack(spacing: 0) {
            dayHeader(days)
            if layout.rowCount > 0 {
                allDayRows(layout)
            }
            Divider()
            timeline(layout)
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 24).onEnded { value in
                guard abs(value.translation.width) > abs(value.translation.height) * 1.5, abs(value.translation.width) > 60 else { return }
                onChangeWeek(value.translation.width < 0 ? 1 : -1)
            }
        )
    }

    // MARK: Header

    private func dayHeader(_ days: [Day]) -> some View {
        HStack(spacing: 0) {
            Color.clear.frame(width: Self.gutterWidth, height: 1)
            HStack(spacing: 0) {
                ForEach(days, id: \.self) { day in
                    WeekDayHeader(day: day, isSelected: day == selected)
                        .onTapGesture { onSelect(day) }
                }
            }
            .id(week)
            .transition(.push(from: slideFrom))
        }
        .clipped()
        .padding(.bottom, 6)
    }

    // MARK: All-day rows

    private func allDayRows(_ layout: WeekLayout) -> some View {
        let folds = layout.rowCount > Self.collapsedRows
        // Collapsed, the last visible row turns into "+N" counts.
        let shownRows = folds && !allDayExpanded ? Self.collapsedRows - 1 : layout.rowCount
        let rowHeight: CGFloat = 20, spacing: CGFloat = 2
        let rows = shownRows + (folds && !allDayExpanded ? 1 : 0)
        let height = CGFloat(rows) * rowHeight + CGFloat(max(0, rows - 1)) * spacing

        return HStack(alignment: .top, spacing: 0) {
            VStack(spacing: 2) {
                Text("all-day")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                if folds {
                    Button { withAnimation(.snappy) { allDayExpanded.toggle() } } label: {
                        Image(systemName: allDayExpanded ? "chevron.up" : "chevron.down")
                            .font(.caption2.weight(.semibold))
                            .frame(width: 28, height: 20)
                    }
                    .accessibilityLabel(allDayExpanded ? "Show fewer all-day items" : "Show all all-day items")
                }
            }
            .frame(width: Self.gutterWidth, alignment: .center)
            .padding(.top, 3)

            GeometryReader { geo in
                let columnWidth = geo.size.width / 7
                ZStack(alignment: .topLeading) {
                    ForEach(layout.bars.filter { $0.row < shownRows }) { bar in
                        AllDayBar(
                            occurrence: bar.occurrence, category: store.category(bar.occurrence.event.categoryId),
                            continuesBefore: bar.occurrence.day < days[0], continuesAfter: bar.occurrence.lastDay > days[6]
                        )
                            .frame(width: CGFloat(bar.lastColumn - bar.firstColumn + 1) * columnWidth - 2, height: rowHeight)
                            .eventActions(bar.occurrence, actions)
                            .offset(x: CGFloat(bar.firstColumn) * columnWidth + 1, y: CGFloat(bar.row) * (rowHeight + spacing))
                    }
                    if folds && !allDayExpanded {
                        ForEach(0..<7, id: \.self) { column in
                            let hidden = layout.bars(covering: column, fromRow: shownRows).count
                            if hidden > 0 {
                                Button { withAnimation(.snappy) { allDayExpanded = true } } label: {
                                    Text("+\(hidden)")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                        .frame(width: columnWidth - 2, height: rowHeight)
                                        .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 4))
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("\(hidden) more on \(days[column].date().formatted(.dateTime.weekday(.wide)))")
                                .offset(x: CGFloat(column) * columnWidth + 1, y: CGFloat(shownRows) * (rowHeight + spacing))
                            }
                        }
                    }
                }
            }
            .frame(height: height)
            .id(week)
            .transition(.push(from: slideFrom))
        }
        .frame(maxHeight: allDayExpanded ? 160 : nil)
        .clipped()
        .padding(.bottom, 6)
    }

    // MARK: Timeline

    private func timeline(_ layout: WeekLayout) -> some View {
        let hour = Self.hourHeight
        return ScrollViewReader { proxy in
            ScrollView(.vertical) {
                HStack(alignment: .top, spacing: 0) {
                    HourGutter(hourHeight: hour)
                        .frame(width: Self.gutterWidth)
                    GeometryReader { geo in
                        let columnWidth = geo.size.width / 7
                        ZStack(alignment: .topLeading) {
                            HourLines(hourHeight: hour)
                            ZStack(alignment: .topLeading) {
                                ForEach(Array(days.enumerated()), id: \.offset) { column, day in
                                    dayColumn(day, width: columnWidth)
                                        .offset(x: CGFloat(column) * columnWidth)
                                }
                                ForEach(layout.blocks) { block in
                                    blockView(block, columnWidth: columnWidth)
                                }
                                if let column = days.firstIndex(of: .today) {
                                    NowLine(hourHeight: hour)
                                        .frame(width: columnWidth)
                                        .offset(x: CGFloat(column) * columnWidth)
                                }
                            }
                            .id(week)
                            .transition(.push(from: slideFrom))
                        }
                    }
                }
                .frame(height: hour * 24)
                .clipped()
                .background(alignment: .topLeading) {
                    // Invisible marks to scroll to, a little above each hour so its label shows.
                    VStack(spacing: 0) {
                        ForEach(0..<24, id: \.self) { h in
                            Color.clear.frame(height: h == 0 ? hour - 12 : hour).id(h)
                        }
                    }
                }
                .padding(.top, 8)
                .padding(.bottom, 12)
            }
            .onAppear { proxy.scrollTo(firstVisibleHour, anchor: .top) }
            .refreshable { await store.load() }
        }
    }

    /// 7 AM, or a bit before now if it's later in the day this week.
    private var firstVisibleHour: Int {
        guard days.contains(.today) else { return 7 }
        let now = Calendar.current.component(.hour, from: Date())
        return min(max(7, now - 3), 15)
    }

    private func dayColumn(_ day: Day, width: CGFloat) -> some View {
        Rectangle()
            .fill(day == .today ? Color.red.opacity(0.04) : Color.clear)
            .contentShape(Rectangle())
            .frame(width: width, height: Self.hourHeight * 24)
            .overlay(alignment: .leading) {
                Rectangle().fill(Color(uiColor: .separator)).frame(width: 0.5)
            }
            .onTapGesture { location in
                let halfHours = Int(location.y / (Self.hourHeight / 2))
                actions.create(.newEvent(on: day, minute: min(max(halfHours, 0), 47) * 30))
            }
            .accessibilityElement()
            .accessibilityLabel(day.date().formatted(.dateTime.weekday(.wide).month(.wide).day()))
            .accessibilityHint("Double-tap to add an event")
            .accessibilityAddTraits(.isButton)
    }

    /// Overlapping blocks cascade like Calendar's: each later lane is indented and
    /// drawn on top, running to the column's right edge, so an earlier event keeps
    /// its full width (and readable title) above where the later one starts.
    private func blockView(_ block: WeekLayout.Block, columnWidth: CGFloat) -> some View {
        let inner = columnWidth - 3
        let indent = CGFloat(block.lane) * inner / CGFloat(block.lanes)
        let top = CGFloat(block.startMinute) / 60 * Self.hourHeight
        let height = max(CGFloat(block.endMinute - block.startMinute) / 60 * Self.hourHeight - 1, 18)
        return EventBlock(block: block, category: store.category(block.occurrence.event.categoryId), height: height)
            .frame(width: max(inner - indent, 4), height: height)
            .eventActions(block.occurrence, actions)
            .offset(x: CGFloat(block.column) * columnWidth + 1.5 + indent, y: top)
            .zIndex(Double(block.lane))
    }
}

// MARK: - Pieces

private struct WeekDayHeader: View {
    let day: Day
    let isSelected: Bool

    var body: some View {
        let isToday = day == .today
        VStack(spacing: 2) {
            Text(day.date().formatted(.dateTime.weekday(.narrow)))
                .font(.caption2.weight(.semibold))
                .foregroundStyle(isToday ? Color.red : .secondary)
            Text("\(day.day)")
                .font(.callout.weight(isToday || isSelected ? .semibold : .regular))
                .monospacedDigit()
                .foregroundStyle(isToday ? AnyShapeStyle(.white) : AnyShapeStyle(.primary))
                .frame(width: 32, height: 32)
                .background {
                    if isToday {
                        Circle().fill(Color.red)
                    } else if isSelected {
                        Circle().fill(Color.primary.opacity(0.1))
                    }
                }
        }
        .frame(maxWidth: .infinity)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(day.date().formatted(date: .complete, time: .omitted))
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

private struct HourGutter: View {
    let hourHeight: CGFloat

    var body: some View {
        ZStack(alignment: .topTrailing) {
            ForEach(1..<24, id: \.self) { hour in
                Text(Self.label(hour))
                    .font(.caption2)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .padding(.trailing, 6)
                    .frame(height: 14)
                    .offset(y: CGFloat(hour) * hourHeight - 7)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        .accessibilityHidden(true)
    }

    /// "9 AM", or "09" with a 24-hour clock.
    private static func label(_ hour: Int) -> String {
        let date = Calendar.current.date(bySettingHour: hour, minute: 0, second: 0, of: Date()) ?? Date()
        return date.formatted(.dateTime.hour())
    }
}

private struct HourLines: View {
    let hourHeight: CGFloat

    var body: some View {
        Canvas { context, size in
            for hour in 0...24 {
                let y = CGFloat(hour) * hourHeight
                context.fill(Path(CGRect(x: 0, y: y, width: size.width, height: 0.5)), with: .color(Color(uiColor: .separator)))
            }
        }
        .allowsHitTesting(false)
    }
}

/// The current time across today's column, moving every minute.
private struct NowLine: View {
    let hourHeight: CGFloat

    var body: some View {
        TimelineView(.everyMinute) { context in
            let y = CGFloat(WeekLayout.minuteOfDay(context.date)) / 60 * hourHeight
            ZStack(alignment: .leading) {
                Rectangle().fill(Color.red).frame(height: 1.5)
                Circle().fill(Color.red).frame(width: 7, height: 7).offset(x: -3.5)
            }
            .offset(y: y - 0.75)
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

private struct EventBlock: View {
    let block: WeekLayout.Block
    let category: Category?
    let height: CGFloat

    private var event: CalendarEvent { block.occurrence.event }

    var body: some View {
        let color = category.color
        VStack(alignment: .leading, spacing: 1) {
            Text(event.title)
                .font(.system(size: 11, weight: .semibold))
                .lineLimit(height < 30 ? 1 : max(1, Int((height - 16) / 13)))
            if height >= 40, let time {
                Text(time)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .foregroundStyle(.primary)
        .padding(.leading, 5)
        .padding(.trailing, 2)
        .padding(.vertical, 2)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        // Opaque, so a block cascaded on top hides what's underneath.
        .background(color.opacity(0.2))
        .background(Color(uiColor: .systemBackground))
        .overlay(alignment: .leading) {
            UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 4, style: .continuous)
                .fill(color)
                .frame(width: 2.5)
        }
        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
        .overlay {
            if block.lane > 0 {
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .strokeBorder(Color(uiColor: .systemBackground), lineWidth: 1)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel([event.title, accessibleTime].compactMap { $0 }.joined(separator: ", "))
        .accessibilityAddTraits(.isButton)
    }

    /// "9:30" for a block that starts here, "→ 2 AM" for the end of an overnight one.
    private var time: String? {
        switch block.part {
        case .only, .first: Self.short(block.occurrence.start)
        case .last: "→ " + Self.short(block.occurrence.end)
        case .middle: nil
        }
    }

    private var accessibleTime: String {
        let start = block.occurrence.start.formatted(date: .omitted, time: .shortened)
        let end = block.occurrence.end.formatted(date: .omitted, time: .shortened)
        return "\(start) to \(end)"
    }

    /// "9:30a", or "10a" on the hour.
    private static func short(_ date: Date) -> String {
        let hour = Date.FormatStyle.dateTime.hour(.defaultDigits(amPM: .narrow))
        let text = Calendar.current.component(.minute, from: date) == 0 ? date.formatted(hour) : date.formatted(hour.minute())
        return text.replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "\u{202F}", with: "")
    }
}

private struct AllDayBar: View {
    let occurrence: Occurrence
    let category: Category?
    /// Runs on from the previous / into the next week, so that edge is squared off.
    let continuesBefore: Bool
    let continuesAfter: Bool

    var body: some View {
        let event = occurrence.event
        HStack(spacing: 3) {
            if event.isTask {
                Image(systemName: event.isDone ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(category.color)
            }
            Text(event.title)
                .font(.system(size: 11, weight: .medium))
                .strikethrough(event.isDone)
                .foregroundStyle(event.isDone ? .secondary : .primary)
                .lineLimit(1)
        }
        .padding(.horizontal, 4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(category.color.opacity(event.isDone ? 0.1 : 0.2), in: UnevenRoundedRectangle(
            topLeadingRadius: continuesBefore ? 0 : 4, bottomLeadingRadius: continuesBefore ? 0 : 4,
            bottomTrailingRadius: continuesAfter ? 0 : 4, topTrailingRadius: continuesAfter ? 0 : 4, style: .continuous
        ))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(event.isTask ? "\(event.title), task\(event.isDone ? ", done" : "")" : "\(event.title), all day")
        .accessibilityAddTraits(.isButton)
    }
}
