import Foundation
import Observation

/// Events and categories for the signed-in user, plus the actions that change them.
@MainActor
@Observable
final class CalendarStore {
    private(set) var events: [CalendarEvent] = []
    private(set) var categories: [Category] = []
    private(set) var isLoading = false
    private(set) var hasLoaded = false
    var errorMessage: String?
    /// Set by a notification tap or remindly:// link; the UI opens it and clears it.
    var pendingEventId: UUID?

    private let rest: SupabaseREST
    let notifications = NotificationScheduler()

    init(auth: AuthStore) {
        rest = SupabaseREST(auth: auth)
    }

    func category(_ id: UUID?) -> Category? {
        id.flatMap { id in categories.first { $0.id == id } }
    }

    func event(_ id: UUID) -> CalendarEvent? {
        events.first { $0.id == id }
    }

    func load() async {
        #if DEBUG
        if DemoData.isEnabled {
            if !hasLoaded { events = DemoData.events(); categories = DemoData.categories; hasLoaded = true }
            return
        }
        #endif
        isLoading = true
        defer { isLoading = false }
        do {
            async let eventData = rest.send(.get, "events", query: ["select": "*,reminders(offset_minutes)", "deleted_at": "is.null"])
            async let categoryData = rest.send(.get, "categories", query: ["select": "id,name,color,sort_order", "order": "sort_order,created_at"])
            let rows = try SupabaseREST.decoder.decode([EventRow].self, from: try await eventData)
            categories = try SupabaseREST.decoder.decode([Category].self, from: try await categoryData)
            events = rows.compactMap { $0.toEvent() }
            hasLoaded = true
            errorMessage = nil
            await notifications.reschedule(events: events)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Inserts or updates the event and replaces its reminders. Returns whether it worked.
    @discardableResult
    func save(_ event: CalendarEvent) async -> Bool {
        #if DEBUG
        if DemoData.isEnabled {
            var saved = event
            saved.isSaved = true
            saved.reminderOffsets = reminderOffsets(for: event)
            if let i = events.firstIndex(where: { $0.id == event.id }) { events[i] = saved } else { events.append(saved) }
            return true
        }
        #endif
        do {
            let body = try JSONEncoder().encode(EventPayload(event: event))
            if event.isSaved {
                try await rest.send(.patch, "events", query: ["id": "eq.\(event.id)"], body: body)
            } else {
                try await rest.send(.post, "events", body: body)
            }
            // The database works out when each reminder is due.
            try await rest.send(.delete, "reminders", query: ["event_id": "eq.\(event.id)"])
            let offsets = reminderOffsets(for: event)
            if !offsets.isEmpty {
                let rows: [[String: Any]] = offsets.map { ["event_id": event.id.uuidString, "offset_minutes": $0] }
                try await rest.send(.post, "reminders", body: try JSONSerialization.data(withJSONObject: rows))
            }
            await load()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func delete(_ event: CalendarEvent) async {
        #if DEBUG
        if DemoData.isEnabled { events.removeAll { $0.id == event.id }; return }
        #endif
        do {
            let body = try JSONSerialization.data(withJSONObject: ["deleted_at": Timestamp.format(Date())])
            try await rest.send(.patch, "events", query: ["id": "eq.\(event.id)"], body: body)
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Checks a task off (or back on) right away, then saves.
    func toggleDone(_ event: CalendarEvent) async {
        guard var task = self.event(event.id) else { return }
        task.isDone.toggle()
        if let index = events.firstIndex(where: { $0.id == task.id }) { events[index] = task }
        await save(task)
    }

    /// Forget everything on sign-out.
    func reset() async {
        events = []
        categories = []
        hasLoaded = false
        errorMessage = nil
        await notifications.reschedule(events: [])
    }
}
