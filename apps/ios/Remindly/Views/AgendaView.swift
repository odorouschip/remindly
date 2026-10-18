import SwiftUI

/// The main screen: overdue tasks, then the next few weeks grouped by day.
struct AgendaView: View {
    @Environment(CalendarStore.self) private var store
    @State private var editing: CalendarEvent?
    @State private var showingSettings = false

    private static let daysAhead = 45

    var body: some View {
        NavigationStack {
            List {
                if !overdue.isEmpty {
                    Section("Overdue") {
                        ForEach(overdue) { row($0, on: $0.day) }
                    }
                }
                ForEach(days, id: \.day) { group in
                    Section {
                        ForEach(group.occurrences) { row($0, on: group.day) }
                    } header: {
                        DayHeader(day: group.day)
                    }
                }
            }
            .listStyle(.plain)
            .overlay {
                if store.hasLoaded && days.isEmpty && overdue.isEmpty {
                    ContentUnavailableView("Nothing coming up", systemImage: "calendar",
                                           description: Text("Tap + to add an event or task."))
                } else if !store.hasLoaded && store.isLoading {
                    ProgressView()
                }
            }
            .refreshable { await store.load() }
            .navigationTitle("Upcoming")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showingSettings = true } label: { Image(systemName: "gearshape") }
                        .accessibilityLabel("Settings")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button { editing = .newEvent(on: .today) } label: { Label("New event", systemImage: "calendar.badge.plus") }
                        Button { editing = .newTask(on: .today) } label: { Label("New task", systemImage: "checkmark.circle") }
                    } label: {
                        Image(systemName: "plus")
                    } primaryAction: {
                        editing = .newEvent(on: .today)
                    }
                    .accessibilityLabel("New")
                }
            }
            .sheet(item: $editing) { event in
                EventEditorView(event: event)
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView()
            }
            .alert("Something went wrong", isPresented: Binding(
                get: { store.errorMessage != nil },
                set: { if !$0 { store.errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(store.errorMessage ?? "")
            }
            .onChange(of: store.pendingEventId, initial: true) { _, id in
                guard let id, store.hasLoaded else { return }
                store.pendingEventId = nil
                editing = store.event(id)
            }
            .onChange(of: store.hasLoaded) { _, loaded in
                // A link that arrived before the first load finished.
                if loaded, let id = store.pendingEventId {
                    store.pendingEventId = nil
                    editing = store.event(id)
                }
            }
        }
    }

    private func row(_ occurrence: Occurrence, on day: Day) -> some View {
        EventRowView(occurrence: occurrence, day: day, category: store.category(occurrence.event.categoryId)) {
            Task { await store.toggleDone(occurrence.event) }
        }
        .contentShape(Rectangle())
        .onTapGesture { editing = occurrence.event }
    }

    /// Unfinished tasks whose due date has passed.
    private var overdue: [Occurrence] {
        let today = Day.today
        return store.events
            .filter { $0.isTask && !$0.isDone && $0.firstDay < today }
            .map { $0.occurrence(on: $0.firstDay) }
            .sorted { $0.start < $1.start }
    }

    private var days: [(day: Day, occurrences: [Occurrence])] {
        let today = Day.today
        let last = today.adding(days: Self.daysAhead)
        var byDay: [Day: [Occurrence]] = [:]
        for event in store.events {
            for occurrence in event.occurrences(from: today, to: last) {
                // Multi-day events show on every day they cover.
                var day = max(occurrence.day, today)
                while day <= occurrence.lastDay && day <= last {
                    byDay[day, default: []].append(occurrence)
                    day = day.adding(days: 1)
                }
            }
        }
        return byDay.keys.sorted().map { day in
            (day, byDay[day]!.sorted { sortKey($0, on: day) < sortKey($1, on: day) })
        }
    }

    /// All-day items (and the middle days of long events) first, then by when they start that day.
    private func sortKey(_ occurrence: Occurrence, on day: Day) -> Date {
        if occurrence.event.allDay { return .distantPast }
        switch occurrence.part(on: day) {
        case .middle: return .distantPast
        case .last: return day.date()
        case .only, .first: return occurrence.start
        }
    }
}

private struct DayHeader: View {
    let day: Day

    var body: some View {
        HStack(spacing: 6) {
            Text(relative ?? fullDate)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(day == .today ? Color.red : Color.primary)
            if relative != nil {
                Text(fullDate)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .textCase(nil)
    }

    private var fullDate: String { day.date().formatted(.dateTime.weekday(.wide).month().day()) }

    /// "Today" / "Tomorrow", shown with the full date beside it.
    private var relative: String? {
        if day == .today { return "Today" }
        if day == Day.today.adding(days: 1) { return "Tomorrow" }
        return nil
    }
}

/// One line in the agenda: a color bar (or a checkbox for tasks), the title and when.
struct EventRowView: View {
    let occurrence: Occurrence
    /// The day this row is listed under (matters for multi-day events).
    let day: Day
    let category: Category?
    var onToggleDone: () -> Void = {}

    private var event: CalendarEvent { occurrence.event }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if event.isTask {
                Button(action: onToggleDone) {
                    Image(systemName: event.isDone ? "checkmark.circle.fill" : "circle")
                        .font(.title3)
                        .foregroundStyle(category.color)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(event.isDone ? "Mark as not done" : "Mark as done")
            } else {
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(category.color)
                    .frame(width: 3)
                    .padding(.vertical, 2)
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(event.title)
                        .font(.body.weight(.medium))
                        .strikethrough(event.isDone)
                        .foregroundStyle(event.isDone ? .secondary : .primary)
                        .lineLimit(1)
                    if event.repeatRule != nil {
                        Image(systemName: "repeat")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .accessibilityLabel("Repeats")
                    }
                }
                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 2)
    }

    private var subtitle: String? {
        var parts: [String] = []
        if !event.isTask {
            parts.append(whenText)
        } else if event.priority != .medium {
            parts.append("\(event.priority.label) priority")
        }
        if !event.location.isEmpty { parts.append(event.location) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// Multi-day timed events show their start on the first day, "All day" in
    /// between, and their end on the last day — not the range on every day.
    private var whenText: String {
        if event.allDay { return "All day" }
        let start = occurrence.start.formatted(date: .omitted, time: .shortened)
        let end = occurrence.end.formatted(date: .omitted, time: .shortened)
        switch occurrence.part(on: day) {
        case .only: return "\(start) – \(end)"
        case .first: return "\(start) – \(Self.dayLabel(occurrence.lastDay)), \(end)"
        case .middle: return "All day"
        case .last: return "Until \(end)"
        }
    }

    private static func dayLabel(_ day: Day) -> String {
        if day == .today { return "Today" }
        if day == Day.today.adding(days: 1) { return "Tomorrow" }
        return day.date().formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }
}
