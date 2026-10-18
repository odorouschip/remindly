import SwiftUI
import UIKit

// Category colors, shared by the app, the Live Activity and the widgets.
// Same shades as the --cat-* tokens in apps/web/app/globals.css; keep them in step.
enum CategoryPalette {
    private static let shades: [String: (light: UInt32, dark: UInt32)] = [
        "gray": (0x787774, 0x9B9B9B),
        "brown": (0x9F6B53, 0xBA856F),
        "orange": (0xD9730D, 0xFFA344),
        "yellow": (0xCB912F, 0xFFDC49),
        "green": (0x448361, 0x4DAB9A),
        "blue": (0x337EA9, 0x529CCA),
        "purple": (0x9065B0, 0xA782D8),
        "pink": (0xC14C8A, 0xE255A1),
        "red": (0xD44C47, 0xFF7369),
    ]

    /// The named color, following light / dark mode. Unknown or missing names are gray.
    static func color(_ name: String?) -> Color {
        let shade = name.flatMap { shades[$0] } ?? shades["gray"]!
        return Color(light: shade.light, dark: shade.dark)
    }

    /// The dark-mode shade, for always-dark surfaces like the Live Activity; nil when unknown.
    static func darkColor(_ name: String?) -> Color? {
        name.flatMap { shades[$0] }.map { Color(uiColor: UIColor(hex: $0.dark)) }
    }
}

extension Color {
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
