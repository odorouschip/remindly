import SwiftUI
import UIKit

extension Color {
    /// Remindly's accent (the web's --primary).
    static let remindly = Color(light: 0x2383E2, dark: 0x2383E2)

    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

extension CategoryColor {
    /// Same shades as the --cat-* tokens in apps/web/app/globals.css.
    var color: Color {
        switch self {
        case .gray: Color(light: 0x787774, dark: 0x9B9B9B)
        case .brown: Color(light: 0x9F6B53, dark: 0xBA856F)
        case .orange: Color(light: 0xD9730D, dark: 0xFFA344)
        case .yellow: Color(light: 0xCB912F, dark: 0xFFDC49)
        case .green: Color(light: 0x448361, dark: 0x4DAB9A)
        case .blue: Color(light: 0x337EA9, dark: 0x529CCA)
        case .purple: Color(light: 0x9065B0, dark: 0xA782D8)
        case .pink: Color(light: 0xC14C8A, dark: 0xE255A1)
        case .red: Color(light: 0xD44C47, dark: 0xFF7369)
        }
    }
}

extension Optional where Wrapped == Category {
    /// Uncategorized events are gray.
    var color: Color { self?.color.color ?? CategoryColor.gray.color }
}

/// The app mark: a calendar glyph on a dark rounded square, like the web logo.
struct LogoMark: View {
    var size: CGFloat = 44

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
            .fill(Color(light: 0x37352F, dark: 0xEBEBEA))
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: "calendar")
                    .font(.system(size: size * 0.5, weight: .medium))
                    .foregroundStyle(Color(light: 0xFFFFFF, dark: 0x191919))
            }
            .accessibilityHidden(true)
    }
}
