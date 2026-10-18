import SwiftUI

/// What a row can ask the main screen to do. Passed down to both tabs so the
/// editor, settings and delete confirmation live in one place.
struct EventActions {
    var open: (CalendarEvent) -> Void
    var create: (CalendarEvent) -> Void
    var toggleDone: (CalendarEvent) -> Void
    var delete: (CalendarEvent) -> Void
    var showSettings: () -> Void
    var showQuickAdd: () -> Void
}

extension View {
    /// Tap to open, swipe to complete (tasks) or delete, press and hold for a menu.
    func eventRowActions(_ event: CalendarEvent, _ actions: EventActions) -> some View {
        eventActions(event, actions)
            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                if event.isTask {
                    Button { actions.toggleDone(event) } label: {
                        Label(event.isDone ? "Not done" : "Done", systemImage: event.isDone ? "arrow.uturn.backward" : "checkmark")
                    }
                    .tint(.green)
                }
            }
            .swipeActions(edge: .trailing, allowsFullSwipe: event.repeatRule == nil) {
                // Repeating events confirm first, so don't let the row animate away.
                Button(role: event.repeatRule == nil ? .destructive : nil) { actions.delete(event) } label: {
                    Label("Delete", systemImage: "trash")
                }
                .tint(.red)
            }
    }

    /// Tap to open, press and hold for a menu (for places without swipe actions, like the week view).
    func eventActions(_ event: CalendarEvent, _ actions: EventActions) -> some View {
        contentShape(Rectangle())
            .onTapGesture { actions.open(event) }
            .contextMenu {
                Button { actions.open(event) } label: { Label("Edit", systemImage: "pencil") }
                if event.isTask {
                    Button { actions.toggleDone(event) } label: {
                        Label(event.isDone ? "Mark as not done" : "Mark as done", systemImage: event.isDone ? "circle" : "checkmark.circle")
                    }
                }
                Divider()
                Button(role: .destructive) { actions.delete(event) } label: { Label("Delete", systemImage: "trash") }
            }
    }
}
