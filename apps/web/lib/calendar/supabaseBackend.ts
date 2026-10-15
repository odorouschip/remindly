import type { SupabaseClient } from "@supabase/supabase-js";
import { REMINDER_PRESETS_MINUTES, reminderDueAt, type RepeatFrequency } from "@calender/shared";
import type { Database, EventRow, ReminderRow } from "@/lib/supabase/client";
import type { CalendarBackend } from "./backend";
import { isoToLocalParts, localDateTimeToIso, p2, toIsoDate } from "./dates";
import { packNotes, unpackNotes } from "./notes";
import { REMIND_TO_MIN, type CalEvent, type CategoryId, type Priority, type RecurLabel, type RemindKey } from "./types";

type EventWithReminders = EventRow & { reminders: ReminderRow[] };

const RECUR_TO_DB: Record<RecurLabel, RepeatFrequency> = {
  "":        "none",
  "Daily":   "daily",
  "Weekly":  "weekly",
  "Monthly": "monthly",
  "Yearly":  "none", // Yearly is preserved in meta only
};

// Rows written by other tools (e.g. imported holidays) can span a full day
// without setting is_all_day.
const FULL_DAY_MS = (24 * 60 - 1) * 60_000;

/**
 * The calendar day an all-day row belongs to. Ours are stored at local
 * midnight; imported ones at UTC midnight, which would land on the previous
 * evening west of UTC if read as local time.
 */
function allDayDate(iso: string): string {
  const d = new Date(iso);
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
    return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
  }
  return toIsoDate(d);
}

export function rowToEvent(row: EventWithReminders): CalEvent {
  const { desc, meta } = unpackNotes(row.notes);
  const isTask = Boolean(meta.isTask);
  const allDay = isTask || row.is_all_day || Date.parse(row.ends_at) - Date.parse(row.starts_at) >= FULL_DAY_MS;
  const start = isoToLocalParts(row.starts_at);
  const end = isoToLocalParts(row.ends_at);
  const recurFromMeta = (meta.recur as RecurLabel | undefined) ?? "";
  const recur: RecurLabel = recurFromMeta || (
    row.repeat_frequency === "daily"   ? "Daily"
    : row.repeat_frequency === "weekly"  ? "Weekly"
    : row.repeat_frequency === "monthly" ? "Monthly"
    : ""
  );
  return {
    id: row.id,
    title: row.title,
    date: allDay ? allDayDate(row.starts_at) : start.date,
    time: allDay ? "" : start.time,
    end: allDay ? "" : end.time,
    allDay,
    cat: (meta.cat as CategoryId | undefined) ?? "work",
    recur,
    recurUntil: row.repeat_until ? isoToLocalParts(row.repeat_until).date : "",
    isTask,
    desc,
    remind: meta.remind as RemindKey | undefined,
    remindMinutes: typeof meta.remindMin === "number" ? meta.remindMin : undefined,
    priority: meta.priority as Priority | undefined,
  };
}

function reminderOffsets(ev: CalEvent): number[] {
  if (ev.isTask) {
    if (!ev.remind) return [];
    const minutes = ev.remind === "custom" ? ev.remindMinutes : REMIND_TO_MIN[ev.remind];
    return minutes === undefined ? [] : [minutes];
  }
  // A countdown to midnight isn't useful, so all-day events get none.
  return ev.allDay ? [] : [...REMINDER_PRESETS_MINUTES];
}

export function createSupabaseBackend(supabase: SupabaseClient<Database>, userId: string): CalendarBackend {
  return {
    kind: "supabase",

    async listEvents() {
      const { data, error } = await supabase
        .from("events")
        .select("*, reminders(*)")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("starts_at", { ascending: true });
      if (error) throw new Error(error.message);
      return ((data ?? []) as EventWithReminders[]).map(rowToEvent);
    },

    async saveEvent(ev) {
      // Tasks sit at 9:00 so "at due time" reminders fire in the morning.
      const [startTime, endTime] = ev.isTask ? ["09:00", "09:30"]
        : ev.allDay ? ["00:00", "23:59"]
        : [ev.time || "09:00", ev.end || "10:00"];
      const startsAtIso = localDateTimeToIso(ev.date, startTime);
      const endsAtIso   = localDateTimeToIso(ev.date, endTime);
      const meta = {
        cat: ev.cat,
        isTask: ev.isTask,
        ...(ev.priority ? { priority: ev.priority } : {}),
        ...(ev.remind   ? { remind: ev.remind } : {}),
        ...(ev.remind === "custom" && ev.remindMinutes !== undefined ? { remindMin: ev.remindMinutes } : {}),
        ...(ev.recur === "Yearly" ? { recur: "Yearly" } : {}),
      };
      const payload = {
        user_id: userId,
        title: ev.title.trim() || (ev.isTask ? "Untitled task" : "Untitled event"),
        notes: packNotes(ev.desc, meta),
        starts_at: startsAtIso,
        ends_at: endsAtIso,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        is_all_day: ev.allDay,
        repeat_frequency: RECUR_TO_DB[ev.recur],
        repeat_until: ev.recur && ev.recurUntil ? localDateTimeToIso(ev.recurUntil, "23:59") : null,
        is_archived: false,
        deleted_at: null,
      };

      const { data: saved, error } = ev.id
        ? await supabase.from("events").update(payload).eq("id", ev.id).select("*").single()
        : await supabase.from("events").insert(payload).select("*").single();
      if (error || !saved) throw new Error(error?.message ?? "Could not save.");

      // Reminders are replaced wholesale on every save.
      const { error: deleteError } = await supabase.from("reminders").delete().eq("event_id", saved.id);
      if (deleteError) throw new Error(deleteError.message);

      const offsets = reminderOffsets(ev);
      if (offsets.length > 0) {
        const { error: insertError } = await supabase.from("reminders").insert(offsets.map((offset) => ({
          event_id: saved.id,
          user_id: userId,
          offset_minutes: offset,
          channel: "live_activity" as const,
          due_at: reminderDueAt(startsAtIso, offset),
          delivered_at: null,
        })));
        if (insertError) throw new Error(insertError.message);
      }
    },

    async deleteEvent(id) {
      const { error } = await supabase.from("events").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
