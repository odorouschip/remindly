import SwiftUI

enum MainTab: Hashable {
    case calendar, upcoming
}

/// The signed-in app: Calendar and Upcoming tabs, plus the sheets they share.
struct MainView: View {
    @Environment(CalendarStore.self) private var store
    @State private var tab: MainTab = .calendar
    @State private var editing: CalendarEvent?
    @State private var showingSettings = false
    @State private var confirmingDelete: CalendarEvent?

    init() {
        #if DEBUG
        if DemoData.launchTab == "upcoming" { _tab = State(initialValue: .upcoming) }
        #endif
    }

    var body: some View {
        TabView(selection: $tab) {
            CalendarView(actions: actions)
                .tabItem { Label("Calendar", systemImage: "calendar") }
                .tag(MainTab.calendar)
            AgendaView(actions: actions)
                .tabItem { Label("Upcoming", systemImage: "list.bullet") }
                .tag(MainTab.upcoming)
        }
        .sheet(item: $editing) { EventEditorView(event: $0) }
        .sheet(isPresented: $showingSettings) { SettingsView() }
        .confirmationDialog(
            "Delete every occurrence of “\(confirmingDelete?.title ?? "")”?",
            isPresented: Binding(get: { confirmingDelete != nil }, set: { if !$0 { confirmingDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button("Delete All", role: .destructive) {
                if let event = confirmingDelete { Task { await store.delete(event) } }
            }
        } message: {
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
            open: { event in editing = store.event(event.id) ?? event },
            create: { editing = $0 },
            toggleDone: { event in Task { await store.toggleDone(event) } },
            delete: { event in
                guard let series = store.event(event.id) else { return }
                if series.repeatRule != nil { confirmingDelete = series } else { Task { await store.delete(series) } }
            },
            showSettings: { showingSettings = true }
        )
    }

    private func openPendingEvent() {
        guard store.hasLoaded, let id = store.pendingEventId else { return }
        store.pendingEventId = nil
        editing = store.event(id)
    }
}
