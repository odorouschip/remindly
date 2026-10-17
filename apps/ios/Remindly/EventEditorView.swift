import SwiftUI

enum EditorTab: String, Hashable {
    case event
    case task
}

struct EventEditorState: Identifiable {
    let id = UUID()
    var eventId: UUID?

    // Tab + shared
    var tab: EditorTab = .event
    var description: String = ""

    // Event fields
    var title: String = ""
    var date: Date = Date()
    var startTime: Date = Date()
    var endTime: Date = Date().addingTimeInterval(60 * 60)
    var category: CalendarCategory = .work
    var recurFrequency: RepeatFrequency = .none
    /// Holds "Yearly" since RepeatFrequency doesn't include it.
    var recurExtra: String?

    // Task fields
    var taskTitle: String = ""
    var dueDate: Date = Date()
    var remind: RemindOption = .day1
    var priority: TaskPriority = .medium

    // For new events.
    init(defaultDate: Date) {
        let cal = Calendar.current
        let baseStart = cal.date(bySettingHour: 9, minute: 0, second: 0, of: defaultDate) ?? defaultDate
        date = defaultDate
        startTime = baseStart
        endTime = baseStart.addingTimeInterval(60 * 60)
        dueDate = defaultDate
    }

    // For editing.
    init(event: CalendarEvent) {
        let meta = event.metadata
        eventId = event.id
        description = event.displayNotes
        category = meta.cat
        priority = meta.priority ?? .medium
        remind = meta.remind ?? .day1

        if meta.recur == "Yearly" {
            recurFrequency = .none
            recurExtra = "Yearly"
        } else {
            recurFrequency = event.repeatFrequency
            recurExtra = nil
        }

        if meta.isTask {
            tab = .task
            taskTitle = event.title.replacingOccurrences(of: " ✓", with: "")
            dueDate = event.startsAt
            date = event.startsAt
            startTime = event.startsAt
            endTime = event.endsAt
        } else {
            tab = .event
            title = event.title
            date = event.startsAt
            startTime = event.startsAt
            endTime = event.endsAt
            taskTitle = event.title
            dueDate = event.startsAt
        }
    }

    var isEditing: Bool { eventId != nil }

    /// Reminder offsets to persist in Supabase. Tasks get a single offset
    /// derived from the picked option; events get the default 30/10/0 set.
    var effectiveReminderOffsets: [Int] {
        if tab == .task {
            if let m = remind.offsetMinutes { return [m] }
            return []
        }
        return [30, 10, 0]
    }

    func makeDraft(userId: UUID) -> EventDraft {
        let meta = CalendarMetadata(
            cat: category,
            isTask: tab == .task,
            priority: tab == .task ? priority : nil,
            remind:   tab == .task ? remind   : nil,
            recur:    recurExtra
        )

        let cal = Calendar.current

        let starts: Date
        let ends: Date
        let isAllDay: Bool

        if tab == .task {
            starts = cal.date(bySettingHour: 9, minute: 0,  second: 0, of: dueDate) ?? dueDate
            ends   = cal.date(bySettingHour: 9, minute: 30, second: 0, of: dueDate) ?? dueDate
            isAllDay = true
        } else {
            starts = combine(date: date, time: startTime)
            ends   = combine(date: date, time: endTime)
            isAllDay = false
        }

        let resolvedTitle: String = {
            if tab == .task {
                let base = taskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
                return base.isEmpty ? "Untitled task" : "\(base) ✓"
            }
            let base = title.trimmingCharacters(in: .whitespacesAndNewlines)
            return base.isEmpty ? "Untitled event" : base
        }()

        return EventDraft(
            userId: userId,
            title: resolvedTitle,
            notes: CalendarNotes.pack(description: description, metadata: meta),
            startsAt: starts,
            endsAt: ends,
            timezone: TimeZone.current.identifier,
            isAllDay: isAllDay,
            repeatFrequency: recurExtra == "Yearly" ? .none : recurFrequency,
            repeatUntil: nil
        )
    }

