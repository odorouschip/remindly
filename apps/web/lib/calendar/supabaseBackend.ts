import type { SupabaseClient } from "@supabase/supabase-js";
import { REMINDER_PRESETS_MINUTES, reminderDueAt, type RepeatFrequency } from "@calender/shared";
import type { Database, EventRow, ReminderRow } from "@/lib/supabase/client";
import type { CalendarBackend } from "./backend";
import { isoToLocalParts, localDateTimeToIso } from "./dates";
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

function rowToEvent(row: EventWithReminders): CalEvent {
  const { desc, meta } = unpackNotes(row.notes);
  const start = isoToLocalParts(row.starts_at);
  const end = isoToLocalParts(row.ends_at);
  const isTask = Boolean(meta.isTask);
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
    date: start.date,
    time: isTask ? "" : start.time,
    end: isTask ? "" : end.time,
    cat: (meta.cat as CategoryId | undefined) ?? "work",
    recur,
    isTask,
    desc,
    remind: meta.remind as RemindKey | undefined,
    priority: meta.priority as Priority | undefined,
  };
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
      const startsAtIso = localDateTimeToIso(ev.date, ev.isTask ? "09:00" : ev.time || "09:00");
      const endsAtIso   = localDateTimeToIso(ev.date, ev.isTask ? "09:30" : ev.end  || "10:00");
      const meta = {
        cat: ev.cat,
        isTask: ev.isTask,
        ...(ev.priority ? { priority: ev.priority } : {}),
        ...(ev.remind   ? { remind: ev.remind } : {}),
        ...(ev.recur === "Yearly" ? { recur: "Yearly" } : {}),
      };
      const payload = {
        user_id: userId,
        title: ev.title.trim() || (ev.isTask ? "Untitled task" : "Untitled event"),
        notes: packNotes(ev.desc, meta),
        starts_at: startsAtIso,
        ends_at: endsAtIso,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        is_all_day: ev.isTask,
        repeat_frequency: RECUR_TO_DB[ev.recur],
        repeat_until: null,
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

      const offsets: number[] = ev.isTask
        ? (ev.remind && ev.remind !== "custom" ? [REMIND_TO_MIN[ev.remind]] : [])
        : [...REMINDER_PRESETS_MINUTES];
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
