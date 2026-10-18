import SwiftUI

enum MainTab: Hashable {
    case calendar, upcoming
}

/// The signed-in app: Calendar and Upcoming tabs, plus the sheets they share.
struct MainView: View {
    @Environment(CalendarStore.self) private var store
    @State private var tab: MainTab = .calendar
    @State private var editing: EditorTarget?
    @State private var showingSettings = false
    /// An occurrence of a repeating event waiting for "this event / all events".
    @State private var confirmingDelete: Occurrence?
    @State private var showingQuickAdd = false
    /// A day for the Calendar tab to jump to (from quick add).
    @State private var requestedDay: Day?

    init() {
        #if DEBUG
        if DemoData.launchTab == "upcoming" { _tab = State(initialValue: .upcoming) }
        if let mode = DemoData.launchTab.flatMap(CalendarMode.init(rawValue:)) {
            UserDefaults.standard.set(mode.rawValue, forKey: "calendarMode")
        }
        if DemoData.quickAddText != nil { _showingQuickAdd = State(initialValue: true) }
        #endif
    }

    var body: some View {
        TabView(selection: $tab) {
            CalendarView(actions: actions, requestedDay: $requestedDay)
                .tabItem { Label("Calendar", systemImage: "calendar") }
                .tag(MainTab.calendar)
            AgendaView(actions: actions)
                .tabItem { Label("Upcoming", systemImage: "list.bullet") }
                .tag(MainTab.upcoming)
        }
        .sheet(item: $editing) { EventEditorView(event: $0.event, occurrenceDate: $0.occurrenceDate) }
        .sheet(isPresented: $showingSettings) { SettingsView() }
        .sheet(isPresented: $showingQuickAdd) {
            QuickAddView(
                onOpen: { event in
                    // Let the quick add sheet finish closing before the editor opens.
                    Task {
                        try? await Task.sleep(for: .milliseconds(450))
                        editing = EditorTarget(event: store.event(event.id) ?? event)
                    }
                },
                onGoTo: { day in
                    tab = .calendar
                    requestedDay = day
                }
            )
        }
        .confirmationDialog(
            "Delete “\(confirmingDelete?.event.title ?? "")”?",
            isPresented: Binding(get: { confirmingDelete != nil }, set: { if !$0 { confirmingDelete = nil } }),
            titleVisibility: .visible,
            presenting: confirmingDelete.flatMap { occurrence in store.event(occurrence.event.id).map { (occurrence, $0) } }
        ) { occurrence, series in
            DeleteScopeButtons(series: series, occurrenceDate: occurrence.occurrenceDate) { scope in
                Task { await store.delete(series, occurrenceOn: occurrence.occurrenceDate, scope: scope) }
            }
        } message: { _, _ in
            Text("This is a repeating event.")
        }
        .alert("Something went wrong", isPresented: Binding(
            get: { store.errorMessage != nil },
            set: { if !$0 { store.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(store.errorMessage ?? "")
        }
        // A tapped notification or remindly:// link opens its event, once the data is in.
        .onChange(of: store.pendingEventId, initial: true) { _, _ in openPendingEvent() }
        .onChange(of: store.hasLoaded) { _, _ in openPendingEvent() }
    }

    private var actions: EventActions {
        EventActions(
            open: { occurrence in
                guard let series = store.event(occurrence.event.id) else { return }
                // A repeating event opens at the occurrence that was tapped.
                // Repeating tasks only ever show their current due date, so they open whole.
                editing = series.repeatRule == nil || series.isTask
                    ? EditorTarget(event: series)
                    : EditorTarget(event: CalendarEvent(editing: series.occurrence(on: occurrence.occurrenceDate)), occurrenceDate: occurrence.occurrenceDate)
            },
            create: { editing = EditorTarget(event: $0) },
            toggleDone: { event in Task { await store.toggleDone(event) } },
            delete: { occurrence in
                guard let series = store.event(occurrence.event.id) else { return }
                if series.repeatRule != nil && !series.isTask { confirmingDelete = occurrence } else { Task { await store.delete(series) } }
            },
            showSettings: { showingSettings = true },
            showQuickAdd: { showingQuickAdd = true }
        )
    }

    private func openPendingEvent() {
        guard store.hasLoaded, let id = store.pendingEventId else { return }
        store.pendingEventId = nil
        #if DEBUG
        if let day = DemoData.occurrenceToOpen, let series = store.event(id), series.repeatRule != nil {
            editing = EditorTarget(event: CalendarEvent(editing: series.occurrence(on: day)), occurrenceDate: day)
            return
        }
        #endif
        editing = store.event(id).map { EditorTarget(event: $0) }
    }
}

/// What the editor sheet is showing: an event, or one occurrence of a repeating one.
struct EditorTarget: Identifiable {
    let event: CalendarEvent
    /// The day the occurrence normally falls on, when editing one occurrence.
    var occurrenceDate: Day?
    var id: String { "\(event.id)|\(occurrenceDate?.description ?? "")" }
}

/// "Delete This Event / This and Following / All Events" for a repeating event.
struct DeleteScopeButtons: View {
    let series: CalendarEvent
    let occurrenceDate: Day
    let onDelete: (OccurrenceScope) -> Void

    var body: some View {
        Button("Delete This Event", role: .destructive) { onDelete(.this) }
        if occurrenceDate > series.firstDay {
            Button("Delete This and Following", role: .destructive) { onDelete(.following) }
        }
        Button("Delete All Events", role: .destructive) { onDelete(.all) }
    }
}