    private func combine(date: Date, time: Date) -> Date {
        let cal = Calendar.current
        let day = cal.dateComponents([.year, .month, .day], from: date)
        let t   = cal.dateComponents([.hour, .minute], from: time)
        var combined = DateComponents()
        combined.year   = day.year
        combined.month  = day.month
        combined.day    = day.day
        combined.hour   = t.hour
        combined.minute = t.minute
        return cal.date(from: combined) ?? date
    }
}

struct EventEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @State var state: EventEditorState
    let onSave: (EventEditorState) async -> Void
    let onDelete: (UUID) async -> Void
    let onStartLiveActivity: (CalendarEvent) async -> Void

    @State private var isSaving = false

    private let accent = CalendarTheme.accent

    var body: some View {
        ZStack(alignment: .top) {
            CalendarTheme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                Capsule()
                    .fill(Color.black.opacity(0.18))
                    .frame(width: 36, height: 4)
                    .padding(.top, 10)
                    .padding(.bottom, 6)

                tabPicker
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)

                headerActions
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)

                ScrollView {
                    VStack(spacing: 12) {
                        if state.tab == .event {
                            eventForm
                        } else {
                            taskForm
                        }

                        if state.isEditing {
                            deleteButton.padding(.top, 8)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 24)
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.hidden)
    }

    // MARK: - Header

    private var tabPicker: some View {
        HStack(spacing: 8) {
            tabButton(.event, label: "Event")
            tabButton(.task,  label: "Task")
        }
    }

    private func tabButton(_ value: EditorTab, label: String) -> some View {
        let isActive = state.tab == value
        return Button {
            state.tab = value
        } label: {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(isActive ? Color.white : CalendarTheme.secondaryLabel)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(isActive ? accent : Color.black.opacity(0.07))
                )
        }
        .buttonStyle(.plain)
    }

    private var headerActions: some View {
        HStack {
            Button("Cancel") { dismiss() }
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(accent)

            Spacer()

            Text(headerTitle)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(CalendarTheme.label)

            Spacer()

            Button(state.isEditing ? "Save" : "Add") {
                Task { await save() }
            }
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(accent)
            .disabled(isSaving)
        }
    }

    private var headerTitle: String {
        if state.isEditing {
            return state.tab == .event ? "Edit Event" : "Edit Task"
        }
        return state.tab == .event ? "New Event" : "New Task"
    }

    // MARK: - Event form

    private var eventForm: some View {
        VStack(spacing: 12) {
            CardGroup {
                CardRow {
                    TextField("Event title", text: $state.title)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(CalendarTheme.label)
                }
            }

            CardGroup {
                CardRow {
                    LabeledRow(label: "Date") {
                        DatePicker("", selection: $state.date, displayedComponents: .date)
                            .labelsHidden()
                    }
                }
                Divider().background(CalendarTheme.background)
                CardRow {
                    LabeledRow(label: "Start") {
                        DatePicker("", selection: $state.startTime, displayedComponents: .hourAndMinute)
                            .labelsHidden()
                    }
                }
                Divider().background(CalendarTheme.background)
                CardRow {
                    LabeledRow(label: "End") {
                        DatePicker("", selection: $state.endTime, displayedComponents: .hourAndMinute)
                            .labelsHidden()
                    }
                }
            }

            CardGroup {
                CardRow {
                    HStack {
                        Text("Category")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(CalendarTheme.label)
                        Spacer()
                        HStack(spacing: 8) {
                            ForEach(CalendarCategory.allCases) { c in
                                categoryDot(c)
                            }
                        }
                    }
                }
                Divider().background(CalendarTheme.background)
                CardRow {
                    HStack {
                        Text("Repeat")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(CalendarTheme.label)
                        Spacer()
                        Picker("", selection: recurBinding) {
                            Text("Never").tag("")
                            Text("Daily").tag("Daily")
                            Text("Weekly").tag("Weekly")
                            Text("Monthly").tag("Monthly")
                            Text("Yearly").tag("Yearly")
                        }
                        .labelsHidden()
                        .pickerStyle(.menu)
                        .tint(CalendarTheme.secondaryLabel)
                    }
                }
            }

            CardGroup {
                CardRow {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Notes")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(CalendarTheme.secondaryLabel)
                        TextField("Add a description…", text: $state.description, axis: .vertical)
                            .font(.system(size: 14))
                            .foregroundStyle(CalendarTheme.label)
                            .lineLimit(2...6)
                    }
                }
            }
        }
    }

    private func categoryDot(_ c: CalendarCategory) -> some View {
        let isSelected = state.category == c
        return Button {
            state.category = c
        } label: {
            Circle()
                .fill(c.color)
                .frame(width: 22, height: 22)
                .overlay(
                    Circle()
                        .stroke(c.color, lineWidth: 2)
                        .padding(-3)
                        .opacity(isSelected ? 1 : 0)
                )
                .overlay(
                    Circle()
                        .stroke(Color.white, lineWidth: 2)
                        .opacity(isSelected ? 1 : 0)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Task form

    private var taskForm: some View {
        VStack(spacing: 12) {
            CardGroup {
                CardRow {
                    TextField("Task name", text: $state.taskTitle)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(CalendarTheme.label)
                }
            }

            CardGroup {
                CardRow {
                    LabeledRow(label: "Due date") {
                        DatePicker("", selection: $state.dueDate, displayedComponents: .date)
                            .labelsHidden()
                    }
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("REMIND ME")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(CalendarTheme.secondaryLabel)
                let columns = [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)]
                LazyVGrid(columns: columns, spacing: 6) {
                    ForEach(RemindOption.allCases) { option in
                        remindChip(option)
                    }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 10) {
                Text("PRIORITY")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(CalendarTheme.secondaryLabel)
                HStack(spacing: 8) {
                    ForEach(TaskPriority.allCases) { p in
                        priorityChip(p)
                    }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

            CardGroup {
                CardRow {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Notes")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(CalendarTheme.secondaryLabel)
                        TextField("Add a note…", text: $state.description, axis: .vertical)
                            .font(.system(size: 14))
                            .foregroundStyle(CalendarTheme.label)
                            .lineLimit(2...6)
                    }
                }
            }
        }
    }

    private func remindChip(_ option: RemindOption) -> some View {
        let isSelected = state.remind == option
        return Button {
            state.remind = option
        } label: {
            Text(option.label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(isSelected ? .white : Color(hex: 0x4A4744))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .padding(.horizontal, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(isSelected ? accent : CalendarTheme.background)
                )
        }
        .buttonStyle(.plain)
    }

    private func priorityChip(_ p: TaskPriority) -> some View {
        let isSelected = state.priority == p
        return Button {
            state.priority = p
        } label: {
            Text(p.label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(isSelected ? .white : p.color)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(isSelected ? p.color : CalendarTheme.background)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Delete

    private var deleteButton: some View {
        Button(role: .destructive) {
            guard let eventId = state.eventId else { return }
            Task {
                await onDelete(eventId)
                dismiss()
            }
        } label: {
            Text("Delete \(state.tab == .task ? "Task" : "Event")")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(.red)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    // MARK: - Recur binding

    private var recurBinding: Binding<String> {
        Binding(
            get: {
                if state.recurExtra == "Yearly" { return "Yearly" }
                switch state.recurFrequency {
                case .none:    return ""
                case .daily:   return "Daily"
                case .weekly:  return "Weekly"
                case .monthly: return "Monthly"
                }
            },
            set: { value in
                switch value {
                case "Daily":   state.recurFrequency = .daily;   state.recurExtra = nil
                case "Weekly":  state.recurFrequency = .weekly;  state.recurExtra = nil
                case "Monthly": state.recurFrequency = .monthly; state.recurExtra = nil
                case "Yearly":  state.recurFrequency = .none;    state.recurExtra = "Yearly"
                default:        state.recurFrequency = .none;    state.recurExtra = nil
                }
            }
        )
    }

    // MARK: - Save

    private func save() async {
        let titleSource = state.tab == .event ? state.title : state.taskTitle
        guard !titleSource.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        if state.tab == .event && state.endTime <= state.startTime {
            return
        }

        isSaving = true
        defer { isSaving = false }
        await onSave(state)
        dismiss()
    }
}

// MARK: - Reusable card pieces

private struct CardGroup<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) { content }
            .background(Color.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct CardRow<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct LabeledRow<Content: View>: View {
    let label: String
    @ViewBuilder var content: Content

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(CalendarTheme.label)
            Spacer()
            content
        }
    }
}
