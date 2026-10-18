import { addDays, parseIsoDate, toIsoDate } from "./dates";
import { daysBetween, occurrenceOf } from "./recurrence";
import type { CalEvent, OccurrenceOverride } from "./types";

// Editing one occurrence of a repeating event ("This event" / "All events").
// Mirrored in apps/ios/Remindly/Data/OccurrenceEdits.swift; keep them in step.

/** Changes that only make sense for the whole series, so the editor doesn't ask which occurrences. */
export function changesSeriesOnly(before: CalEvent, after: CalEvent): boolean {
  return before.recur !== after.recur
    || before.allDay !== after.allDay
    || before.isTask !== after.isTask
    || (Boolean(after.recur) && (before.recurInterval !== after.recurInterval || before.recurUntil !== after.recurUntil));
}

const OCCURRENCE_FIELDS = ["title", "desc", "location", "categoryId", "date", "endDate", "time", "end"] as const;

/** Whether saving `after` over `before` changes anything at all. */
export function hasChanges(before: CalEvent, after: CalEvent): boolean {
  return changesSeriesOnly(before, after) || OCCURRENCE_FIELDS.some((k) => (before[k] ?? null) !== (after[k] ?? null));
}

/**
 * What to store so the occurrence of `series` normally on `occurrenceDate`
 * looks like `edited` ("This event"). Null when it matches the series again,
 * so the exception can be removed. An occurrence can't drop the series'
 * category: a null override means "same as the series".
 */
export function overrideFor(series: CalEvent, occurrenceDate: string, edited: CalEvent): OccurrenceOverride | null {
  const natural = occurrenceOf({ ...series, exceptions: undefined }, occurrenceDate);
  const x: OccurrenceOverride = { cancelled: false };
  if (edited.title !== natural.title) x.title = edited.title;
  if (edited.desc !== natural.desc) x.desc = edited.desc;
  if (edited.location !== natural.location) x.location = edited.location;
  if (edited.categoryId && edited.categoryId !== natural.categoryId) x.categoryId = edited.categoryId;
  const moved = edited.date !== natural.date || edited.endDate !== natural.endDate
    || (!natural.allDay && (edited.time !== natural.time || edited.end !== natural.end));
  if (moved) {
    x.date = edited.date;
    x.endDate = edited.endDate || edited.date;
    x.time = natural.allDay ? "" : edited.time;
    x.end = natural.allDay ? "" : edited.end;
  }
  return Object.keys(x).length > 1 ? x : null;
}

/**
 * Applies an edit made while looking at one occurrence (`shown`) to the whole
 * series ("All events"). Field changes carry over; moving the occurrence by N
 * days moves every occurrence by N days; times of day are taken as edited.
 */
export function applyToSeries(series: CalEvent, shown: CalEvent, edited: CalEvent): CalEvent {
  const date = toIsoDate(addDays(parseIsoDate(series.date), daysBetween(shown.date, edited.date)));
  const endDate = toIsoDate(addDays(parseIsoDate(date), Math.max(0, daysBetween(edited.date, edited.endDate || edited.date))));
  return { ...series, ...edited, id: series.id, date, endDate, exceptions: series.exceptions, occurrenceDate: undefined };
}

/**
 * The series stopped before the occurrence on `occurrenceDate` ("This and
 * following events"). Null when that's the first occurrence — delete it all instead.
 */
export function endBefore(series: CalEvent, occurrenceDate: string): CalEvent | null {
  if (occurrenceDate <= series.date) return null;
  return { ...series, recurUntil: toIsoDate(addDays(parseIsoDate(occurrenceDate), -1)) };
}
