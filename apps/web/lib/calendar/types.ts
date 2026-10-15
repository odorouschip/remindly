export type CategoryId = "work" | "personal" | "health" | "social";
export type Priority = "low" | "medium" | "high";
export type RemindKey = "at-time" | "30-min" | "1-day" | "1-week" | "2-weeks" | "custom";
export type RecurLabel = "" | "Daily" | "Weekly" | "Monthly" | "Yearly";

/** An event or task as the UI sees it, in the viewer's local time. */
export type CalEvent = {
  id: string;            // "" until saved
  title: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM, "" for tasks
  end: string;           // HH:MM, "" for tasks
  cat: CategoryId;
  recur: RecurLabel;
  isTask: boolean;
  desc: string;
  remind?: RemindKey | undefined;
  priority?: Priority | undefined;
};

export type Category = { id: CategoryId; label: string; color: string };

/** Colors are CSS variables so they follow the light/dark theme. */
export const CATEGORIES: readonly Category[] = [
  { id: "work",     label: "Work",     color: "var(--cat-work)" },
  { id: "personal", label: "Personal", color: "var(--cat-personal)" },
  { id: "health",   label: "Health",   color: "var(--cat-health)" },
  { id: "social",   label: "Social",   color: "var(--cat-social)" },
];

export function getCategory(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]!;
}

export const RECUR_OPTIONS: readonly RecurLabel[] = ["", "Daily", "Weekly", "Monthly", "Yearly"];

export const REMIND_OPTIONS: readonly { value: RemindKey; label: string }[] = [
  { value: "at-time", label: "At due time" },
  { value: "30-min",  label: "30 minutes before" },
  { value: "1-day",   label: "1 day before" },
  { value: "1-week",  label: "1 week before" },
  { value: "2-weeks", label: "2 weeks before" },
  { value: "custom",  label: "Custom…" },
];

export const REMIND_TO_MIN: Record<Exclude<RemindKey, "custom">, number> = {
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

/** Tasks are stored with a " ✓" suffix on the title; strip it for display. */
export function displayTitle(ev: CalEvent): string {
  return ev.isTask ? ev.title.replace(/ ✓$/, "") : ev.title;
}

export function sortByStart(a: CalEvent, b: CalEvent): number {
  return (a.date + a.time).localeCompare(b.date + b.time);
}
