import Foundation

/// Cross-platform metadata embedded in `events.notes` so the web and iOS apps
/// can share fields the Supabase schema doesn't currently have columns for
/// (category, isTask, priority, remind, "Yearly" recurrence).
///
/// Notes column layout: `<user notes>%%META%%<json>` where %%META%% is a
/// sentinel preceded by `\n\n` if there are any user notes. The web app uses
/// the same scheme.
struct CalendarMetadata: Codable {
    var cat: CalendarCategory = .work
    var isTask: Bool = false
    var priority: TaskPriority?
    var remind: RemindOption?
    /// Preserves "Yearly" recurrence which Supabase's repeat_frequency enum
    /// doesn't support.
    var recur: String?

    enum CodingKeys: String, CodingKey {
        case cat
        case isTask
        case priority
        case remind
        case recur
    }
}

enum CalendarNotes {
    static let sentinel = "%%META%%"

    /// Extract user-visible notes and metadata from a stored notes string.
    static func unpack(_ notes: String?) -> (description: String, metadata: CalendarMetadata) {
        guard let notes else { return ("", CalendarMetadata()) }
        guard let range = notes.range(of: sentinel) else {
            return (notes, CalendarMetadata())
        }
        let descPart = String(notes[..<range.lowerBound])
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let jsonPart = String(notes[range.upperBound...])
        guard let data = jsonPart.data(using: .utf8),
              let metadata = try? JSONDecoder().decode(CalendarMetadata.self, from: data) else {
            return (notes, CalendarMetadata())
        }
        return (descPart, metadata)
    }

    /// Combine user-visible description + metadata back into a notes string
    /// suitable for Supabase storage.
    static func pack(description: String, metadata: CalendarMetadata) -> String {
        let trimmed = description.trimmingCharacters(in: .whitespacesAndNewlines)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = (try? encoder.encode(metadata)) ?? Data()
        let json = String(data: data, encoding: .utf8) ?? "{}"
        if trimmed.isEmpty {
            return "\(sentinel)\(json)"
        }
        return "\(trimmed)\n\n\(sentinel)\(json)"
    }
}

extension CalendarEvent {
    var metadata: CalendarMetadata {
        CalendarNotes.unpack(notes).metadata
    }

    /// User-visible notes with the meta blob stripped.
    var displayNotes: String {
        CalendarNotes.unpack(notes).description
    }

    var category: CalendarCategory { metadata.cat }
    var isTask: Bool { metadata.isTask }
}
