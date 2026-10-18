import SwiftUI

/// Month grid on top, the selected day's schedule underneath.
struct CalendarView: View {
    @Environment(CalendarStore.self) private var store
    let actions: EventActions

    @State private var month = Day.today.startOfMonth
    @State private var selected = Day.today
    /// Which way the grid slides when the month changes.
    @State private var slideFrom: Edge = .trailing

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                MonthHeader(month: month, onPrevious: { go(by: -1) }, onNext: { go(by: 1) })
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
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(action: actions.showSettings) { Image(systemName: "gearshape") }
                        .accessibilityLabel("Settings")
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    if selected != .today || month != Day.today.startOfMonth {
                        Button("Today") { select(.today) }
                    }
                    NewMenu(day: selected, create: actions.create)
                }
            }
        }
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
                    .eventRowActions(occurrence.event, actions)
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
        let first = month.startOfMonth
        let lead = (first.weekday() - (Calendar.current.firstWeekday - 1) + 7) % 7
        let start = first.adding(days: -lead)
        return (0..<42).map { start.adding(days: $0) }
    }

    private var dayMap: [Day: [Occurrence]] {
        let days = gridDays
        return store.dayMap(from: days.first!, to: days.last!)
    }

    private func go(by months: Int) {
        slideFrom = months > 0 ? .trailing : .leading
        withAnimation(.snappy(duration: 0.3)) {
            month = month.addingMonths(months)
        }
        // Keep the selection inside the visible month.
        if selected.startOfMonth != month {
            selected = month == Day.today.startOfMonth ? .today : month
        }
    }

    private func select(_ day: Day) {
        if day.startOfMonth != month {
            slideFrom = day > month ? .trailing : .leading
            withAnimation(.snappy(duration: 0.3)) { month = day.startOfMonth }
        }
        selected = day
    }
}

// MARK: - Pieces

private struct MonthHeader: View {
    let month: Day
    let onPrevious: () -> Void
    let onNext: () -> Void

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(month.date().formatted(.dateTime.month(.wide)))
                .font(.title2.weight(.bold))
            Text(month.date().formatted(.dateTime.year()))
                .font(.title2)
                .foregroundStyle(.secondary)
            Spacer()
            Button(action: onPrevious) { Image(systemName: "chevron.left") }
                .accessibilityLabel("Previous month")
                .padding(.trailing, 14)
            Button(action: onNext) { Image(systemName: "chevron.right") }
                .accessibilityLabel("Next month")
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
        let first = month.startOfMonth
        let lead = (first.weekday() - (calendar.firstWeekday - 1) + 7) % 7
        let start = first.adding(days: -lead)
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
