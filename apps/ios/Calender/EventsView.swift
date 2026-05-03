import SwiftUI

private enum CalendarTab: Hashable {
    case calendar
    case agenda
    case search
}

struct EventsView: View {
    @EnvironmentObject private var api: SupabaseAPI
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var notificationScheduler: NotificationScheduler
    @EnvironmentObject private var liveActivities: LiveActivityController

    @State private var tab: CalendarTab = .calendar
    @State private var visibleMonth: Date = Date()
    @State private var selectedDate: Date = Date()
    @State private var searchText: String = ""
    @State private var editorState: EventEditorState?
    @State private var status: String = ""

    private let accent = CalendarTheme.accent

    var body: some View {
        ZStack(alignment: .bottom) {
            CalendarTheme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                header

                Group {
                    switch tab {
                    case .calendar: calendarTab
                    case .agenda:   agendaTab
                    case .search:   searchTab
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                tabBar
            }

            if tab != .search {
                Button {
                    editorState = EventEditorState(defaultDate: selectedDate)
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 52, height: 52)
                        .background(accent, in: Circle())
                        .shadow(color: accent.opacity(0.4), radius: 12, x: 0, y: 4)
                }
                .padding(.trailing, 18)
                .padding(.bottom, 80)
                .accessibilityLabel("New event")
            }
        }
        .sheet(item: $editorState) { state in
            EventEditorView(state: state) { savedState in
                await save(savedState)
            } onDelete: { eventId in
                await delete(id: eventId)
            } onStartLiveActivity: { event in
                await startLiveActivity(for: event)
            }
        }
        .task {
            await refresh()
            await liveActivities.registerPushToStartTokenIfAvailable(api: api, session: session)
        }
    }

    // MARK: - Header

    @ViewBuilder
    private var header: some View {
        VStack(spacing: 0) {
            switch tab {
            case .calendar:
                HStack {
                    Button { navigateMonth(-1) } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(accent)
                    }
                    Spacer()
                    VStack(spacing: 0) {
                        Text(visibleMonth.formatted(.dateTime.month(.wide)))
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(CalendarTheme.label)
                        Text(visibleMonth.formatted(.dateTime.year()))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(CalendarTheme.secondaryLabel)
                    }
                    Spacer()
                    Button { navigateMonth(1) } label: {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(accent)
                    }
                    Menu {
                        Button { Task { await refresh() } } label: {
                            Label("Refresh", systemImage: "arrow.clockwise")
                        }
                        Button(role: .destructive) {
                            session.signOut()
                        } label: {
                            Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.system(size: 18))
                            .foregroundStyle(accent)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 8)

                IOSMiniCal(
                    visibleMonth: visibleMonth,
                    selectedDate: selectedDate,
                    eventDates: eventDateSet(events: api.events),
                    accent: accent,
                    onSelect: { selectedDate = $0 }
                )
                .padding(.bottom, 4)

            case .agenda:
                HStack {
                    Text("Upcoming")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(CalendarTheme.label)
                    Spacer()
                    Menu {
                        Button { Task { await refresh() } } label: {
                            Label("Refresh", systemImage: "arrow.clockwise")
                        }
                        Button(role: .destructive) {
                            session.signOut()
                        } label: {
                            Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.system(size: 18))
                            .foregroundStyle(accent)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

            case .search:
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(CalendarTheme.secondaryLabel)
                    TextField("Search events…", text: $searchText)
                        .textFieldStyle(.plain)
                        .submitLabel(.search)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(CalendarTheme.background, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }
        }
        .background(Color.white)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.black.opacity(0.08)).frame(height: 0.5)
        }
    }

    // MARK: - Tabs

    private var calendarTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text(dayHeading)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(CalendarTheme.secondaryLabel)
                    .padding(.bottom, 2)

                let dayEvents = api.events
                    .filter { Calendar.current.isDate($0.startsAt, inSameDayAs: selectedDate) }
                    .sorted { $0.startsAt < $1.startsAt }

                if dayEvents.isEmpty {
                    Text("No events")
                        .font(.system(size: 14))
                        .foregroundStyle(CalendarTheme.tertiaryLabel)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 30)
                } else {
                    ForEach(dayEvents) { event in
                        IOSEventCard(event: event) {
                            editorState = EventEditorState(event: event)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 100)
        }
        .refreshable { await refresh() }
    }

