// Fields the schema has no columns for yet (category, task flag, priority,
// remind, "Yearly") are packed into events.notes after a sentinel. The iOS
// app uses the same scheme — see apps/ios/Calender/CalendarMetadata.swift.

const META_SENTINEL = "\n\n%%META%%";

export function packNotes(desc: string, meta: Record<string, unknown>): string {
  return `${desc.trim()}${META_SENTINEL}${JSON.stringify(meta)}`;
}

export function unpackNotes(notes: string | null): { desc: string; meta: Record<string, unknown> } {
  if (!notes) return { desc: "", meta: {} };
  const idx = notes.indexOf(META_SENTINEL);
  if (idx < 0) return { desc: notes, meta: {} };
  try {
    const meta = JSON.parse(notes.slice(idx + META_SENTINEL.length)) as Record<string, unknown>;
    return { desc: notes.slice(0, idx), meta };
  } catch {
    return { desc: notes, meta: {} };
  }
}
