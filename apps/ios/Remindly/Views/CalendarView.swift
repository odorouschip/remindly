import SwiftUI

enum CalendarMode: String {
    case month, week
}

/// Month: the grid on top, the selected day's schedule underneath.
/// Week: seven days on a timeline (WeekView).
struct CalendarView: View {
    @Environment(CalendarStore.self) private var store
    let actions: EventActions
    @Binding var requestedDay: Day?

    @AppStorage("calendarMode") private var mode: CalendarMode = .month
    @State private var month = Day.today.startOfMonth
    @State private var selected = Day.today
    /// Which way the grid slides when the month or week changes.
    @State private var slideFrom: Edge = .trailing

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                switch mode {
                case .month:
                    PeriodHeader(title: month.date().formatted(.dateTime.month(.wide)), year: month.year, unit: "month",
                                 onPrevious: { go(by: -1) }, onNext: { go(by: 1) })
                    MonthGrid(month: month, selected: selected, dayMap: dayMap, category: store.category) { day in
                        select(day)
                    }
                    .id(month)
                    .transition(.push(from: slideFrom))
                    .gesture(
                        DragGesture(minimumDistance: 24).onEnded { value in
                            guard abs(value.translation.width) > abs(value.translation.height), abs(value.translation.width) > 60 else { return }
                            go(by: value.translation.width < 0 ? 1 : -1)
                        }
                    )
                    Divider()
                    dayList
                case .week:
                    PeriodHeader(title: weekTitle, year: selected.startOfWeek().adding(days: 6).year, unit: "week",
                                 onPrevious: { go(by: -1) }, onNext: { go(by: 1) })
                    WeekView(actions: actions, selected: selected, slideFrom: slideFrom, onSelect: select, onChangeWeek: go(by:))
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(action: actions.showSettings) { Image(systemName: "gearshape") }
                        .accessibilityLabel("Settings")
                }
                ToolbarItem(placement: .principal) {
                    Picker("View", selection: $mode) {
                        Text("Month").tag(CalendarMode.month)
                        Text("Week").tag(CalendarMode.week)
                    }
                    .pickerStyle(.segmented)
                    .fixedSize()
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    if selected != .today || (mode == .month && month != Day.today.startOfMonth) {
                        Button("Today") { select(.today) }
                    }
                    QuickAddButton(action: actions.showQuickAdd)
                    NewMenu(day: selected, create: actions.create)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: mode) { _, _ in month = selected.startOfMonth }
            .onChange(of: requestedDay) { _, day in
                guard let day else { return }
                select(day)
                requestedDay = nil
            }
        }
    }

    /// "October", or "Oct – Nov" when the week spans two months.
    private var weekTitle: String {
        let first = selected.startOfWeek(), last = first.adding(days: 6)
        if first.month == last.month { return first.date().formatted(.dateTime.month(.wide)) }
        return "\(first.date().formatted(.dateTime.month(.abbreviated))) – \(last.date().formatted(.dateTime.month(.abbreviated)))"
    }

    // MARK: Day list

    private var dayList: some View {
        let occurrences = dayMap[selected] ?? []
        return List {
            Section {
                ForEach(occurrences) { occurrence in
                    EventRowView(occurrence: occurrence, day: selected, category: store.category(occurrence.event.categoryId)) {
                        actions.toggleDone(occurrence.event)
                    }
                    .eventRowActions(occurrence, actions)
                }
            } header: {
                Text(selected.date().formatted(.dateTime.weekday(.wide).month(.wide).day()))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(selected == .today ? Color.red : Color.primary)
                    .textCase(nil)
            }
        }
        .listStyle(.plain)
        .overlay {
            if occurrences.isEmpty && store.hasLoaded {
                ContentUnavailableView {
                    Label("Nothing scheduled", systemImage: "calendar")
                } actions: {
                    Button("Add an event") { actions.create(.newEvent(on: selected)) }
                }
                .padding(.top, 24)
            }
        }
        .refreshable { await store.load() }
    }

    // MARK: Navigation

    /// Six full weeks starting on the week that contains the 1st.
    private var gridDays: [Day] {
        let start = month.startOfMonth.startOfWeek()
        return (0..<42).map { start.adding(days: $0) }
    }

    private var dayMap: [Day: [Occurrence]] {
        let days = gridDays
        return store.dayMap(from: days.first!, to: days.last!)
    }

    /// Moves a month or a week, depending on the mode.
    private func go(by steps: Int) {
        slideFrom = steps > 0 ? .trailing : .leading
        if mode == .week {
            withAnimation(.snappy(duration: 0.3)) { selected = selected.adding(days: 7 * steps) }
            month = selected.startOfMonth
            return
        }
        withAnimation(.snappy(duration: 0.3)) {
            month = month.addingMonths(steps)
        }
        // Keep the selection inside the visible month.
        if selected.startOfMonth != month {
            selected = month == Day.today.startOfMonth ? .today : month
        }
    }

    private func select(_ day: Day) {
        if mode == .week {
            if day.startOfWeek() != selected.startOfWeek() {
                slideFrom = day > selected ? .trailing : .leading
                withAnimation(.snappy(duration: 0.3)) { selected = day }
            } else {
                selected = day
            }
            month = day.startOfMonth
            return
        }
        if day.startOfMonth != month {
            slideFrom = day > month ? .trailing : .leading
            withAnimation(.snappy(duration: 0.3)) { month = day.startOfMonth }
        }
        selected = day
    }
}

