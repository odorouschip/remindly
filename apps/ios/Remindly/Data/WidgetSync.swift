import Foundation
import OSLog
import WidgetKit

/// Keeps the widgets' snapshot (see WidgetSnapshot) in step with the app's data.
/// Writes are batched, and the widgets only reload when the snapshot changed,
/// since iOS limits how often they can.
@MainActor
enum WidgetSync {
    private static var pending: Task<Void, Never>?
    private static let log = Logger(subsystem: "com.odorouschip.Remindly", category: "widgets")

    /// Rebuilds the snapshot shortly (several changes in a row write once).
    static func schedule(_ makeSnapshot: @escaping @MainActor () -> WidgetSnapshot) {
        pending?.cancel()
        pending = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            write(makeSnapshot())
        }
    }

    static func write(_ snapshot: WidgetSnapshot) {
        guard let url = WidgetSnapshot.fileURL else {
            log.error("No App Group container; widgets won't update")
            return
        }
        do {
            let data = try snapshot.encoded()
            if (try? Data(contentsOf: url)) == data { return }
            try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            log.error("Couldn't write the widget snapshot: \(error.localizedDescription, privacy: .public)")
        }
    }
}

extension WidgetSnapshot {
    /// The next two weeks of `agenda`, in the shape the widgets read.
    init(agenda: Agenda, category: @escaping (UUID?) -> Category?, signedIn: Bool) {
        let last = agenda.today.adding(days: Self.daysAhead - 1)
        let item = { (occurrence: Occurrence) in
            Item(
                eventId: occurrence.event.id,
                title: occurrence.event.title,
                location: occurrence.event.location,
                start: occurrence.start,
                end: occurrence.end,
                allDay: occurrence.event.allDay,
                isTask: occurrence.event.isTask,
                isDone: occurrence.event.isDone,
                tint: category(occurrence.event.categoryId)?.color.rawValue,
                firstDay: occurrence.day,
                lastDay: occurrence.lastDay
            )
        }
        self.init(
            signedIn: signedIn,
            overdue: agenda.overdue.map(item),
            days: agenda.days.filter { $0.day <= last }.map { DayItems(day: $0.day, items: $0.occurrences.map(item)) }
        )
    }
}
