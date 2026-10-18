import SwiftUI

/// The Upcoming tab: overdue tasks, then the next few weeks grouped by day.
struct AgendaView: View {
    @Environment(CalendarStore.self) private var store
    let actions: EventActions

    var body: some View {
        NavigationStack {
            List {
                if !store.agenda.overdue.isEmpty {
                    Section("Overdue") {
                        ForEach(store.agenda.overdue) { row($0, on: $0.day) }
                    }
                }
                ForEach(store.agenda.days) { group in
                    Section {
                        ForEach(group.occurrences) { row($0, on: group.day) }
                    } header: {
                        DayHeader(day: group.day)
                    }
                }
            }
            .listStyle(.plain)
            .overlay {
                if store.hasLoaded && store.agenda.isEmpty {
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
                    Button(action: actions.showSettings) { Image(systemName: "gearshape") }
                        .accessibilityLabel("Settings")
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    QuickAddButton(action: actions.showQuickAdd)
                    NewMenu(day: .today, create: actions.create)
                }
            }
        }
    }

    private func row(_ occurrence: Occurrence, on day: Day) -> some View {
        EventRowView(occurrence: occurrence, day: day, category: store.category(occurrence.event.categoryId)) {
            actions.toggleDone(occurrence.event)
        }
        .eventRowActions(occurrence, actions)
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
