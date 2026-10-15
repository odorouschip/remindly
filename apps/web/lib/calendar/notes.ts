// Fields the schema has no columns for yet (category, task flag, priority,
// remind, "Yearly") are packed into events.notes after a sentinel. The iOS
// app uses the same scheme — see apps/ios/Calender/CalendarMetadata.swift.
//
// Layout: `<description>\n\n%%META%%<json>`, or just `%%META%%<json>` when
// there's no description (iOS writes it that way), so match the bare sentinel.

const SENTINEL = "%%META%%";

export function packNotes(desc: string, meta: Record<string, unknown>): string {
  const trimmed = desc.trim();
  const blob = `${SENTINEL}${JSON.stringify(meta)}`;
  return trimmed ? `${trimmed}\n\n${blob}` : blob;
}

export function unpackNotes(notes: string | null): { desc: string; meta: Record<string, unknown> } {
  if (!notes) return { desc: "", meta: {} };
  const idx = notes.lastIndexOf(SENTINEL);
  if (idx < 0) return { desc: notes, meta: {} };
  const desc = notes.slice(0, idx).trim();
  try {
    const meta: unknown = JSON.parse(notes.slice(idx + SENTINEL.length));
    return { desc, meta: meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {} };
  } catch {
    // A corrupt blob still shouldn't leak into the description.
    return { desc, meta: {} };
  }
}
