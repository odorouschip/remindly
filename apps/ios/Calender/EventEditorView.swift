import SwiftUI

struct EventEditorState: Identifiable {
    let id = UUID()
    var eventId: UUID?
    var title = ""
    var notes = ""
    var startsAt = Date().addingTimeInterval(30 * 60)
    var endsAt = Date().addingTimeInterval(90 * 60)
    var isAllDay = false
    var repeatFrequency: RepeatFrequency = .none
    var repeatUntil: Date?
    var reminderOffsets = Set([30, 10, 0])

    init(userId: UUID?) {}

    init(event: CalendarEvent) {
        eventId = event.id
        title = event.title
        notes = event.notes ?? ""
        startsAt = event.startsAt
        endsAt = event.endsAt
        isAllDay = event.isAllDay
        repeatFrequency = event.repeatFrequency
        repeatUntil = event.repeatUntil
        reminderOffsets = Set(event.reminders?.map(\.offsetMinutes) ?? [30, 10, 0])
    }

    func makeDraft(userId: UUID) -> EventDraft {
        EventDraft(
            userId: userId,
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            notes: notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : notes,
            startsAt: startsAt,
            endsAt: endsAt,
            timezone: TimeZone.current.identifier,
            isAllDay: isAllDay,
            repeatFrequency: repeatFrequency,
            repeatUntil: repeatFrequency == .none ? nil : repeatUntil
        )
    }
}

struct EventEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @State var state: EventEditorState
    let onSave: (EventEditorState) async -> Void

    @State private var validationMessage: String?
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Title", text: $state.title)
                    TextField("Notes", text: $state.notes, axis: .vertical)
                        .lineLimit(3...6)
                    Toggle("All-day", isOn: $state.isAllDay)
                }

                Section("Time") {
                    DatePicker("Starts", selection: $state.startsAt, displayedComponents: state.isAllDay ? .date : [.date, .hourAndMinute])
                    DatePicker("Ends", selection: $state.endsAt, displayedComponents: state.isAllDay ? .date : [.date, .hourAndMinute])
                }

                Section("Repeats") {
                    Picker("Repeat", selection: $state.repeatFrequency) {
                        ForEach(RepeatFrequency.allCases) { frequency in
                            Text(frequency.rawValue.capitalized).tag(frequency)
                        }
                    }

                    if state.repeatFrequency != .none {
                        DatePicker(
                            "Repeat until",
                            selection: Binding(
                                get: { state.repeatUntil ?? state.startsAt.addingTimeInterval(30 * 24 * 60 * 60) },
                                set: { state.repeatUntil = $0 }
                            ),
                            displayedComponents: .date
                        )
                    }
                }

                Section("Countdown reminders") {
                    ForEach([30, 10, 0], id: \.self) { offset in
                        Toggle(isOn: reminderBinding(offset)) {
                            Label(offset == 0 ? "At start" : "\(offset) minutes before", systemImage: "bell.badge")
                        }
                    }
                }

                if let validationMessage {
                    Section {
                        Text(validationMessage)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(state.eventId == nil ? "New Event" : "Edit Event")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving" : "Save") {
                        Task { await save() }
                    }
                    .disabled(isSaving)
                }
            }
        }
    }

    private func reminderBinding(_ offset: Int) -> Binding<Bool> {
        Binding {
            state.reminderOffsets.contains(offset)
        } set: { isOn in
            if isOn {
                state.reminderOffsets.insert(offset)
            } else {
                state.reminderOffsets.remove(offset)
            }
        }
    }

    private func save() async {
        let title = state.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else {
            validationMessage = "Title is required."
            return
        }

        guard state.endsAt > state.startsAt else {
            validationMessage = "End time must be after start time."
            return
        }

        isSaving = true
        defer { isSaving = false }
        await onSave(state)
        dismiss()
    }
}
