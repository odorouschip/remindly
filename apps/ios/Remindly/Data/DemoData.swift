#if DEBUG
import Foundation

/// Sample data for running the app without an account: launch with `-demo`
/// (Xcode: Product → Scheme → Edit Scheme → Arguments). Debug builds only.
enum DemoData {
    static var isEnabled: Bool { ProcessInfo.processInfo.arguments.contains("-demo") }

    /// Fixed id so `xcrun simctl openurl booted remindly://events/<id>` can open it.
    static let linkTestId = UUID(uuidString: "00000000-0000-0000-0000-00000000DE70")!

    /// `-live-activity` starts a countdown for the next timed event after loading.
    static var startsLiveActivity: Bool { ProcessInfo.processInfo.arguments.contains("-live-activity") }

    /// `-quick-add <text>` opens quick add with that text typed in.
    static var quickAddText: String? { argument(after: "-quick-add") }

    /// `-tab upcoming` starts on the Upcoming tab.
    static var launchTab: String? { argument(after: "-tab") }

    /// `-open-event <uuid>` opens that event on launch, as a tapped notification would.
    static var eventToOpen: UUID? { argument(after: "-open-event").flatMap(UUID.init(uuidString:)) }

    private static func argument(after flag: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: flag), i + 1 < args.count else { return nil }
        return args[i + 1]
    }

    static let categories: [Category] = [
        Category(id: UUID(), name: "Work", color: .blue, sortOrder: 0),
        Category(id: UUID(), name: "Personal", color: .purple, sortOrder: 1),
        Category(id: UUID(), name: "Health", color: .green, sortOrder: 2),
        Category(id: UUID(), name: "Social", color: .orange, sortOrder: 3),
    ]

    static func events() -> [CalendarEvent] {
        let cat = { (name: String) in categories.first { $0.name == name }?.id }
        func event(_ offset: Int, _ title: String, at hour: Int, _ minute: Int = 0, minutes: Int = 60,
                   category: String, rule: RepeatRule? = nil, location: String = "") -> CalendarEvent {
            var e = CalendarEvent.newEvent(on: Day.today.adding(days: offset))
            e.start = Calendar.current.date(bySettingHour: hour, minute: minute, second: 0, of: e.start)!
            e.end = e.start.addingTimeInterval(TimeInterval(minutes * 60))
            e.title = title
            e.categoryId = cat(category)
            e.repeatRule = rule
            e.location = location
            e.isSaved = true
            e.reminderOffsets = CalendarEvent.eventReminderOffsets
            return e
        }
        func task(_ offset: Int, _ title: String, _ priority: Priority, done: Bool = false) -> CalendarEvent {
            var t = CalendarEvent.newTask(on: Day.today.adding(days: offset))
            t.title = title
            t.priority = priority
            t.isDone = done
            t.categoryId = cat("Personal")
            t.isSaved = true
            return t
        }
        var conference = CalendarEvent(allDay: true, start: Day.today.adding(days: 3).date(), end: Day.today.adding(days: 4).date())
        conference.title = "Conference"
        conference.categoryId = cat("Work")
        conference.isSaved = true

        return [
            event(-2, "Standup", at: 9, 30, minutes: 15, category: "Work", rule: RepeatRule(frequency: .daily, until: Day.today.adding(days: 10))),
            { var lunch = event(0, "Lunch with Sam", at: 12, 30, category: "Social", location: "Tartine"); lunch.id = linkTestId; return lunch }(),
            event(0, "Gym", at: 18, category: "Health"),
            task(0, "Reply to landlord", .medium),
            task(-2, "Return library books", .low),
            event(1, "Design review", at: 14, category: "Work"),
            task(1, "Pay rent", .high),
            event(2, "Dentist", at: 10, category: "Health"),
            event(-4, "1:1 with Priya", at: 11, minutes: 30, category: "Work", rule: RepeatRule(frequency: .weekly, interval: 2)),
            conference,
            { var trip = event(1, "Trip to Denver", at: 10, minutes: 2 * 1440 + 60, category: "Personal"); trip.location = "Denver"; return trip }(),
            event(6, "Dinner at Nonna's", at: 19, minutes: 120, category: "Social"),
        ]
    }
}
#endif
