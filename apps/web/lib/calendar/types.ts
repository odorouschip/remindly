export type Priority = "low" | "medium" | "high";

/**
 * Set by byDay() on the per-day copies of a multi-day event: which day of it
 * this is, and whether it runs a full day or more (those go in all-day rows).
 */
export type DaySegment = { part: "first" | "middle" | "last"; fullDay: boolean };
export type RemindKey = "none" | "at-time" | "30-min" | "1-day" | "1-week" | "2-weeks" | "custom";
export type RecurLabel = "" | "Daily" | "Weekly" | "Monthly" | "Yearly";

/** An event or task as the UI sees it, in the viewer's local time. */
export type CalEvent = {
  id: string;            // "" until saved
  title: string;
  date: string;          // YYYY-MM-DD, the day it starts
  /** YYYY-MM-DD, the day it ends (inclusive). Same as `date` unless it spans days. */
  endDate: string;
  time: string;          // HH:MM, "" when all-day
  end: string;           // HH:MM, "" when all-day
  allDay: boolean;       // always true for tasks
  categoryId: string | null;
  recur: RecurLabel;
  /** Repeat every N days/weeks/months/years. */
  recurInterval: number;
  recurUntil: string;    // YYYY-MM-DD, last day it can repeat; "" = forever
  isTask: boolean;
  /** Tasks only. */
  done: boolean;
  desc: string;
  location: string;
  /** Tasks only: when to remind, relative to 9:00 AM on the due date. */
  remind?: RemindKey | undefined;
  /** Minutes before 9:00 AM on the due date, for remind === "custom". */
  remindMinutes?: number | undefined;
  priority?: Priority | undefined;
  /** Display-only; see DaySegment. */
  segment?: DaySegment | undefined;
};

export const CATEGORY_COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export type Category = { id: string; name: string; color: CategoryColor; sortOrder: number };

/** What new accounts start with (the database seeds the same set on signup). */
export const STARTER_CATEGORIES: readonly Omit<Category, "id">[] = [
  { name: "Work",     color: "blue",   sortOrder: 0 },
  { name: "Personal", color: "purple", sortOrder: 1 },
  { name: "Health",   color: "green",  sortOrder: 2 },
  { name: "Social",   color: "orange", sortOrder: 3 },
];

export const RECUR_OPTIONS: readonly RecurLabel[] = ["", "Daily", "Weekly", "Monthly", "Yearly"];

/** "day", "week"… for "Every 2 weeks". */
export const RECUR_UNIT: Record<Exclude<RecurLabel, "">, string> = {
  Daily: "day", Weekly: "week", Monthly: "month", Yearly: "year",
};

export const REMIND_OPTIONS: readonly { value: RemindKey; label: string }[] = [
  { value: "none",    label: "No reminder" },
  { value: "at-time", label: "Morning of (9 AM)" },
  { value: "30-min",  label: "30 minutes before" },
  { value: "1-day",   label: "1 day before" },
  { value: "1-week",  label: "1 week before" },
  { value: "2-weeks", label: "2 weeks before" },
  { value: "custom",  label: "Custom…" },
];

/** Minutes before 9:00 AM on the due date. */
export const REMIND_TO_MIN: Record<Exclude<RemindKey, "none" | "custom">, number> = {
  "at-time": 0,
  "30-min": 30,
  "1-day": 1440,
  "1-week": 10080,
  "2-weeks": 20160,
};

export const PRIORITIES: readonly { value: Priority; label: string }[] = [
  { value: "low",    label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High" },
];

/** All-day items (and the middle days of long events) first, then by start time. */
export function sortByStart(a: CalEvent, b: CalEvent): number {
  return (a.date + startKey(a)).localeCompare(b.date + startKey(b));
}

function startKey(ev: CalEvent): string {
  if (ev.allDay || ev.segment?.part === "middle") return "";
  return ev.segment?.part === "last" ? "00:00" : ev.time;
}

/** A blank draft; spread overrides onto it. */
export function emptyEvent(date: string): CalEvent {
  return {
    id: "", title: "", date, endDate: date, time: "", end: "", allDay: false, categoryId: null,
    recur: "", recurInterval: 1, recurUntil: "", isTask: false, done: false, desc: "", location: "",
  };
}
