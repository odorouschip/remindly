// Turns a typed phrase like "lunch with Sam fri at noon #social" into an
// event draft. Pure string matching — no model — so it's instant and
// predictable. Anything it doesn't recognize stays in the title.

import { addDays, fromMinutes, toIsoDate } from "./dates";
import { emptyEvent, type CalEvent, type Category, type RecurLabel } from "./types";

export type QuickAdd = {
  title: string;
  date: string;
  /** False when the date is just the default (today, or tomorrow if the time has passed). */
  dateMentioned: boolean;
  time: string;
  end: string;
  allDay: boolean;
  recur: RecurLabel;
  recurInterval: number;
  isTask: boolean;
  /** Set when a #tag matched one of the user's categories. */
  categoryId: string | null;
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "sun", "sat" and "wed" are ordinary words, so short forms of those only count after on/next/this/every.
const WD_FULL = "sunday|monday|tuesday|wednesday|thursday|friday|saturday";
const WD_SAFE_SHORT = "mon|tues?|thu(?:rs?)?|fri";
const WD_ANY_SHORT = "sun|mon|tues?|wed|thu(?:rs?)?|fri|sat";
const MONTH_RE = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
// A clock time: 3, 3pm, 3:30, 3:30 p.m. — never part of a date like 10/20.
const TIME = String.raw`(?<![\d/:])(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|a|p)?(?![\d/:])`;

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, other: 2 };

/** "Side project" and #sideproject / #side-project all compare equal. */
const tagKey = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

const weekdayIndex = (word: string) => WEEKDAYS.findIndex((d) => d.startsWith(word.slice(0, 3).toLowerCase()));
const monthIndex = (word: string) => MONTHS.indexOf(word.slice(0, 3).toLowerCase());

/** Minutes since midnight, or null when the hour/minute aren't a real clock time. */
function toMinutes(hourStr: string, minStr: string | undefined, meridiem: string | undefined, inferPm: boolean): number | null {
  let h = Number(hourStr);
  const m = minStr ? Number(minStr) : 0;
  if (m > 59) return null;
  const mer = meridiem?.[0]?.toLowerCase();
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === "p" && h !== 12) h += 12;
    if (mer === "a" && h === 12) h = 0;
  } else {
    if (h > 23) return null;
    // "at 3" almost always means the afternoon.
    if (inferPm && h >= 1 && h <= 7) h += 12;
  }
  return h * 60 + m;
}

/** The next given weekday on or after `from` (or strictly after, for "next"). */
function nextWeekday(from: Date, weekday: number, strictlyAfter: boolean): Date {
  let diff = (weekday - from.getDay() + 7) % 7;
  if (diff === 0 && strictlyAfter) diff = 7;
  return addDays(from, diff);
}

/** A month/day with no year means the next time that date comes around. */
function upcomingDate(today: Date, month: number, day: number, year?: number): Date | null {
  const y = year ?? today.getFullYear();
  let d = new Date(y, month, day);
  if (d.getMonth() !== month) return null; // e.g. Feb 31
  if (year === undefined && d < today) d = new Date(y + 1, month, day);
  return d;
}

