import SwiftUI

/// Type a phrase to add an event or task, jump to a date, or find an event —
/// the phone version of the web's ⌘K bar.
struct QuickAddView: View {
    @Environment(CalendarStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    /// Open an event (or a draft) in the editor.
    let onOpen: (CalendarEvent) -> Void
    /// Show a day in the Calendar tab.
    let onGoTo: (Day) -> Void

    @State private var text = ""
    @State private var isSaving = false
    @FocusState private var focused: Bool

    private static let examples = [
        "lunch with Sam fri at noon",
        "gym every monday 6-7pm #health",
        "task: pay rent nov 1",
        "next friday",
    ]
    private static let maxMatches = 8

    var body: some View {
        NavigationStack {
            List {
                if query.isEmpty {
                    Section("Try") {
                        ForEach(Self.examples, id: \.self) { example in
                            Button { text = example } label: {
                                Label(example, systemImage: "text.cursor").foregroundStyle(.primary)
                            }
                        }
                    }
                } else if looksLikeSearch && !matches.isEmpty {
                    // A bare word ("standup") is more likely a lookup than a new event.
                    eventsSection
                    createSection
                } else {
                    createSection
                    eventsSection
                }
            }
            .foregroundStyle(.primary)
            .safeAreaInset(edge: .top, spacing: 0) {
                HStack(spacing: 8) {
                    Image(systemName: "sparkle.magnifyingglass").foregroundStyle(.secondary)
                    TextField("Add an event, jump to a date, or search", text: $text)
                        .focused($focused)
                        .submitLabel(.done)
                        .autocorrectionDisabled()
                        .onSubmit { Task { await submit() } }
                    if !text.isEmpty {
                        Button { text = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary) }
                            .accessibilityLabel("Clear")
                    }
                }
                .padding(.horizontal, 12)
                .frame(height: 44)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(.bar)
            }
            .navigationTitle("Quick Add")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            .onAppear {
                focused = true
                #if DEBUG
                if let preset = DemoData.quickAddText { text = preset }
                #endif
            }
        }
    }

    @ViewBuilder private var createSection: some View {
        if !parsed.title.isEmpty {
            Section("Create") {
                Button { Task { await create() } } label: {
                    ResultRow(
                        icon: parsed.isTask ? "checkmark.circle" : "calendar.badge.plus",
                        title: Text("\(parsed.isTask ? "New task" : "New event") ") + Text(parsed.title).bold(),
                        detail: summary
                    )
                }
                .disabled(isSaving)
                Button { openDraft() } label: {
                    ResultRow(icon: "square.and.pencil", title: Text("Add details first…"), detail: "Opens it in the editor")
                }
            }
        } else if parsed.dateMentioned {
            Section("Go to") {
                Button { goTo(parsed.day) } label: {
                    ResultRow(icon: "calendar", title: Text("Go to \(parsed.day.date().formatted(.dateTime.weekday(.wide).month(.wide).day().year()))"), detail: nil)
                }
            }
        }
    }

    @ViewBuilder private var eventsSection: some View {
        if !matches.isEmpty {
            Section("Events") {
                ForEach(matches) { occurrence in
                    Button { open(occurrence.event) } label: {
                        ResultRow(
                            color: store.category(occurrence.event.categoryId).color,
                            title: Text(occurrence.event.title),
                            detail: occurrenceDetail(occurrence)
                        )
                    }
                }
            }
        }
    }

    /// Nothing but a title: no date, time, repeat, task prefix or #tag.
    private var looksLikeSearch: Bool {
        let q = parsed
        return !q.dateMentioned && q.allDay && q.repeatRule == nil && !q.isTask && q.categoryId == nil
    }

    // MARK: Parsing and matching

    private var query: String { text.trimmingCharacters(in: .whitespaces) }

    private var parsed: QuickAdd { QuickAddParser.parse(query, categories: store.categories) }

    /// "Tomorrow · 12:00 PM – 1:00 PM · Every 2 weeks · Social"
    private var summary: String {
        let q = parsed
        var parts = [Self.dayLabel(q.day)]
        if q.isTask {
            parts[0] = "Task · " + parts[0]
        } else if let start = q.startMinutes, let end = q.endMinutes {
            parts.append("\(Self.clock(start)) – \(Self.clock(end))")
        } else {
            parts.append("All day")
        }
        if let rule = q.repeatRule {
            parts.append(rule.interval > 1 ? "Every \(rule.interval) \(rule.frequency.unit)s" : "Repeats \(rule.frequency.rawValue)")
        }
        if let category = store.category(q.categoryId) { parts.append(category.name) }
        return parts.joined(separator: " · ")
    }

    /// Events whose title contains the text: soonest upcoming first, then most recent past.
    private var matches: [Occurrence] {
        let needle = query.lowercased()
        let today = Day.today
        let yearOut = today.adding(days: 366)
        return store.events
            .filter { $0.title.lowercased().contains(needle) }
            .map { event in
                event.repeatRule != nil ? event.occurrences(from: today, to: yearOut).first ?? event.occurrence(on: event.firstDay) : event.occurrence(on: event.firstDay)
            }
            .sorted { a, b in
                let aPast = a.day < today, bPast = b.day < today
                if aPast != bPast { return !aPast }
                return aPast ? a.start > b.start : a.start < b.start
            }
            .prefix(Self.maxMatches)
            .map { $0 }
    }

    private func occurrenceDetail(_ occurrence: Occurrence) -> String {
        let day = Self.dayLabel(occurrence.day)
        if occurrence.event.isTask { return "Task · \(day)" }
        if occurrence.event.allDay { return day }
        return "\(day) · \(occurrence.start.formatted(date: .omitted, time: .shortened))"
    }

    private static func dayLabel(_ day: Day) -> String {
        if day == .today { return "Today" }
        if day == Day.today.adding(days: 1) { return "Tomorrow" }
        return day.date().formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }

    private static func clock(_ minutes: Int) -> String {
        let date = Calendar.current.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: Date()) ?? Date()
        return date.formatted(date: .omitted, time: .shortened)
    }

    // MARK: Actions

    /// Return key does whatever is listed first: open the top match for a bare
    /// word, otherwise create, otherwise go to the date.
    private func submit() async {
        if looksLikeSearch, let first = matches.first { open(first.event) }
        else if !parsed.title.isEmpty { await create() }
        else if parsed.dateMentioned { goTo(parsed.day) }
    }

    private func create() async {
        guard !isSaving else { return }
        isSaving = true
        defer { isSaving = false }
        let event = parsed.toEvent()
        if await store.save(event) {
            dismiss()
            onGoTo(Day(event.start))
        }
    }

    private func openDraft() {
        let draft = parsed.toEvent()
        dismiss()
        onOpen(draft)
    }

    private func open(_ event: CalendarEvent) {
        dismiss()
        onOpen(event)
    }

    private func goTo(_ day: Day) {
        dismiss()
        onGoTo(day)
    }
}

private struct ResultRow: View {
    var icon: String?
    var color: Color?
    let title: Text
    let detail: String?

    var body: some View {
        HStack(spacing: 12) {
            Group {
                if let icon {
                    Image(systemName: icon).foregroundStyle(.secondary)
                } else if let color {
                    Circle().fill(color).frame(width: 9, height: 9)
                }
            }
            .frame(width: 22)
            VStack(alignment: .leading, spacing: 2) {
                title.foregroundStyle(.primary).lineLimit(1)
                if let detail {
                    Text(detail).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
            }
        }
        .contentShape(Rectangle())
    }
}
