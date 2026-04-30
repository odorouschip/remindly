export const REMINDER_PRESETS_MINUTES = [30, 10, 0] as const;

export type RepeatFrequency = "none" | "daily" | "weekly" | "monthly";
export type ReminderChannel = "live_activity" | "notification";
export type CountdownPhase = "upcoming" | "starting" | "in_progress" | "ended" | "stale";
export type UrgencyLevel = "calm" | "soon" | "now";

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  isAllDay: boolean;
  repeatFrequency: RepeatFrequency;
  repeatUntil: string | null;
  isArchived: boolean;
  deletedAt: string | null;
}

export interface Reminder {
  id: string;
  eventId: string;
  userId: string;
  offsetMinutes: number;
  channel: ReminderChannel;
  dueAt: string;
  deliveredAt: string | null;
}

export interface EventOccurrence {
  eventId: string;
  startsAt: string;
  endsAt: string;
  sequence: number;
}

export interface LiveActivityContentState {
  eventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  phase: CountdownPhase;
  urgency: UrgencyLevel;
  deepLinkUrl: string;
}

const MINUTE_MS = 60_000;

export function reminderDueAt(startsAt: string, offsetMinutes: number): string {
  if (!Number.isInteger(offsetMinutes) || offsetMinutes < 0) {
    throw new Error("Reminder offset must be a non-negative integer.");
  }

  const startDate = parseIsoDate(startsAt, "startsAt");
  return new Date(startDate.getTime() - offsetMinutes * MINUTE_MS).toISOString();
}

export function buildDefaultReminders(
  event: Pick<CalendarEvent, "id" | "userId" | "startsAt">,
  offsets: readonly number[] = REMINDER_PRESETS_MINUTES,
): Array<Omit<Reminder, "id" | "deliveredAt">> {
  return offsets.map((offsetMinutes) => ({
    eventId: event.id,
    userId: event.userId,
    offsetMinutes,
    channel: "live_activity",
    dueAt: reminderDueAt(event.startsAt, offsetMinutes),
  }));
}

export function getCountdownPhase(nowIso: string, startsAt: string, endsAt: string): CountdownPhase {
  const now = parseIsoDate(nowIso, "nowIso").getTime();
  const start = parseIsoDate(startsAt, "startsAt").getTime();
  const end = parseIsoDate(endsAt, "endsAt").getTime();

  if (now >= end) return "ended";
  if (now >= start) return "in_progress";
  if (start - now <= MINUTE_MS) return "starting";
  return "upcoming";
}

export function getUrgencyLevel(nowIso: string, startsAt: string): UrgencyLevel {
  const now = parseIsoDate(nowIso, "nowIso").getTime();
  const start = parseIsoDate(startsAt, "startsAt").getTime();
  const minutesUntilStart = (start - now) / MINUTE_MS;

  if (minutesUntilStart <= 1) return "now";
  if (minutesUntilStart <= 10) return "soon";
  return "calm";
}

export function expandOccurrences(
  event: Pick<CalendarEvent, "id" | "startsAt" | "endsAt" | "repeatFrequency" | "repeatUntil" | "deletedAt" | "isArchived">,
  windowStartIso: string,
  windowEndIso: string,
): EventOccurrence[] {
  if (event.deletedAt || event.isArchived) return [];

  const windowStart = parseIsoDate(windowStartIso, "windowStartIso");
  const windowEnd = parseIsoDate(windowEndIso, "windowEndIso");
  const originalStart = parseIsoDate(event.startsAt, "startsAt");
  const originalEnd = parseIsoDate(event.endsAt, "endsAt");

  if (windowEnd <= windowStart) {
    throw new Error("Occurrence window end must be after window start.");
  }

  const durationMs = originalEnd.getTime() - originalStart.getTime();
  if (durationMs <= 0) {
    throw new Error("Event end time must be after start time.");
  }

  const repeatUntil = event.repeatUntil ? parseIsoDate(event.repeatUntil, "repeatUntil") : null;
  const occurrences: EventOccurrence[] = [];
  let cursor = new Date(originalStart);
  let sequence = 0;

  while (cursor < windowEnd) {
    const occurrenceEnd = new Date(cursor.getTime() + durationMs);
    const isAfterRepeatEnd = repeatUntil ? cursor > repeatUntil : false;

    if (isAfterRepeatEnd) break;
    if (occurrenceEnd > windowStart && cursor < windowEnd) {
      occurrences.push({
        eventId: event.id,
        startsAt: cursor.toISOString(),
        endsAt: occurrenceEnd.toISOString(),
        sequence,
      });
    }

    if (event.repeatFrequency === "none") break;
    cursor = advanceDate(cursor, event.repeatFrequency, originalStart.getUTCDate());
    sequence += 1;
  }

  return occurrences;
}

export function createLiveActivityState(
  event: Pick<CalendarEvent, "id" | "title" | "startsAt" | "endsAt">,
  nowIso: string,
): LiveActivityContentState {
  return {
    eventId: event.id,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    phase: getCountdownPhase(nowIso, event.startsAt, event.endsAt),
    urgency: getUrgencyLevel(nowIso, event.startsAt),
    deepLinkUrl: `calender://events/${event.id}`,
  };
}

function advanceDate(date: Date, frequency: RepeatFrequency, preferredDayOfMonth: number): Date {
  const next = new Date(date);

  if (frequency === "daily") {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  if (frequency === "weekly") {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  if (frequency === "monthly") {
    const targetMonth = next.getUTCMonth() + 1;
    next.setUTCDate(1);
    next.setUTCMonth(targetMonth);
    next.setUTCDate(Math.min(preferredDayOfMonth, daysInUtcMonth(next.getUTCFullYear(), next.getUTCMonth())));
    return next;
  }

  return next;
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function parseIsoDate(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid ISO date string.`);
  }
  return date;
}
