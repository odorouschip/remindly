// Calendar dates are local-time "YYYY-MM-DD" strings; times are "HH:MM".

export const MONTHS: readonly string[] = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const WEEKDAYS: readonly string[] = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export const monthName = (m: number): string => MONTHS[m] ?? "";
export const weekdayShort = (i: number): string => WEEKDAYS[i] ?? "";

export function p2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

export function firstWeekday(y: number, m: number): number {
  return new Date(y, m, 1).getDay();
}

/** The 7-day-aligned grid of dates covering a month, including spill-over days. */
export function monthGrid(y: number, m: number): Date[] {
  const start = addDays(new Date(y, m, 1), -firstWeekday(y, m));
  const count = Math.ceil((firstWeekday(y, m) + daysInMonth(y, m)) / 7) * 7;
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function weekOf(d: Date): Date[] {
  const start = addDays(d, -d.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function minutesOf(t: string): number {
  const [h, m] = t.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

/** "9:30 AM" */
export function fmtTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number) as [number, number];
  return `${h % 12 || 12}:${p2(m)} ${h >= 12 ? "PM" : "AM"}`;
}

/** "9:30am" / "7pm" — for tight spots like month cells. */
export function fmtTimeShort(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number) as [number, number];
  return `${h % 12 || 12}${m ? `:${p2(m)}` : ""}${h >= 12 ? "pm" : "am"}`;
}

/** "10 – 11am", "12:30 – 1:30pm", "11am – 1pm" */
export function fmtTimeRangeShort(start: string, end: string): string {
  if (!start) return "";
  if (!end) return fmtTimeShort(start);
  const sameHalf = (minutesOf(start) < 720) === (minutesOf(end) < 720);
  const s = sameHalf ? fmtTimeShort(start).replace(/[ap]m$/, "") : fmtTimeShort(start);
  return `${s} – ${fmtTimeShort(end)}`;
}

/** "9 AM" / "12 PM" */
export function hourLabel(h: number): string {
  return `${h % 12 || 12} ${h >= 12 && h < 24 ? "PM" : "AM"}`;
}

export function fmtTimeRange(start: string, end: string): string {
  if (!start) return "";
  return end ? `${fmtTime(start)} – ${fmtTime(end)}` : fmtTime(start);
}

/** "Today", "Tomorrow", or e.g. "Thu, Oct 15" (long: "Thursday, October 15"). */
export function relativeDayLabel(date: string, long = false): string {
  const today = todayIso();
  if (date === today) return "Today";
  if (date === toIsoDate(addDays(parseIsoDate(today), 1))) return "Tomorrow";
  return parseIsoDate(date).toLocaleDateString("en-US", long
    ? { weekday: "long", month: "long", day: "numeric" }
    : { weekday: "short", month: "short", day: "numeric" });
}

/** Local date + time → ISO timestamp. */
export function localDateTimeToIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = (time || "09:00").split(":").map(Number) as [number, number];
  return new Date(y, m - 1, d, h, mi, 0, 0).toISOString();
}

/** ISO timestamp → local date + time. */
export function isoToLocalParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return { date: toIsoDate(d), time: `${p2(d.getHours())}:${p2(d.getMinutes())}` };
}
