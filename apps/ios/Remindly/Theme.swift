import SwiftUI

enum CalendarCategory: String, CaseIterable, Identifiable, Codable {
    case work
    case personal
    case health
    case social

    var id: String { rawValue }

    var label: String {
        switch self {
        case .work: return "Work"
        case .personal: return "Personal"
        case .health: return "Health"
        case .social: return "Social"
        }
    }

    var color: Color {
        switch self {
        case .work:     return Color(hex: 0x5046E5)
        case .personal: return Color(hex: 0xE85D3A)
        case .health:   return Color(hex: 0x2DA87E)
        case .social:   return Color(hex: 0xC47EDB)
        }
    }
}

enum TaskPriority: String, CaseIterable, Identifiable, Codable {
    case low
    case medium
    case high

    var id: String { rawValue }

    var label: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        }
    }

    var color: Color {
        switch self {
        case .low:    return Color(hex: 0x2DA87E)
        case .medium: return Color(hex: 0xD97706)
        case .high:   return Color(hex: 0xE85D3A)
        }
    }
}

enum RemindOption: String, CaseIterable, Identifiable, Codable {
    case atTime  = "at-time"
    case min30   = "30-min"
    case day1    = "1-day"
    case week1   = "1-week"
    case weeks2  = "2-weeks"
    case custom

    var id: String { rawValue }

    var label: String {
        switch self {
        case .atTime: return "At due time"
        case .min30:  return "30 min before"
        case .day1:   return "1 day before"
        case .week1:  return "1 week before"
        case .weeks2: return "2 weeks before"
        case .custom: return "Custom…"
        }
    }

    /// Offset in minutes for the reminder, or nil for `.custom`.
    var offsetMinutes: Int? {
        switch self {
        case .atTime: return 0
        case .min30:  return 30
        case .day1:   return 24 * 60
        case .week1:  return 7 * 24 * 60
        case .weeks2: return 14 * 24 * 60
        case .custom: return nil
        }
    }
}

enum CalendarTheme {
    /// Default accent color matching the design (peach).
    static let accent = Color(hex: 0xF4845F)

    /// Light blush used on the unhovered "+ New" button etc.
    static let blush = Color(hex: 0xF0A896)

    /// iOS background gray.
    static let background = Color(hex: 0xF2F2F7)

    /// System-style separator.
    static let separator = Color(hex: 0xE5E5EA)

    /// Secondary label gray (#8E8E93).
    static let secondaryLabel = Color(hex: 0x8E8E93)

    /// Tertiary label gray (#C7C7CC).
    static let tertiaryLabel = Color(hex: 0xC7C7CC)

    /// Primary label color (#1C1C1E).
    static let label = Color(hex: 0x1C1C1E)
}

extension Color {
    init(hex: UInt32) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >> 8) & 0xFF) / 255.0
        let b = Double(hex & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: 1)
    }
}
