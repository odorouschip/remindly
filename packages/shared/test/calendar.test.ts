import { describe, expect, it } from "vitest";
import {
  buildDefaultReminders,
  createLiveActivityState,
  expandOccurrences,
  getCountdownPhase,
  reminderDueAt,
  type CalendarEvent,
} from "../src";

const baseEvent: CalendarEvent = {
  id: "event-1",
  userId: "user-1",
  title: "Studio time",
  notes: null,
  startsAt: "2026-05-01T14:00:00.000Z",
  endsAt: "2026-05-01T15:00:00.000Z",
  timezone: "America/New_York",
  isAllDay: false,
  repeatFrequency: "none",
  repeatUntil: null,
  isArchived: false,
  deletedAt: null,
};

describe("reminder timing", () => {
  it("computes due time from the event start", () => {
    expect(reminderDueAt(baseEvent.startsAt, 30)).toBe("2026-05-01T13:30:00.000Z");
  });

  it("builds the default countdown reminders", () => {
    const reminders = buildDefaultReminders(baseEvent);
    expect(reminders.map((reminder) => reminder.offsetMinutes)).toEqual([30, 10, 0]);
    expect(reminders[0]?.channel).toBe("live_activity");
  });
});

describe("occurrence expansion", () => {
  it("returns a one-off event inside the window", () => {
    expect(expandOccurrences(baseEvent, "2026-05-01T00:00:00.000Z", "2026-05-02T00:00:00.000Z")).toHaveLength(1);
  });

  it("expands weekly repeats until the repeat end", () => {
    const event = {
      ...baseEvent,
      repeatFrequency: "weekly" as const,
      repeatUntil: "2026-05-22T14:00:00.000Z",
    };

    const occurrences = expandOccurrences(event, "2026-05-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z");
    expect(occurrences.map((occurrence) => occurrence.startsAt)).toEqual([
      "2026-05-01T14:00:00.000Z",
      "2026-05-08T14:00:00.000Z",
      "2026-05-15T14:00:00.000Z",
      "2026-05-22T14:00:00.000Z",
    ]);
  });

  it("clamps monthly repeats to the last valid day of the month", () => {
    const event = {
      ...baseEvent,
      startsAt: "2026-01-31T14:00:00.000Z",
      endsAt: "2026-01-31T15:00:00.000Z",
      repeatFrequency: "monthly" as const,
      repeatUntil: "2026-03-31T14:00:00.000Z",
    };

    const occurrences = expandOccurrences(event, "2026-01-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z");
    expect(occurrences.map((occurrence) => occurrence.startsAt)).toEqual([
      "2026-01-31T14:00:00.000Z",
      "2026-02-28T14:00:00.000Z",
      "2026-03-31T14:00:00.000Z",
    ]);
  });
});

describe("live activity state", () => {
  it("marks events as starting inside the final minute", () => {
    expect(getCountdownPhase("2026-05-01T13:59:10.000Z", baseEvent.startsAt, baseEvent.endsAt)).toBe("starting");
  });

  it("creates deep-linkable live activity content", () => {
    expect(createLiveActivityState(baseEvent, "2026-05-01T13:50:00.000Z")).toMatchObject({
      phase: "upcoming",
      urgency: "soon",
      deepLinkUrl: "calender://events/event-1",
    });
  });
});
