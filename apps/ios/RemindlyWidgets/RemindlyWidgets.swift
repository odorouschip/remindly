import SwiftUI
import WidgetKit

/// Reads the snapshot the app writes and plans entries for each moment the
/// widgets change (events starting or ending, midnight) over the next day.
struct SnapshotProvider: TimelineProvider {
    struct Entry: TimelineEntry {
        let date: Date
        let snapshot: WidgetSnapshot?
    }

    func placeholder(in context: Context) -> Entry {
        Entry(date: .now, snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        // The widget gallery shows sample events until there's real data.
        let snapshot = WidgetSnapshot.read()
        completion(Entry(date: .now, snapshot: context.isPreview && (snapshot?.days.isEmpty ?? true) ? .placeholder : snapshot))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let now = Date.now
        let snapshot = WidgetSnapshot.read()
        let changes = snapshot?.changeDates(from: now, to: now.addingTimeInterval(86_400)) ?? []
        let entries = [Entry(date: now, snapshot: snapshot)] + changes.prefix(60).map { Entry(date: $0, snapshot: snapshot) }
        // The app reloads the widgets whenever the data changes; this just keeps "now" moving.
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

struct UpNextWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "UpNext", provider: SnapshotProvider()) { entry in
            UpNextEntryView(entry: entry)
        }
        .configurationDisplayName("Up Next")
        .description("The event happening now, or the next one.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline])
    }
}

private struct UpNextEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SnapshotProvider.Entry

    var body: some View {
        UpNextView(snapshot: entry.snapshot, date: entry.date, family: family)
            .widgetURL(entry.snapshot?.upcomingTimed(at: entry.date).first?.url)
            .containerBackground(.background, for: .widget)
    }
}

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Today", provider: SnapshotProvider()) { entry in
            TodayEntryView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("What's left today, then the days ahead.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

private struct TodayEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SnapshotProvider.Entry

    var body: some View {
        TodayView(snapshot: entry.snapshot, date: entry.date, family: family)
            .containerBackground(.background, for: .widget)
    }
}

extension WidgetSnapshot {
    /// Sample day for the widget gallery and placeholders.
    static var placeholder: WidgetSnapshot {
        let today = Day.today
        let at = { (hour: Int, minute: Int) in Calendar.current.date(bySettingHour: hour, minute: minute, second: 0, of: Date())! }
        let event = { (title: String, start: Date, minutes: Double, tint: String, location: String) in
            Item(eventId: UUID(), title: title, location: location, start: start, end: start.addingTimeInterval(minutes * 60),
                 allDay: false, isTask: false, isDone: false, tint: tint, firstDay: today, lastDay: today)
        }
        let later = max(Date.now.addingTimeInterval(1800), at(12, 30))
        return WidgetSnapshot(signedIn: true, overdue: [], days: [DayItems(day: today, items: [
            Item(eventId: UUID(), title: "Pay rent", location: "", start: today.date(), end: today.date(),
                 allDay: true, isTask: true, isDone: false, tint: "purple", firstDay: today, lastDay: today),
            event("Lunch with Sam", later, 60, "orange", "Tartine"),
            event("Gym", later.addingTimeInterval(5 * 3600), 60, "green", ""),
        ])])
    }
}
