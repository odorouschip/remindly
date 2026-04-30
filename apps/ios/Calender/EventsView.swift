import SwiftUI

struct EventsView: View {
    @EnvironmentObject private var api: SupabaseAPI
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var notificationScheduler: NotificationScheduler
    @EnvironmentObject private var liveActivities: LiveActivityController

    @State private var editorState: EventEditorState?
    @State private var status = "Synced reminders will appear here."

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if let nextEvent = api.events.first {
                        NextEventHero(event: nextEvent) {
                            Task { await startLiveActivity(for: nextEvent) }
                        }
                        .listRowInsets(EdgeInsets())
                    } else {
                        ContentUnavailableView("No Events", systemImage: "calendar.badge.plus", description: Text("Create one here or from the web app."))
                    }
                }

                Section("Upcoming") {
                    ForEach(api.events) { event in
                        Button {
                            editorState = EventEditorState(event: event)
                        } label: {
                            EventRowView(event: event)
                        }
                        .swipeActions {
                            Button(role: .destructive) {
                                Task { await delete(event) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Calender")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        session.signOut()
                    } label: {
                        Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }

                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        Task { await refresh() }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }

                    Button {
                        editorState = EventEditorState(userId: session.userId)
                    } label: {
                        Label("New event", systemImage: "plus")
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                Text(api.lastError ?? status)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 8)
            }
            .sheet(item: $editorState) { state in
                EventEditorView(state: state) { savedState in
                    await save(savedState)
                }
            }
            .task {
                await refresh()
                await liveActivities.registerPushToStartTokenIfAvailable(api: api, session: session)
            }
        }
    }

    private func refresh() async {
        guard let token = session.accessToken else { return }
        await api.loadEvents(accessToken: token)
        await notificationScheduler.schedule(events: api.events)
        status = "Updated \(Date().formatted(date: .omitted, time: .shortened))."
    }

    private func save(_ state: EventEditorState) async {
        guard let token = session.accessToken, let userId = session.userId else { return }

        do {
            let draft = state.makeDraft(userId: userId)
            try await api.saveEvent(
                accessToken: token,
                userId: userId,
                draft: draft,
                reminders: state.reminderOffsets.sorted(by: >),
                existingEventId: state.eventId
            )
            await notificationScheduler.schedule(events: api.events)
            status = "Event saved."
        } catch {
            status = error.localizedDescription
        }
    }

    private func delete(_ event: CalendarEvent) async {
        guard let token = session.accessToken else { return }

        do {
            try await api.softDeleteEvent(accessToken: token, eventId: event.id)
            await notificationScheduler.schedule(events: api.events)
        } catch {
            status = error.localizedDescription
        }
    }

    private func startLiveActivity(for event: CalendarEvent) async {
        do {
            try await liveActivities.start(event: event)
            status = "Live Activity started."
        } catch {
            status = error.localizedDescription
        }
    }
}

struct NextEventHero: View {
    let event: CalendarEvent
    let startLiveActivity: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Next countdown")
                .font(.caption.weight(.bold))
                .textCase(.uppercase)
                .foregroundStyle(.secondary)
            Text(event.title)
                .font(.system(size: 38, weight: .black, design: .rounded))
                .minimumScaleFactor(0.75)
            Label(event.startsAt.formatted(date: .abbreviated, time: .shortened), systemImage: "clock")
                .font(.headline)

            Button(action: startLiveActivity) {
                Label("Start Live Activity", systemImage: "iphone.radiowaves.left.and.right")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding(22)
        .background(.green.opacity(0.14), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding(.horizontal)
    }
}

struct EventRowView: View {
    let event: CalendarEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(event.title)
                .font(.headline)
            HStack {
                Label(event.startsAt.formatted(date: .abbreviated, time: .shortened), systemImage: "clock")
                Spacer()
                Text(reminderSummary)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 6)
    }

    private var reminderSummary: String {
        let count = event.reminders?.count ?? 0
        return "\(count) reminder\(count == 1 ? "" : "s")"
    }
}
