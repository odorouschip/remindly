import { describe, expect, it } from "vitest";
import { byDay, occurrencesBetween } from "../lib/calendar/recurrence";
import { rowToEvent } from "../lib/calendar/supabaseBackend";
import { emptyEvent, type CalEvent } from "../lib/calendar/types";

const base: CalEvent = { ...emptyEvent("2026-01-31"), id: "e1", title: "T", time: "09:00", end: "10:00" };
const dates = (ev: Partial<CalEvent>, from: string, to: string) =>
  occurrencesBetween([{ ...base, endDate: ev.date ?? base.date, ...ev }], from, to).map((e) => e.date);

describe("occurrencesBetween", () => {
  it("keeps one-off events only inside the window", () => {
    expect(dates({}, "2026-01-01", "2026-01-31")).toEqual(["2026-01-31"]);
    expect(dates({}, "2026-02-01", "2026-02-28")).toEqual([]);
  });

  it("expands daily from the window start and stops at the end date", () => {
    expect(dates({ recur: "Daily", date: "2026-01-01", recurUntil: "2026-03-03" }, "2026-03-01", "2026-03-10"))
      .toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
  });

  it("expands weekly across a daylight-saving change", () => {
    expect(dates({ recur: "Weekly", date: "2026-03-01" }, "2026-03-01", "2026-03-22"))
      .toEqual(["2026-03-01", "2026-03-08", "2026-03-15", "2026-03-22"]);
  });

  it("skips months that lack the day for monthly repeats", () => {
    expect(dates({ recur: "Monthly" }, "2026-01-01", "2026-05-31"))
      .toEqual(["2026-01-31", "2026-03-31", "2026-05-31"]);
  });

  it("repeats yearly and never before the first date", () => {
    expect(dates({ recur: "Yearly", date: "2026-07-04" }, "2025-01-01", "2028-12-31"))
      .toEqual(["2026-07-04", "2027-07-04", "2028-07-04"]);
  });
});

describe("rowToEvent", () => {
  const row = {
    id: "r1", user_id: "u1", kind: "event" as const, title: "Trip", notes: "Pack light", location: "Denver",
    category_id: "c1", timezone: "America/New_York", repeat_freq: null, repeat_interval: 1, repeat_until: null,
    priority: null, completed_at: null, source: "manual", external_id: null, deleted_at: null,
    created_at: "", updated_at: "", reminders: [],
  };

  it("keeps all-day dates as dates, including multi-day spans", () => {
    const ev = rowToEvent({ ...row, all_day: true, start_date: "2026-07-04", end_date: "2026-07-06", starts_at: null, ends_at: null });
    expect(ev).toMatchObject({ date: "2026-07-04", endDate: "2026-07-06", allDay: true, time: "", desc: "Pack light", location: "Denver", categoryId: "c1" });
  });

  it("shows timed events in local time", () => {
    const ev = rowToEvent({
      ...row, all_day: false, start_date: null, end_date: null,
      starts_at: new Date(2026, 6, 4, 9, 30).toISOString(), ends_at: new Date(2026, 6, 4, 10).toISOString(),
    });
    expect(ev).toMatchObject({ date: "2026-07-04", endDate: "2026-07-04", allDay: false, time: "09:30", end: "10:00" });
  });

  it("reads task reminders back as the option that made them", () => {
    const task = { ...row, kind: "task" as const, all_day: true, start_date: "2026-07-04", end_date: "2026-07-04", starts_at: null, ends_at: null, priority: "high" as const };
    expect(rowToEvent({ ...task, reminders: [{ offset_minutes: 900 }] })).toMatchObject({ isTask: true, remind: "1-day", priority: "high" });
    expect(rowToEvent({ ...task, reminders: [{ offset_minutes: -540 }] })).toMatchObject({ remind: "at-time" });
    expect(rowToEvent({ ...task, reminders: [{ offset_minutes: -420 }] })).toMatchObject({ remind: "custom", remindMinutes: 120 });
    expect(rowToEvent({ ...task, reminders: [] })).toMatchObject({ remind: "none" });
    expect(rowToEvent({ ...task, completed_at: "2026-07-01T00:00:00Z" })).toMatchObject({ done: true });
  });
});

describe("intervals and spans", () => {
  it("repeats every other week", () => {
    expect(dates({ recur: "Weekly", recurInterval: 2, date: "2026-03-02" }, "2026-03-01", "2026-04-01"))
      .toEqual(["2026-03-02", "2026-03-16", "2026-03-30"]);
  });

  it("repeats every 3 months", () => {
    expect(dates({ recur: "Monthly", recurInterval: 3, date: "2026-01-15" }, "2026-01-01", "2026-12-31"))
      .toEqual(["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
  });

  it("includes a multi-day occurrence that started before the window", () => {
    const evs = occurrencesBetween([{ ...base, allDay: true, time: "", end: "", date: "2026-02-27", endDate: "2026-03-02" }], "2026-03-01", "2026-03-31");
    expect(byDay(evs, "2026-03-01", "2026-03-31").map((e) => e.date)).toEqual(["2026-03-01", "2026-03-02"]);
  });
});
