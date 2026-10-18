import Foundation
import Observation

/// Events and categories for the signed-in user, plus the actions that change them.
@MainActor
@Observable
final class CalendarStore {
    private(set) var events: [CalendarEvent] = [] {
        didSet {
            agenda = Agenda(events: events)
            dayMapCache = nil
        }
    }
    /// Derived from `events`; rebuilt when they change or the day rolls over.
    private(set) var agenda = Agenda() {
        didSet { updateWidgets() }
    }
    private(set) var categories: [Category] = [] {
        didSet { updateWidgets() }
    }
    private(set) var isLoading = false
    private(set) var hasLoaded = false
    var errorMessage: String?
    /// Set by a notification tap or remindly:// link; the UI opens it and clears it.
    var pendingEventId: UUID?

    private let auth: AuthStore
    private let rest: SupabaseREST
    let notifications = NotificationScheduler()
    private var lastLoadedAt: Date?

    /// Coming back to the app within this long doesn't re-sync.
    private static let freshFor: TimeInterval = 120

    init(auth: AuthStore) {
        self.auth = auth
        rest = SupabaseREST(auth: auth)
    }

    /// The month grid's view of the data, cached for the range last asked for.
    @ObservationIgnored private var dayMapCache: (from: Day, to: Day, map: [Day: [Occurrence]])?

    func dayMap(from: Day, to: Day) -> [Day: [Occurrence]] {
        if let cache = dayMapCache, cache.from == from, cache.to == to { return cache.map }
        let map = Agenda.byDay(events: events, from: from, to: to)
        dayMapCache = (from, to, map)
        return map
    }

    /// Every occurrence overlapping `from...to` (the week view lays these out itself).
    func occurrences(from: Day, to: Day) -> [Occurrence] {
        events.flatMap { $0.occurrences(from: from, to: to) }
    }

    /// Rebuilds the agenda if the date changed since it was built (e.g. after midnight).
    func rollOverIfNeeded() {
        if agenda.today != .today { agenda = Agenda(events: events) }
    }

    /// Re-syncs unless the last sync was moments ago — opening the app
    /// repeatedly shouldn't mean a network round trip every time.
    func refreshIfStale() async {
        rollOverIfNeeded()
        if let lastLoadedAt, Date().timeIntervalSince(lastLoadedAt) < Self.freshFor { return }
        await load()
    }

    /// Run by iOS in the background: sync, then make sure reminders match.
    func backgroundRefresh() async {
        BackgroundRefresh.log.info("Background refresh started")
        guard auth.isSignedIn else { return }
        await load()
        BackgroundRefresh.log.info("Background refresh finished (\(self.events.count) events)")
    }

    /// What the Home Screen / Lock Screen widgets show.
    func widgetSnapshot() -> WidgetSnapshot {
        WidgetSnapshot(agenda: agenda, category: category, signedIn: hasLoaded)
    }

    private func updateWidgets() {
        WidgetSync.schedule { [weak self] in
            self?.widgetSnapshot() ?? WidgetSnapshot(signedIn: false, overdue: [], days: [])
        }
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
            lastLoadedAt = Date()
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

    // MARK: Categories

    /// Inserts or updates a category (new ones carry a fresh id).
    func saveCategory(_ category: Category, isNew: Bool) async {
        var trimmed = category
        trimmed.name = String(category.name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(40))
        guard !trimmed.name.isEmpty else { return }
        if let i = categories.firstIndex(where: { $0.id == trimmed.id }) { categories[i] = trimmed } else { categories.append(trimmed) }
        #if DEBUG
        if DemoData.isEnabled { return }
        #endif
        do {
            var row: [String: Any] = ["name": trimmed.name, "color": trimmed.color.rawValue, "sort_order": trimmed.sortOrder]
            if isNew {
                row["id"] = trimmed.id.uuidString
                try await rest.send(.post, "categories", body: try JSONSerialization.data(withJSONObject: row))
            } else {
                try await rest.send(.patch, "categories", query: ["id": "eq.\(trimmed.id)"], body: try JSONSerialization.data(withJSONObject: row))
            }
        } catch {
            errorMessage = error.localizedDescription
            await load()
        }
    }

    /// Deletes a category; its events become uncategorized.
    func deleteCategory(_ category: Category) async {
        categories.removeAll { $0.id == category.id }
        #if DEBUG
        if DemoData.isEnabled {
            events = events.map { var e = $0; if e.categoryId == category.id { e.categoryId = nil }; return e }
            return
        }
        #endif
        do {
            try await rest.send(.delete, "categories", query: ["id": "eq.\(category.id)"])
        } catch {
            errorMessage = error.localizedDescription
        }
        await load()
    }

    /// Reorders categories and saves the new positions.
    func moveCategories(from source: IndexSet, to destination: Int) async {
        // Same result as SwiftUI's move(fromOffsets:toOffset:), without importing SwiftUI here.
        var reordered = categories
        let moving = source.sorted().map { reordered[$0] }
        for index in source.sorted(by: >) { reordered.remove(at: index) }
        reordered.insert(contentsOf: moving, at: destination - source.filter { $0 < destination }.count)
        let changed = reordered.enumerated().filter { $0.element.sortOrder != $0.offset }
        categories = reordered.enumerated().map { var c = $0.element; c.sortOrder = $0.offset; return c }
        for (index, category) in changed {
            var moved = category
            moved.sortOrder = index
            await saveCategory(moved, isNew: false)
        }
    }

    /// Forget everything on sign-out.
    func reset() async {
        events = []
        categories = []
        hasLoaded = false
        updateWidgets()
        lastLoadedAt = nil
        errorMessage = nil
        await notifications.reschedule(events: [])
    }
}
