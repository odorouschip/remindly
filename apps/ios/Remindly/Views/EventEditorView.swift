import SwiftUI

/// Create or edit an event or task. Works on a copy and saves on Done.
struct EventEditorView: View {
    @Environment(CalendarStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var draft: CalendarEvent
    @State private var taskReminder: TaskReminder
    @State private var customAmount = 2
    @State private var customUnit: CustomUnit = .hours
    @State private var isSaving = false
    @State private var confirmingDelete = false
    @State private var liveActivityMessage: String?
    @FocusState private var titleFocused: Bool

    init(event: CalendarEvent) {
        _draft = State(initialValue: event)
        let reminder = TaskReminder(offsets: event.isTask ? event.reminderOffsets : TaskReminder.oneDay.offsets)
        _taskReminder = State(initialValue: reminder)
        if case .custom(let minutes) = reminder {
            let unit = CustomUnit.allCases.last { minutes % $0.minutes == 0 } ?? .minutes
            _customUnit = State(initialValue: unit)
            _customAmount = State(initialValue: max(1, minutes / unit.minutes))
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Type", selection: kindBinding) {
                        Text("Event").tag(EventKind.event)
                        Text("Task").tag(EventKind.task)
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                Section {
                    TextField(draft.isTask ? "Task name" : "Event name", text: $draft.title)
                        .font(.title3.weight(.semibold))
                        .focused($titleFocused)
                    if !draft.isTask {
                        TextField("Location", text: $draft.location)
                    }
                }

                if draft.isTask { taskSection } else { timeSection; repeatSection }

                Section {
                    Picker("Category", selection: $draft.categoryId) {
                        Label("No category", systemImage: "circle.dashed").tag(UUID?.none)
                        ForEach(store.categories) { category in
                            Label {
                                Text(category.name)
                            } icon: {
                                Image(systemName: "circle.fill").foregroundStyle(category.color.color)
                            }
                            .tag(UUID?.some(category.id))
                        }
                    }
                    .pickerStyle(.navigationLink)
                }

                Section("Notes") {
                    TextField("Add a note", text: $draft.notes, axis: .vertical)
                        .lineLimit(3...10)
                }

                if canStartLiveActivity {
                    Section {
                        Button("Show countdown on Lock Screen", systemImage: "timer") { startLiveActivity() }
                    } footer: {
                        if let liveActivityMessage { Text(liveActivityMessage) }
                    }
                }

                if draft.isSaved {
                    Section {
                        Button("Delete \(draft.isTask ? "Task" : "Event")", role: .destructive) { confirmingDelete = true }
                            .frame(maxWidth: .infinity)
                    }
                }
            }
            .navigationTitle(draft.isSaved ? "" : (draft.isTask ? "New Task" : "New Event"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button(draft.isSaved ? "Save" : "Add") { Task { await save() } }
                            .disabled(validationMessage != nil)
                    }
                }
            }
            .confirmationDialog("Delete this \(draft.isTask ? "task" : "event")?", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    Task {
                        await store.delete(draft)
                        dismiss()
                    }
                }
            } message: {
                if draft.repeatRule != nil { Text("This deletes every occurrence.") }
            }
            .onAppear { if !draft.isSaved { titleFocused = true } }
        }
    }

    // MARK: Sections

    private var timeSection: some View {
        Section {
            Toggle("All day", isOn: allDayBinding)
            DatePicker("Starts", selection: startBinding, displayedComponents: draft.allDay ? .date : [.date, .hourAndMinute])
            DatePicker("Ends", selection: $draft.end, in: draft.start..., displayedComponents: draft.allDay ? .date : [.date, .hourAndMinute])
        } footer: {
            if let validationMessage { Text(validationMessage).foregroundStyle(.red) }
        }
    }

    private var repeatSection: some View {
        Section {
            Picker("Repeat", selection: frequencyBinding) {
                Text("Never").tag(RepeatFrequency?.none)
                ForEach(RepeatFrequency.allCases) { Text($0.label).tag(RepeatFrequency?.some($0)) }
            }
            if let rule = draft.repeatRule {
                Stepper(value: intervalBinding, in: 1...99) {
                    Text(rule.interval == 1 ? "Every \(rule.frequency.unit)" : "Every \(rule.interval) \(rule.frequency.unit)s")
                }
                Toggle("End repeat", isOn: endRepeatBinding)
                if rule.until != nil {
                    DatePicker("Last day", selection: untilBinding, in: draft.start..., displayedComponents: .date)
                }
            }
        } footer: {
            if draft.repeatRule != nil && draft.isSaved { Text("Changes apply to every occurrence.") }
        }
    }

    private var taskSection: some View {
        Section {
            DatePicker("Due", selection: startBinding, displayedComponents: .date)
            Picker("Remind", selection: reminderChoiceBinding) {
                ForEach(TaskReminder.presets) { Text($0.label).tag($0) }
                Text("Custom").tag(TaskReminder.custom(minutesBeforeNine: 0))
            }
            if case .custom = taskReminder {
                HStack {
                    Stepper(value: $customAmount, in: 1...999) { Text("\(customAmount)") }
                    Picker("Unit", selection: $customUnit) {
                        ForEach(CustomUnit.allCases) { Text($0.label(customAmount)).tag($0) }
                    }
                    .labelsHidden()
                }
                Text("before 9 AM on the due date")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Picker("Priority", selection: $draft.priority) {
                ForEach(Priority.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
        }
    }

    // MARK: Bindings that keep related fields consistent

    private var kindBinding: Binding<EventKind> {
        Binding {
            draft.kind
        } set: { kind in
            guard kind != draft.kind else { return }
            let day = draft.firstDay
            if kind == .task {
                draft.kind = .task
                draft.allDay = true
                draft.start = day.date()
                draft.end = day.date()
                draft.repeatRule = nil
            } else {
                let fresh = CalendarEvent.newEvent(on: day)
                draft.kind = .event
                draft.allDay = false
                draft.start = fresh.start
                draft.end = fresh.end
            }
        }
    }

    /// Moving the start keeps the length, like most calendars.
    private var startBinding: Binding<Date> {
        Binding {
            draft.start
        } set: { newStart in
            let length = draft.end.timeIntervalSince(draft.start)
            draft.start = draft.allDay || draft.isTask ? Calendar.current.startOfDay(for: newStart) : newStart
            draft.end = draft.start.addingTimeInterval(max(0, length))
        }
    }

    private var allDayBinding: Binding<Bool> {
        Binding {
            draft.allDay
        } set: { allDay in
            let calendar = Calendar.current
            if allDay {
                draft.start = calendar.startOfDay(for: draft.start)
                draft.end = max(draft.start, calendar.startOfDay(for: draft.end))
            } else {
                let fresh = CalendarEvent.newEvent(on: draft.firstDay)
                draft.start = fresh.start
                draft.end = fresh.end
            }
            draft.allDay = allDay
        }
    }

    private var frequencyBinding: Binding<RepeatFrequency?> {
        Binding {
            draft.repeatRule?.frequency
        } set: { frequency in
            if let frequency {
                draft.repeatRule = RepeatRule(frequency: frequency, interval: draft.repeatRule?.interval ?? 1, until: draft.repeatRule?.until)
            } else {
                draft.repeatRule = nil
            }
        }
    }

    private var intervalBinding: Binding<Int> {
        Binding { draft.repeatRule?.interval ?? 1 } set: { draft.repeatRule?.interval = $0 }
    }

    private var endRepeatBinding: Binding<Bool> {
        Binding {
            draft.repeatRule?.until != nil
        } set: { on in
            // Default end: a sensible span for the frequency.
            let span = switch draft.repeatRule?.frequency ?? .weekly {
            case .daily: 30
            case .weekly: 84
            case .monthly: 365
            case .yearly: 365 * 5
            }
            draft.repeatRule?.until = on ? draft.firstDay.adding(days: span) : nil
        }
    }

    private var untilBinding: Binding<Date> {
        Binding { draft.repeatRule?.until?.date() ?? draft.start } set: { draft.repeatRule?.until = Day($0) }
    }

    private var reminderChoiceBinding: Binding<TaskReminder> {
        Binding {
            if case .custom = taskReminder { return .custom(minutesBeforeNine: 0) }
            return taskReminder
        } set: { choice in
            if case .custom = choice {
                taskReminder = .custom(minutesBeforeNine: customAmount * customUnit.minutes)
            } else {
                taskReminder = choice
            }
        }
    }

    // MARK: Saving

    private var validationMessage: String? {
        if draft.isTask { return nil }
        if draft.allDay { return draft.end < draft.start ? "The last day can't be before the first." : nil }
        return draft.end <= draft.start ? "End time must be after the start." : nil
    }

    private func save() async {
        var event = draft
        event.title = event.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if event.isTask {
            if case .custom = taskReminder {
                event.reminderOffsets = TaskReminder.custom(minutesBeforeNine: customAmount * customUnit.minutes).offsets
            } else {
                event.reminderOffsets = taskReminder.offsets
            }
        }
        isSaving = true
        defer { isSaving = false }
        if await store.save(event) { dismiss() }
    }

    // MARK: Live Activity

    /// The next occurrence that hasn't ended yet, for timed events.
    private var nextOccurrence: Occurrence? {
        guard draft.isSaved, !draft.isTask, !draft.allDay else { return nil }
        let today = Day.today
        return draft.occurrences(from: today, to: today.adding(days: 1)).first { $0.end > Date() }
    }

    private var canStartLiveActivity: Bool {
        guard let occurrence = nextOccurrence else { return false }
        return LiveActivityController.isAvailable && !LiveActivityController.isRunning(for: occurrence)
    }

    private func startLiveActivity() {
        guard let occurrence = nextOccurrence else { return }
        do {
            try LiveActivityController.start(occurrence, tint: store.category(draft.categoryId)?.color)
            liveActivityMessage = "Countdown started. Lock your phone to see it."
        } catch {
            liveActivityMessage = error.localizedDescription
        }
    }
}

private enum CustomUnit: Int, CaseIterable, Identifiable {
    case minutes = 1, hours = 60, days = 1440, weeks = 10080

    var id: Int { rawValue }
    var minutes: Int { rawValue }

    func label(_ amount: Int) -> String {
        let name = switch self {
        case .minutes: "minute"
        case .hours: "hour"
        case .days: "day"
        case .weeks: "week"
        }
        return amount == 1 ? name : name + "s"
    }
}