// MARK: - Pieces

/// "October 2026" with previous / next buttons.
private struct PeriodHeader: View {
    let title: String
    let year: Int
    /// "month" or "week", for VoiceOver.
    let unit: String
    let onPrevious: () -> Void
    let onNext: () -> Void

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(title)
                .font(.title2.weight(.bold))
            Text(String(year))
                .font(.title2)
                .foregroundStyle(.secondary)
            Spacer()
            Button(action: onPrevious) { Image(systemName: "chevron.left") }
                .accessibilityLabel("Previous \(unit)")
                .padding(.trailing, 14)
            Button(action: onNext) { Image(systemName: "chevron.right") }
                .accessibilityLabel("Next \(unit)")
        }
        .font(.body.weight(.semibold))
        .padding(.horizontal, 20)
        .padding(.top, 4)
        .padding(.bottom, 10)
    }
}

private struct MonthGrid: View {
    let month: Day
    let selected: Day
    let dayMap: [Day: [Occurrence]]
    let category: (UUID?) -> Category?
    let onSelect: (Day) -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 0), count: 7)

    var body: some View {
        let calendar = Calendar.current
        let start = month.startOfMonth.startOfWeek()
        let symbols = calendar.veryShortStandaloneWeekdaySymbols
        let ordered = Array(symbols[(calendar.firstWeekday - 1)...] + symbols[..<(calendar.firstWeekday - 1)])

        VStack(spacing: 4) {
            HStack(spacing: 0) {
                ForEach(Array(ordered.enumerated()), id: \.offset) { _, symbol in
                    Text(symbol)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
            }
            LazyVGrid(columns: columns, spacing: 2) {
                ForEach(0..<42, id: \.self) { index in
                    let day = start.adding(days: index)
                    DayCell(
                        day: day,
                        inMonth: day.month == month.month,
                        isSelected: day == selected,
                        dots: dots(for: day)
                    )
                    .onTapGesture { onSelect(day) }
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }

    /// Up to three distinct category colors for what's on `day`.
    private func dots(for day: Day) -> [Color] {
        var seen = Set<String>()
        var colors: [Color] = []
        for occurrence in dayMap[day] ?? [] {
            let category = category(occurrence.event.categoryId)
            let key = category?.color.rawValue ?? "none"
            if seen.insert(key).inserted { colors.append(category.color) }
            if colors.count == 3 { break }
        }
        return colors
    }
}

private struct DayCell: View {
    let day: Day
    let inMonth: Bool
    let isSelected: Bool
    let dots: [Color]

    var body: some View {
        let isToday = day == .today
        VStack(spacing: 3) {
            Text("\(day.day)")
                .font(.callout.weight(isToday || isSelected ? .semibold : .regular))
                .monospacedDigit()
                .foregroundStyle(isToday ? AnyShapeStyle(.white) : inMonth ? AnyShapeStyle(.primary) : AnyShapeStyle(.tertiary))
                .frame(width: 34, height: 34)
                .background {
                    if isToday {
                        Circle().fill(Color.red)
                    } else if isSelected {
                        Circle().fill(Color.primary.opacity(0.1))
                    }
                }
            HStack(spacing: 3) {
                ForEach(Array(dots.enumerated()), id: \.offset) { _, color in
                    Circle().fill(color).frame(width: 5, height: 5)
                }
            }
            .frame(height: 5)
            .opacity(inMonth ? 1 : 0.4)
        }
        .frame(maxWidth: .infinity, minHeight: 46)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(day.date().formatted(date: .complete, time: .omitted) + (dots.isEmpty ? "" : ", has events"))
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

/// Opens quick add (natural-language add, jump to date, search).
struct QuickAddButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) { Image(systemName: "sparkle.magnifyingglass") }
            .accessibilityLabel("Quick add or search")
    }
}

/// "+" with a menu for event or task; a plain tap makes an event.
struct NewMenu: View {
    let day: Day
    let create: (CalendarEvent) -> Void

    var body: some View {
        Menu {
            Button { create(.newEvent(on: day)) } label: { Label("New event", systemImage: "calendar.badge.plus") }
            Button { create(.newTask(on: day)) } label: { Label("New task", systemImage: "checkmark.circle") }
        } label: {
            Image(systemName: "plus")
        } primaryAction: {
            create(.newEvent(on: day))
        }
        .accessibilityLabel("New")
    }
}
