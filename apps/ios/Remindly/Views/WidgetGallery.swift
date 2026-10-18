#if DEBUG
import SwiftUI
import WidgetKit

/// The Home Screen and Lock Screen widgets drawn at their iPhone sizes, from the
/// same snapshot the widgets read. The simulator can't add widgets from the
/// command line, so this is how they get checked: launch with `-demo -widgets`.
struct WidgetGallery: View {
    @Environment(CalendarStore.self) private var store

    var body: some View {
        let snapshot = store.widgetSnapshot()
        let now = Date()
        ScrollView {
            VStack(spacing: 18) {
                // Lock Screen
                VStack(spacing: 12) {
                    UpNextView(snapshot: snapshot, date: now, family: .accessoryInline)
                        .font(.subheadline.weight(.medium))
                        .lineLimit(1)
                        .frame(width: 250, height: 22)
                    UpNextView(snapshot: snapshot, date: now, family: .accessoryRectangular)
                        .frame(width: 172, height: 76)
                }
                .padding(20)
                .frame(maxWidth: .infinity)
                .background(LinearGradient(colors: [.indigo, .black], startPoint: .top, endPoint: .bottom), in: RoundedRectangle(cornerRadius: 22))
                .environment(\.colorScheme, .dark)
                .foregroundStyle(.white)
            }
                HStack(spacing: 18) {
                    tile(width: 170, height: 170) { UpNextView(snapshot: snapshot, date: now, family: .systemSmall) }
                    tile(width: 170, height: 170) { UpNextView(snapshot: nil, date: now, family: .systemSmall) }
                }
                tile(width: 358, height: 170) { TodayView(snapshot: snapshot, date: now, family: .systemMedium) }
                tile(width: 358, height: 376) { TodayView(snapshot: snapshot, date: now, family: .systemLarge) }

            .padding(16)
        }
        .background(Color(uiColor: .systemGroupedBackground))
    }

    private func tile<Content: View>(width: CGFloat, height: CGFloat, @ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(16)
            .frame(width: width, height: height)
            .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
    }
}
#endif