export function parseQuickAdd(input: string, now: Date = new Date(), categories: readonly Pick<Category, "id" | "name">[] = []): QuickAdd {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let rest = ` ${input} `;

  /** Removes the first match of `pattern` that `use` accepts (returning false skips to the next match). */
  const take = (pattern: string, use: (m: RegExpExecArray) => boolean | void) => {
    const re = new RegExp(pattern, "giu");
    for (let m = re.exec(rest); m; m = re.exec(rest)) {
      if (use(m) === false) {
        if (m[0] === "") re.lastIndex++;
        continue;
      }
      rest = rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length);
      return;
    }
  };

  // Assigned inside the `take` callbacks, so widen the types up front or
  // TypeScript keeps them narrowed to their initial values.
  let isTask = false as boolean;
  let categoryId = null as string | null;
  let recur = "" as RecurLabel;
  let recurInterval = 1 as number;
  let date = null as Date | null;
  let start = null as number | null;
  let end = null as number | null;
  let duration = null as number | null;
  let allDayWord = false as boolean;
  let tonight = false as boolean;

  take(String.raw`^\s*(?:task|todo)\s*:\s*`, () => { isTask = true; });
  take(String.raw`^\s*remind me to\s+`, () => { isTask = true; });
  take(String.raw`(?:^|\s)#([\p{L}\p{N}_-]+)`, (m) => {
    const match = categories.find((c) => tagKey(c.name) === tagKey(m[1]!));
    if (!match) return false; // unknown tags stay in the title
    categoryId = match.id;
  });

  // Repeats. "every other X" / "every 3 Xs" set an interval.
  const EVERY_N = String.raw`every\s+(?:(other|\d{1,2}|two|three|four|five|six)\s+)?`;
  const interval = (word: string | undefined) => (word ? NUMBER_WORDS[word.toLowerCase()] ?? Number(word) : 1);
  take(String.raw`\b${EVERY_N}(${WD_FULL}|${WD_ANY_SHORT})s?\b`, (m) => {
    recur = "Weekly";
    recurInterval = interval(m[1]);
    date = nextWeekday(today, weekdayIndex(m[2]!), false);
  });
  take(String.raw`\b${EVERY_N}(day|week|month|year)s?\b`, (m) => {
    const unit = m[2]!.toLowerCase();
    recur = unit === "day" ? "Daily" : unit === "week" ? "Weekly" : unit === "month" ? "Monthly" : "Yearly";
    recurInterval = interval(m[1]);
  });
  take(String.raw`\bbiweekly\b`, () => { recur = "Weekly"; recurInterval = 2; });
  take(String.raw`\bdaily\b`, () => { recur = "Daily"; });
  take(String.raw`\bweekly\b`, () => { recur = "Weekly"; });
  take(String.raw`\bmonthly\b`, () => { recur = "Monthly"; });
  take(String.raw`\b(?:yearly|annually)\b`, () => { recur = "Yearly"; });

  take(String.raw`\ball[- ]day\b`, () => { allDayWord = true; });

  // Times: a range first ("3-4pm", "from 10 to 11:30"), then a single time.
  take(String.raw`(\b(?:from|at)\s+)?${TIME}\s*(?:-|–|to|until|till)\s*${TIME}`, (m) => {
    const [, prefix, h1, m1, mer1, h2, m2, mer2] = m;
    if (!prefix && !mer1 && !mer2 && !m1 && !m2) return false; // "2-3 people", not a time
    let s = toMinutes(h1!, m1, mer1 ?? undefined, false);
    const e = toMinutes(h2!, m2, mer2 ?? undefined, !mer2);
    if (s === null || e === null) return false;
    // "3-4pm": the start borrows the end's am/pm unless that would put it after the end.
    if (!mer1 && mer2) {
      const borrowed = toMinutes(h1!, m1, mer2, false);
      if (borrowed !== null && borrowed < e) s = borrowed;
    } else if (!mer1 && !mer2) {
      s = toMinutes(h1!, m1, undefined, true)!;
    }
    start = s;
    end = e;
  });
  if (start === null) {
    take(String.raw`\b(?:at\s+)?(noon|midday|midnight)\b`, (m) => { start = m[1]!.toLowerCase() === "midnight" ? 0 : 720; });
  }
  if (start === null) {
    take(String.raw`(\bat\s+)?${TIME}`, (m) => {
      const [, at, h, min, mer] = m;
      if (!at && !mer && !min) return false; // a bare number is part of the title
      const t = toMinutes(h!, min, mer ?? undefined, true);
      if (t === null) return false;
      start = t;
    });
  }
  take(String.raw`\bfor\s+(\d+(?:\.\d+)?|an?|half an?)\s*(h|hrs?|hours?|m|mins?|minutes?)\b`, (m) => {
    const amount = m[1]!.toLowerCase().startsWith("half") ? 0.5 : NUMBER_WORDS[m[1]!.toLowerCase()] ?? Number(m[1]);
    duration = Math.round(amount * (m[2]!.toLowerCase().startsWith("h") ? 60 : 1));
  });

  // Dates
  take(String.raw`\btonight\b`, () => { date = today; tonight = true; });
  take(String.raw`\b(?:on\s+)?today\b`, () => { date = today; });
  take(String.raw`\b(?:on\s+)?(?:tomorrow|tmrw|tmr)\b`, () => { date = addDays(today, 1); });
  take(String.raw`\bin\s+(\d+|a|an|one|two|three|four|five|six)\s+(days?|weeks?|months?)\b`, (m) => {
    const n = NUMBER_WORDS[m[1]!.toLowerCase()] ?? Number(m[1]);
    const unit = m[2]!.toLowerCase();
    date = unit.startsWith("d") ? addDays(today, n)
      : unit.startsWith("w") ? addDays(today, n * 7)
      : new Date(today.getFullYear(), today.getMonth() + n, today.getDate());
  });
  take(String.raw`\b(?:on\s+)?(?:(next|this)\s+)?(${WD_FULL}|${WD_SAFE_SHORT})\b`, (m) => {
    date = nextWeekday(today, weekdayIndex(m[2]!), m[1]?.toLowerCase() === "next");
  });
  take(String.raw`\b(on|next|this)\s+(${WD_ANY_SHORT})\b`, (m) => {
    date = nextWeekday(today, weekdayIndex(m[2]!), m[1]!.toLowerCase() === "next");
  });
  take(String.raw`\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(${MONTH_RE})\b`, (m) => {
    const d = upcomingDate(today, monthIndex(m[2]!), Number(m[1]));
    if (!d) return false;
    date = d;
  });
  take(String.raw`\b(?:on\s+)?(${MONTH_RE})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?`, (m) => {
    const d = upcomingDate(today, monthIndex(m[1]!), Number(m[2]), m[3] ? Number(m[3]) : undefined);
    if (!d) return false;
    date = d;
  });
  take(String.raw`\b(?:on\s+)?(\d{1,2})/(\d{1,2})(?:/(\d{2}|\d{4}))?\b`, (m) => {
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
    const d = upcomingDate(today, Number(m[1]) - 1, Number(m[2]), year);
    if (!d) return false;
    date = d;
  });
  take(String.raw`\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b`, (m) => {
    const day = Number(m[1]);
    const d = upcomingDate(today, today.getMonth(), day) ?? upcomingDate(today, today.getMonth() + 1, day);
    if (!d) return false;
    date = d;
  });

  if (tonight && start === null) start = 19 * 60;

  // Whatever is left is the title, minus connecting words stranded at the edges.
  const EDGE = /^(?:on|at|from|for|in|by|this|next|every|and|,|-|–)\s+|\s+(?:on|at|from|for|in|by|this|next|every|and|,|-|–)$/i;
  let title = rest.replace(/\s+/g, " ").trim();
  for (let prev = ""; prev !== title;) {
    prev = title;
    title = title.replace(EDGE, "").trim();
  }
  if (/^(?:on|at|from|for|in|by|this|next|every|and)$/i.test(title)) title = "";
  title = title.charAt(0).toUpperCase() + title.slice(1);

  const dateMentioned = date !== null;
  let finalDate: Date = date ?? today;
  // "gym at 7am" typed at 9pm means tomorrow.
  if (!dateMentioned && start !== null && !isTask) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (start <= nowMinutes) finalDate = addDays(today, 1);
  }

  const allDay = isTask || allDayWord || start === null;
  let time = "";
  let endTime = "";
  if (!allDay && start !== null) {
    time = fromMinutes(start);
    const naturalEnd = end ?? start + (duration ?? 60);
    // Past midnight (e.g. "11pm-1am") stops at the end of the day.
    endTime = naturalEnd > start ? fromMinutes(naturalEnd) : fromMinutes(24 * 60 - 1);
  }

  return {
    title, date: toIsoDate(finalDate), dateMentioned, time, end: endTime, allDay,
    recur: isTask ? "" : recur, recurInterval: isTask || !recur ? 1 : recurInterval, isTask, categoryId,
  };
}

/** The draft the command bar saves, or opens in the editor. */
export function quickAddToEvent(q: QuickAdd): CalEvent {
  return {
    ...emptyEvent(q.date),
    title: q.title,
    time: q.time,
    end: q.end,
    allDay: q.allDay,
    categoryId: q.categoryId,
    recur: q.recur,
    recurInterval: q.recurInterval,
    isTask: q.isTask,
    ...(q.isTask ? { remind: "1-day" as const, priority: "medium" as const } : {}),
  };
}
