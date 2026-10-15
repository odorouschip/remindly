import { addDays, parseIsoDate, toIsoDate } from "./dates";
import type { CalEvent } from "./types";

const DAY_MS = 86_400_000;

/**
 * Events falling on a date in [from, to] (inclusive, YYYY-MM-DD). A repeating
 * event becomes one copy per occurrence; copies keep the series id, so key
 * them by id + date.
 */
export function occurrencesBetween(events: readonly CalEvent[], from: string, to: string): CalEvent[] {
  const out: CalEvent[] = [];
  for (const ev of events) {
    if (!ev.recur) {
      if (ev.date >= from && ev.date <= to) out.push(ev);
      continue;
    }
    const last = ev.recurUntil && ev.recurUntil < to ? ev.recurUntil : to;
    for (const date of repeatDates(ev, from, last)) {
      out.push(date === ev.date ? ev : { ...ev, date });
    }
  }
  return out;
}

export const occurrenceKey = (ev: CalEvent): string => `${ev.id}:${ev.date}`;

function* repeatDates(ev: CalEvent, from: string, to: string): Generator<string> {
  const start = parseIsoDate(ev.date);

  if (ev.recur === "Daily" || ev.recur === "Weekly") {
    const step = ev.recur === "Daily" ? 1 : 7;
    // Jump straight to the first occurrence on or after `from`.
    const gapDays = Math.round((parseIsoDate(from).getTime() - start.getTime()) / DAY_MS);
    for (let i = Math.max(0, Math.ceil(gapDays / step)); ; i++) {
      const ds = toIsoDate(addDays(start, i * step));
      if (ds > to) return;
      yield ds;
    }
  }

  // Monthly / yearly repeat on the same day of the month. Months without that
  // day (the 31st, Feb 29) are skipped, like Google Calendar.
  const stepMonths = ev.recur === "Monthly" ? 1 : 12;
  for (let i = 0; ; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i * stepMonths, start.getDate());
    const ds = toIsoDate(d);
    if (ds > to) return;
    if (d.getDate() === start.getDate() && ds >= from) yield ds;
  }
}