    private var agendaTab: some View {
        let upcoming = api.events
            .filter { $0.startsAt >= Calendar.current.startOfDay(for: Date()) }
            .sorted { $0.startsAt < $1.startsAt }

        let grouped = Dictionary(grouping: upcoming) {
            Calendar.current.startOfDay(for: $0.startsAt)
        }
        let dayKeys = grouped.keys.sorted()

        return ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if upcoming.isEmpty {
                    Text("No upcoming events")
                        .font(.system(size: 14))
                        .foregroundStyle(CalendarTheme.tertiaryLabel)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                }

                ForEach(dayKeys, id: \.self) { day in
                    if let evs = grouped[day] {
                        agendaSection(day: day, events: evs)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 100)
        }
        .refreshable { await refresh() }
    }

    @ViewBuilder
    private func agendaSection(day: Date, events: [CalendarEvent]) -> some View {
        let isToday = Calendar.current.isDateInToday(day)
        let weekday = day.formatted(.dateTime.weekday(.abbreviated)).uppercased()
        let dayNumber = Calendar.current.component(.day, from: day)

        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                VStack(spacing: 0) {
                    Text(weekday)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(isToday ? accent : CalendarTheme.secondaryLabel)
                    Text("\(dayNumber)")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(isToday ? .white : CalendarTheme.label)
                        .frame(width: 36, height: 36)
                        .background(isToday ? accent : Color.clear, in: Circle())
                }
                .frame(width: 40)

                Rectangle().fill(CalendarTheme.separator).frame(height: 1)
            }
            .padding(.bottom, 8)

