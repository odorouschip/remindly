import { addDays, localDateTimeToIso, parseIsoDate, toIsoDate } from "./dates";
import type { CalEvent, OccurrenceOverride } from "./types";

// Mirrors public.next_reminder() in supabase/migrations/202610170001_schema_v2.sql;
// keep the two in step.

const DAY_MS = 86_400_000;

export const daysBetween = (a: string, b: string) =>
  Math.round((parseIsoDate(b).getTime() - parseIsoDate(a).getTime()) / DAY_MS);

const spanOf = (ev: CalEvent) => Math.max(0, daysBetween(ev.date, ev.endDate || ev.date));

/**
 * Occurrences overlapping [from, to] (inclusive, YYYY-MM-DD). A repeating
 * event becomes one copy per occurrence, with any skipped or changed
 * occurrences (`exceptions`) applied; copies keep the series id and carry
 * `occurrenceDate`, so key them with occurrenceKey().
 */
export function occurrencesBetween(events: readonly CalEvent[], from: string, to: string): CalEvent[] {
  const out: CalEvent[] = [];
  for (const ev of events) {
    if (!ev.recur) {
      if (ev.date <= to && (ev.endDate || ev.date) >= from) out.push(ev);
      continue;
    }
    // Start early enough to catch a multi-day occurrence already underway.
    const earliest = toIsoDate(addDays(parseIsoDate(from), -spanOf(ev)));
    const last = ev.recurUntil && ev.recurUntil < to ? ev.recurUntil : to;
    for (const date of repeatDates(ev, earliest, last)) {
      const x = ev.exceptions?.[date];
      if (x?.cancelled || x?.date) continue; // skipped, or moved (added below)
      out.push(occurrenceOf(ev, date));
    }
    // A moved occurrence can land in the window from anywhere.
    for (const [date, x] of Object.entries(ev.exceptions ?? {})) {
      if (x.cancelled || !x.date || !isRepeatDate(ev, date)) continue;
      const moved = occurrenceOf(ev, date);
      if (moved.date <= to && moved.endDate >= from) out.push(moved);
    }
  }
  return out;
}

/** The occurrence of `series` that normally falls on `date`, with its exception (if any) applied. */
export function occurrenceOf(series: CalEvent, date: string): CalEvent {
  const natural: CalEvent = { ...series, date, endDate: toIsoDate(addDays(parseIsoDate(date), spanOf(series))), occurrenceDate: date };
  const x = series.exceptions?.[date];
  return x ? applyOverride(natural, x) : natural;
}

function applyOverride(ev: CalEvent, x: OccurrenceOverride): CalEvent {
  const out = { ...ev };
  if (x.title !== undefined) out.title = x.title;
  if (x.desc !== undefined) out.desc = x.desc;
  if (x.location !== undefined) out.location = x.location;
  if (x.categoryId !== undefined) out.categoryId = x.categoryId;
  if (x.date) {
    out.date = x.date;
    out.endDate = x.endDate || x.date;
    if (!ev.allDay) {
      out.time = x.time || ev.time;
      out.end = x.end || ev.end;
    }
  }
  return out;
}

/** Whether a repeating event has an occurrence on `date` (before any exceptions). */
export function isRepeatDate(ev: CalEvent, date: string): boolean {
  if (!ev.recur || date < ev.date || (ev.recurUntil && date > ev.recurUntil)) return false;
  for (const d of repeatDates(ev, date, date)) return d === date;
  return false;
}

const FULL_DAY_MINUTES = 24 * 60;

/**
 * Splits multi-day events into one entry per day they cover, within [from, to],
 * for views that lay events out day by day. Each copy is tagged with a segment
 * so views can show "10:00 AM" / "All day" / "Until 11:00 AM" instead of
 * repeating the full time range on every day.
 */
export function byDay(events: readonly CalEvent[], from: string, to: string): CalEvent[] {
  const out: CalEvent[] = [];
  for (const ev of events) {
    // A timed event ending at midnight doesn't reach into that day.
    const endDay = ev.endDate || ev.date;
    const end = !ev.allDay && ev.end === "00:00" && endDay > ev.date ? toIsoDate(addDays(parseIsoDate(endDay), -1)) : endDay;
    if (end <= ev.date) {
      out.push(ev);
      continue;
    }
    const fullDay = ev.allDay
      || Date.parse(localDateTimeToIso(endDay, ev.end)) - Date.parse(localDateTimeToIso(ev.date, ev.time)) >= FULL_DAY_MINUTES * 60_000;
    for (let d = ev.date < from ? from : ev.date; d <= end && d <= to; d = toIsoDate(addDays(parseIsoDate(d), 1))) {
      const part = d === ev.date ? "first" : d === end ? "last" : "middle";
      out.push({ ...ev, date: d, segment: { part, fullDay } });
    }
  }
  return out;
}

/** Unique per occurrence and day shown (moved occurrences and multi-day segments included). */
export const occurrenceKey = (ev: CalEvent): string => `${ev.id}:${ev.occurrenceDate ?? ""}:${ev.date}`;

function* repeatDates(ev: CalEvent, from: string, to: string): Generator<string> {
  const start = parseIsoDate(ev.date);
  const every = Math.max(1, ev.recurInterval || 1);

  if (ev.recur === "Daily" || ev.recur === "Weekly") {
    const step = (ev.recur === "Daily" ? 1 : 7) * every;
    // Jump straight to the first occurrence on or after `from`.
    const gapDays = daysBetween(ev.date, from);
    for (let i = Math.max(0, Math.ceil(gapDays / step)); ; i++) {
      const ds = toIsoDate(addDays(start, i * step));
      if (ds > to) return;
      yield ds;
    }
  }

  // Monthly / yearly repeat on the same day of the month. Months without that
  // day (the 31st, Feb 29) are skipped, like Google Calendar.
  const stepMonths = (ev.recur === "Monthly" ? 1 : 12) * every;
  for (let i = 0; ; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i * stepMonths, start.getDate());
    const ds = toIsoDate(d);
    if (ds > to) return;
    if (d.getDate() === start.getDate() && ds >= from) yield ds;
  }
}
