import SwiftUI
import UIKit

extension Color {
    /// Remindly's accent (the web's --primary).
    static let remindly = Color(light: 0x2383E2, dark: 0x2383E2)

    // Brand colors from the app icon.
    static let ink = Color(uiColor: UIColor(hex: 0x0D0D0D))
    static let paper = Color(uiColor: UIColor(hex: 0xF3F1EC))
    /// The icon's dot, oklch(0.68 0.19 30).
    static let coral = Color(uiColor: UIColor(hex: 0xF7604B))
}

extension CategoryColor {
    var color: Color { CategoryPalette.color(rawValue) }
}

extension Optional where Wrapped == Category {
    /// Uncategorized events are gray.
    var color: Color { self?.color.color ?? CategoryColor.gray.color }
}

/// The app mark (same artwork as the app icon), on a rounded square.
struct LogoMark: View {
    var size: CGFloat = 44

    var body: some View {
        Image("Logo")
            .resizable()
            .interpolation(.high)
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.225, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: size * 0.225, style: .continuous)
                    .strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5)
            }
            .accessibilityHidden(true)
    }
}
