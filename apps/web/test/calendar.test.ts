import { describe, expect, it } from "vitest";
import { applyToSeries, changesSeriesOnly, endBefore, hasChanges, overrideFor } from "../lib/calendar/occurrenceEdits";
import { byDay, occurrenceKey, occurrenceOf, occurrencesBetween } from "../lib/calendar/recurrence";
import { chipTime, timeColumnLabel, whenLabel } from "../lib/calendar/display";
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

const row = {
  id: "r1", user_id: "u1", kind: "event" as const, title: "Trip", notes: "Pack light", location: "Denver",
  category_id: "c1", timezone: "America/New_York", repeat_freq: null, repeat_interval: 1, repeat_until: null,
  priority: null, completed_at: null, source: "manual", external_id: null, deleted_at: null,
  created_at: "", updated_at: "", reminders: [],
};
const exceptionRow = {
  id: "x", event_id: "r1", user_id: "u1", occurrence_date: "", cancelled: false, title: null, notes: null, location: null, category_id: null,
  starts_at: null, ends_at: null, start_date: null, end_date: null, created_at: "", updated_at: "",
};

describe("rowToEvent", () => {

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

describe("multi-day timed events", () => {
  const trip: CalEvent = { ...base, id: "t", date: "2026-10-17", endDate: "2026-10-19", time: "10:00", end: "11:00" };
  const split = (ev: CalEvent) => byDay([ev], "2026-10-01", "2026-10-31");

  it("shows the start, then all day, then the end — not the range on every day", () => {
    const days = split(trip);
    expect(days.map((d) => [d.date, d.segment?.part, timeColumnLabel(d)])).toEqual([
      ["2026-10-17", "first", "10:00 AM"],
      ["2026-10-18", "middle", "All day"],
      ["2026-10-19", "last", "Until 11:00 AM"],
    ]);
    expect(days.every((d) => d.segment?.fullDay)).toBe(true);
    expect(whenLabel(days[0]!)).toMatch(/^10:00 AM – .+, 11:00 AM$/);
    expect(chipTime(days[1]!)).toBe("");
  });

  it("keeps a short overnight event out of the all-day row", () => {
    const flight = split({ ...trip, date: "2026-10-17", endDate: "2026-10-18", time: "23:00", end: "01:00" });
    expect(flight.map((d) => d.segment)).toEqual([{ part: "first", fullDay: false }, { part: "last", fullDay: false }]);
  });

  it("doesn't spill onto the next day when it ends at midnight", () => {
    const late = split({ ...trip, date: "2026-10-17", endDate: "2026-10-18", time: "22:00", end: "00:00" });
    expect(late.map((d) => d.date)).toEqual(["2026-10-17"]);
  });
});

describe("one occurrence of a repeating event", () => {
  const standup: CalEvent = { ...base, title: "Standup", date: "2026-10-19", endDate: "2026-10-19", time: "09:30", end: "09:45", recur: "Daily" };
  const week = (ev: CalEvent) => occurrencesBetween([ev], "2026-10-19", "2026-10-25");

  it("skips a cancelled occurrence", () => {
    const ev = { ...standup, exceptions: { "2026-10-21": { cancelled: true } } };
    expect(week(ev).map((e) => e.date)).not.toContain("2026-10-21");
    expect(week(ev)).toHaveLength(6);
  });

  it("shows a moved occurrence on its new day and time, keyed by its original date", () => {
    const ev = { ...standup, exceptions: { "2026-10-21": { cancelled: false, title: "Late standup", date: "2026-10-22", endDate: "2026-10-22", time: "16:00", end: "16:30" } } };
    const thursday = week(ev).filter((e) => e.date === "2026-10-22");
    expect(thursday.map((e) => [e.title, e.time, e.occurrenceDate])).toEqual([
      ["Standup", "09:30", "2026-10-22"],
      ["Late standup", "16:00", "2026-10-21"],
    ]);
    expect(week(ev).some((e) => e.date === "2026-10-21")).toBe(false);
    expect(new Set(week(ev).map(occurrenceKey)).size).toBe(week(ev).length);
  });

  it("finds an occurrence moved into the window from outside it", () => {
    const ev = { ...standup, recurUntil: "2026-10-20", exceptions: { "2026-10-20": { cancelled: false, date: "2026-11-02", endDate: "2026-11-02", time: "09:30", end: "09:45" } } };
    expect(occurrencesBetween([ev], "2026-11-01", "2026-11-07").map((e) => e.occurrenceDate)).toEqual(["2026-10-20"]);
  });

  it("ignores exceptions for dates the series doesn't fall on", () => {
    const weekly = { ...standup, recur: "Weekly" as const, exceptions: { "2026-10-20": { cancelled: false, date: "2026-10-24", endDate: "2026-10-24", time: "10:00", end: "11:00" } } };
    expect(week(weekly).map((e) => e.date)).toEqual(["2026-10-19"]);
  });

  it("stores only what changed for “This event”, and nothing once it matches again", () => {
    const shown = occurrenceOf(standup, "2026-10-21");
    expect(overrideFor(standup, "2026-10-21", { ...shown, title: "Retro" })).toEqual({ cancelled: false, title: "Retro" });
    expect(overrideFor(standup, "2026-10-21", { ...shown, time: "10:00", end: "10:15" }))
      .toEqual({ cancelled: false, date: "2026-10-21", endDate: "2026-10-21", time: "10:00", end: "10:15" });
    const moved = { ...standup, exceptions: { "2026-10-21": { cancelled: false, title: "Retro" } } };
    expect(overrideFor(moved, "2026-10-21", { ...shown, title: "Standup" })).toBeNull();
  });

  it("moves the whole series by the same number of days for “All events”", () => {
    const shown = occurrenceOf(standup, "2026-10-21");
    const series = applyToSeries(standup, shown, { ...shown, date: "2026-10-22", endDate: "2026-10-22", time: "10:00", end: "10:15" });
    expect(series).toMatchObject({ date: "2026-10-20", endDate: "2026-10-20", time: "10:00", end: "10:15", recur: "Daily" });
    expect(series.occurrenceDate).toBeUndefined();
  });

  it("asks only about changes one occurrence can hold", () => {
    const shown = occurrenceOf(standup, "2026-10-21");
    expect(hasChanges(shown, { ...shown })).toBe(false);
    expect(changesSeriesOnly(shown, { ...shown, title: "x" })).toBe(false);
    expect(changesSeriesOnly(shown, { ...shown, recurInterval: 2 })).toBe(true);
    expect(changesSeriesOnly(shown, { ...shown, allDay: true })).toBe(true);
  });

  it("ends the series the day before for “This and following”", () => {
    expect(endBefore(standup, "2026-10-23")?.recurUntil).toBe("2026-10-22");
    expect(endBefore(standup, "2026-10-19")).toBeNull();
  });

  it("reads exception rows, keeping the series' length when a moved one has no end", () => {
    const ev = rowToEvent({
      ...row, all_day: false, start_date: null, end_date: null, repeat_freq: "daily",
      starts_at: new Date(2026, 9, 19, 9, 30).toISOString(), ends_at: new Date(2026, 9, 19, 9, 45).toISOString(),
      event_exceptions: [
        { ...exceptionRow, occurrence_date: "2026-10-21", cancelled: true },
        { ...exceptionRow, occurrence_date: "2026-10-22", title: "Retro", starts_at: new Date(2026, 9, 22, 16).toISOString(), ends_at: null },
      ],
    });
    expect(ev.exceptions).toEqual({
      "2026-10-21": { cancelled: true },
      "2026-10-22": { cancelled: false, title: "Retro", date: "2026-10-22", endDate: "2026-10-22", time: "16:00", end: "16:15" },
    });
  });
});
