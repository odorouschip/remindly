import { describe, expect, it } from "vitest";
import { packNotes, unpackNotes } from "../lib/calendar/notes";
import { occurrencesBetween } from "../lib/calendar/recurrence";
import { rowToEvent } from "../lib/calendar/supabaseBackend";
import type { CalEvent } from "../lib/calendar/types";

describe("notes metadata", () => {
  it("round-trips a description and metadata", () => {
    const packed = packNotes("Bring dessert", { cat: "social" });
    expect(unpackNotes(packed)).toEqual({ desc: "Bring dessert", meta: { cat: "social" } });
  });

  it("reads the bare sentinel the iOS app writes", () => {
    expect(unpackNotes('%%META%%{"cat":"personal","isTask":false}'))
      .toEqual({ desc: "", meta: { cat: "personal", isTask: false } });
  });

  it("never leaks a corrupt blob into the description", () => {
    expect(unpackNotes("Hello\n\n%%META%%{oops")).toEqual({ desc: "Hello", meta: {} });
  });

  it("writes no blank lines when there's no description", () => {
    expect(packNotes("  ", { cat: "work" })).toBe('%%META%%{"cat":"work"}');
  });
});

const base: CalEvent = {
  id: "e1", title: "T", date: "2026-01-31", time: "09:00", end: "10:00", allDay: false,
  cat: "work", recur: "", recurUntil: "", isTask: false, desc: "",
};
const dates = (ev: Partial<CalEvent>, from: string, to: string) =>
  occurrencesBetween([{ ...base, ...ev }], from, to).map((e) => e.date);

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
    id: "r1", user_id: "u1", title: "Independence Day", timezone: "UTC", repeat_frequency: "none" as const,
    repeat_until: null, is_archived: false, deleted_at: null, created_at: "", updated_at: "", reminders: [],
  };

  it("treats an unflagged UTC full-day row as all-day on its own date", () => {
    const ev = rowToEvent({
      ...row, is_all_day: false, notes: '%%META%%{"cat":"personal","isTask":false}',
      starts_at: "2026-07-04T00:00:00+00:00", ends_at: "2026-07-04T23:59:00+00:00",
    });
    expect(ev).toMatchObject({ date: "2026-07-04", allDay: true, time: "", end: "", desc: "", cat: "personal" });
  });

  it("keeps timed events in local time", () => {
    const ev = rowToEvent({
      ...row, is_all_day: false, notes: null,
      starts_at: new Date(2026, 6, 4, 9, 30).toISOString(), ends_at: new Date(2026, 6, 4, 10).toISOString(),
    });
    expect(ev).toMatchObject({ date: "2026-07-04", allDay: false, time: "09:30", end: "10:00" });
  });
});
