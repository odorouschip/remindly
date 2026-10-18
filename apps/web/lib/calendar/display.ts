import { fmtTime, fmtTimeRange, fmtTimeShort, relativeDayLabel } from "./dates";
import type { CalEvent } from "./types";

// How an entry reads on the day it's shown. Multi-day timed events (split by
// byDay) show their start on the first day, "All day" in between, and their
// end on the last day.

/** The agenda's time column: "10:00 AM", "All day", "Until 11:00 AM", "Task". */
export function timeColumnLabel(ev: CalEvent): string {
  if (ev.isTask) return "Task";
  if (ev.allDay || ev.segment?.part === "middle") return "All day";
  if (ev.segment?.part === "last") return `Until ${fmtTime(ev.end)}`;
  return fmtTime(ev.time);
}

/** One-line "when" for tight lists, e.g. "10:00 AM – Sat, Oct 19, 11:00 AM". */
export function whenLabel(ev: CalEvent): string {
  if (ev.allDay || ev.segment?.part === "middle") return "All day";
  if (ev.segment?.part === "last") return `Until ${fmtTime(ev.end)}`;
  if (ev.segment?.part === "first") return `${fmtTime(ev.time)} – ${relativeDayLabel(ev.endDate)}, ${fmtTime(ev.end)}`;
  return fmtTimeRange(ev.time, ev.end);
}

/** The agenda's secondary line for timed events, or null when the time column says it all. */
export function untilLabel(ev: CalEvent): string | null {
  if (ev.allDay || !ev.end || ev.segment?.part === "last") return null;
  return ev.segment ? `until ${relativeDayLabel(ev.endDate)}, ${fmtTime(ev.end)}` : `until ${fmtTime(ev.end)}`;
}

/** Compact time for month chips; only on the first day of a multi-day event. */
export function chipTime(ev: CalEvent): string {
  if (ev.allDay || !ev.time || (ev.segment && ev.segment.part !== "first")) return "";
  return fmtTimeShort(ev.time);
}