            ForEach(events) { event in
                IOSEventCard(event: event) {
                    editorState = EventEditorState(event: event)
                }
            }
        }
        .padding(.bottom, 16)
    }

    private var searchTab: some View {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        let results = trimmed.isEmpty
            ? []
            : api.events
                .filter { $0.title.localizedCaseInsensitiveContains(trimmed) }
                .sorted { $0.startsAt < $1.startsAt }

        return ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                if trimmed.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 22))
                            .foregroundStyle(CalendarTheme.tertiaryLabel)
                        Text("Search for events")
                            .font(.system(size: 14))
                            .foregroundStyle(CalendarTheme.tertiaryLabel)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 60)
                } else {
                    Text("\(results.count) result\(results.count == 1 ? "" : "s")")
                        .font(.system(size: 12))
                        .foregroundStyle(CalendarTheme.secondaryLabel)
                        .padding(.bottom, 4)

                    if results.isEmpty {
                        Text("No events found")
                            .font(.system(size: 14))
                            .foregroundStyle(CalendarTheme.tertiaryLabel)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 30)
                    } else {
                        ForEach(results) { event in
                            IOSEventCard(event: event) {
                                editorState = EventEditorState(event: event)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 4)
            .padding(.bottom, 100)
        }
    }

    // MARK: - Tab bar

    private var tabBar: some View {
        HStack(spacing: 0) {
            tabBarItem(.calendar, systemImage: "calendar", label: "Calendar")
            tabBarItem(.agenda,   systemImage: "list.bullet", label: "Agenda")
            tabBarItem(.search,   systemImage: "magnifyingglass", label: "Search")
        }
        .padding(.top, 8)
        .padding(.bottom, 20)
        .background(Color.white.opacity(0.97))
        .overlay(alignment: .top) {
            Rectangle().fill(Color.black.opacity(0.08)).frame(height: 0.5)
        }
    }

    private func tabBarItem(_ value: CalendarTab, systemImage: String, label: String) -> some View {
        let isActive = tab == value
        return Button {
            tab = value
        } label: {
            VStack(spacing: 3) {
                Image(systemName: systemImage)
                    .font(.system(size: 20))
                Text(label)
                    .font(.system(size: 10, weight: isActive ? .semibold : .regular))
            }
            .foregroundStyle(isActive ? accent : CalendarTheme.secondaryLabel)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Computed

    private var dayHeading: String {
        let today = Calendar.current.isDateInToday(selectedDate)
        let label = selectedDate.formatted(.dateTime.weekday(.wide).month(.wide).day())
        return (today ? "TODAY — " : "") + label
    }

    private func eventDateSet(events: [CalendarEvent]) -> Set<Date> {
        Set(events.map { Calendar.current.startOfDay(for: $0.startsAt) })
    }

    private func navigateMonth(_ direction: Int) {
        if let newDate = Calendar.current.date(byAdding: .month, value: direction, to: visibleMonth) {
            visibleMonth = newDate
        }
    }

    // MARK: - Actions

    private func refresh() async {
        guard let token = session.accessToken else { return }
        await api.loadEvents(accessToken: token)
        await notificationScheduler.schedule(events: api.events)
    }

    private func save(_ state: EventEditorState) async {
        guard let token = session.accessToken, let userId = session.userId else { return }
        do {
            let draft = state.makeDraft(userId: userId)
            try await api.saveEvent(
                accessToken: token,
                userId: userId,
                draft: draft,
                reminders: state.effectiveReminderOffsets,
                existingEventId: state.eventId
            )
            await notificationScheduler.schedule(events: api.events)
        } catch {
            status = error.localizedDescription
        }
    }

    private func delete(id: UUID) async {
        guard let token = session.accessToken else { return }
        do {
            try await api.softDeleteEvent(accessToken: token, eventId: id)
            await notificationScheduler.schedule(events: api.events)
        } catch {
            status = error.localizedDescription
        }
    }

    private func startLiveActivity(for event: CalendarEvent) async {
        do {
            try await liveActivities.start(event: event)
        } catch {
            status = error.localizedDescription
        }
    }
}

// MARK: - Mini calendar

struct IOSMiniCal: View {
    let visibleMonth: Date
    let selectedDate: Date
    let eventDates: Set<Date>
    let accent: Color
    let onSelect: (Date) -> Void

    private let calendar = Calendar.current
    private let weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"]

    var body: some View {
        VStack(spacing: 2) {
            HStack(spacing: 0) {
                ForEach(weekdayLabels.indices, id: \.self) { i in
                    Text(weekdayLabels[i])
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(CalendarTheme.secondaryLabel)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 2)
                }
            }

            let cells = monthCells()
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 0) {
                ForEach(cells.indices, id: \.self) { i in
                    if let day = cells[i] {
                        dayCell(for: day)
                    } else {
                        Color.clear.frame(height: 34)
                    }
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }

    @ViewBuilder
    private func dayCell(for date: Date) -> some View {
        let isSelected = calendar.isDate(date, inSameDayAs: selectedDate)
        let isToday = calendar.isDateInToday(date)
        let hasEvent = eventDates.contains(calendar.startOfDay(for: date))
        let day = calendar.component(.day, from: date)

        Button {
            onSelect(date)
        } label: {
            ZStack {
                Circle()
                    .fill(isSelected ? accent : (isToday ? accent.opacity(0.15) : Color.clear))
                    .frame(width: 30, height: 30)

                Text("\(day)")
                    .font(.system(size: 13, weight: (isSelected || isToday) ? .bold : .regular))
                    .foregroundStyle(
                        isSelected
                            ? Color.white
                            : (isToday ? accent : CalendarTheme.label)
                    )

                if hasEvent && !isSelected {
                    Circle()
                        .fill(accent)
                        .frame(width: 4, height: 4)
                        .offset(y: 12)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func monthCells() -> [Date?] {
        guard
            let firstOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: visibleMonth)),
            let range = calendar.range(of: .day, in: .month, for: firstOfMonth)
        else { return [] }

        let firstWeekday = calendar.component(.weekday, from: firstOfMonth) // 1 = Sunday
        let leadingBlanks = firstWeekday - 1

        var cells: [Date?] = Array(repeating: nil, count: leadingBlanks)
        for offset in 0..<range.count {
            if let day = calendar.date(byAdding: .day, value: offset, to: firstOfMonth) {
                cells.append(day)
            }
        }
        return cells
    }
}

// MARK: - Event card

struct IOSEventCard: View {
    let event: CalendarEvent
    let onTap: () -> Void

    var body: some View {
        let cat = event.category
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 12) {
                Capsule()
                    .fill(cat.color)
                    .frame(width: 4)
                    .frame(maxHeight: .infinity)

                VStack(alignment: .leading, spacing: 3) {
                    Text(event.title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(CalendarTheme.label)
                        .lineLimit(1)

                    HStack(spacing: 6) {
                        if !event.isAllDay {
                            Text(timeRangeText)
                                .font(.system(size: 12))
                                .foregroundStyle(CalendarTheme.secondaryLabel)
                        }

                        if event.repeatFrequency != .none {
                            Text("· ↻ \(event.repeatFrequency.rawValue.capitalized)")
                                .font(.system(size: 12))
                                .foregroundStyle(cat.color)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Text(cat.label)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(cat.color)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(cat.color.opacity(0.13), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(minHeight: 56)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(hex: 0xFBF9F7))
                    .shadow(color: .black.opacity(0.05), radius: 3, x: 0, y: 1)
            )
        }
        .buttonStyle(.plain)
        .padding(.bottom, 8)
    }

    private var timeRangeText: String {
        let start = event.startsAt.formatted(date: .omitted, time: .shortened)
        let end = event.endsAt.formatted(date: .omitted, time: .shortened)
        return "\(start) – \(end)"
    }
}
