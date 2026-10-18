import type { SupabaseClient } from "@supabase/supabase-js";
import { REMINDER_PRESETS_MINUTES } from "@calender/shared";
import type { CategoryRow, Database, EventRow, ExceptionRow, ReminderRow } from "@/lib/supabase/client";
import type { CalendarBackend } from "./backend";
import { isoToLocalParts, localDateTimeToIso } from "./dates";
import { REMIND_TO_MIN, type CalEvent, type Category, type OccurrenceOverride, type RecurLabel, type RemindKey } from "./types";

type EventWithReminders = EventRow & {
  reminders: Pick<ReminderRow, "offset_minutes">[];
  /** Embedded by listEvents; optional so rows built elsewhere (tests) needn't have it. */
  event_exceptions?: ExceptionRow[];
};

const FREQ_TO_LABEL: Record<NonNullable<EventRow["repeat_freq"]>, RecurLabel> = {
  daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly",
};
const LABEL_TO_FREQ: Record<RecurLabel, EventRow["repeat_freq"]> = {
  "": null, Daily: "daily", Weekly: "weekly", Monthly: "monthly", Yearly: "yearly",
};

// Task reminders are stored relative to the due date's start (midnight), and
// the UI counts back from 9:00 AM that day.
const NINE_AM = 9 * 60;

function taskRemind(offsets: number[]): Pick<CalEvent, "remind" | "remindMinutes"> {
  const first = offsets[0];
  if (first === undefined) return { remind: "none" };
  const beforeNine = first + NINE_AM;
  const preset = (Object.entries(REMIND_TO_MIN) as [RemindKey, number][]).find(([, m]) => m === beforeNine);
  return preset ? { remind: preset[0] } : { remind: "custom", remindMinutes: beforeNine };
}

export function rowToEvent(row: EventWithReminders): CalEvent {
  const isTask = row.kind === "task";
  const base = {
    id: row.id,
    title: row.title,
    categoryId: row.category_id,
    recur: row.repeat_freq ? FREQ_TO_LABEL[row.repeat_freq] : "",
    recurInterval: row.repeat_interval,
    recurUntil: row.repeat_until ?? "",
    isTask,
    done: row.completed_at !== null,
    desc: row.notes,
    location: row.location,
    ...(isTask ? { priority: row.priority ?? "medium", ...taskRemind(row.reminders.map((r) => r.offset_minutes)) } : {}),
  } satisfies Partial<CalEvent>;

  const exceptions = row.repeat_freq && row.event_exceptions?.length
    ? Object.fromEntries(row.event_exceptions.map((x) => [x.occurrence_date, rowToOverride(x, row)]))
    : undefined;
  if (row.all_day) {
    return { ...base, exceptions, allDay: true, date: row.start_date!, endDate: row.end_date!, time: "", end: "" };
  }
  const start = isoToLocalParts(row.starts_at!);
  const end = isoToLocalParts(row.ends_at!);
  return { ...base, exceptions, allDay: false, date: start.date, endDate: end.date, time: start.time, end: end.time };
}

/** An event_exceptions row in the UI's terms. Like occurrence_bounds() in SQL, a moved occurrence without an end keeps the series' length. */
function rowToOverride(x: ExceptionRow, series: EventRow): OccurrenceOverride {
  const out: OccurrenceOverride = { cancelled: x.cancelled };
  if (x.title !== null) out.title = x.title;
  if (x.notes !== null) out.desc = x.notes;
  if (x.location !== null) out.location = x.location;
  if (x.category_id !== null) out.categoryId = x.category_id;
  if (series.all_day && x.start_date) {
    Object.assign(out, { date: x.start_date, endDate: x.end_date ?? x.start_date, time: "", end: "" });
  } else if (!series.all_day && x.starts_at) {
    const length = Date.parse(series.ends_at!) - Date.parse(series.starts_at!);
    const start = isoToLocalParts(x.starts_at);
    const end = isoToLocalParts(x.ends_at ?? new Date(Date.parse(x.starts_at) + length).toISOString());
    Object.assign(out, { date: start.date, endDate: end.date, time: start.time, end: end.time });
  }
  return out;
}

/** Every column of an override row; null keeps the series value. (Location and category
 *  need 202610180001_exception_location_category.sql.) */
function overrideToRow(seriesId: string, occurrenceDate: string, x: OccurrenceOverride): Database["public"]["Tables"]["event_exceptions"]["Insert"] {
  const timed = Boolean(x.date && x.time);
  return {
    event_id: seriesId,
    occurrence_date: occurrenceDate,
    cancelled: x.cancelled,
    title: x.title ?? null,
    notes: x.desc ?? null,
    location: x.location ?? null,
    category_id: x.categoryId ?? null,
    starts_at: timed ? localDateTimeToIso(x.date!, x.time!) : null,
    ends_at: timed ? localDateTimeToIso(x.endDate || x.date!, x.end || x.time!) : null,
    start_date: x.date && !timed ? x.date : null,
    end_date: x.date && !timed ? x.endDate || x.date : null,
  };
}

/** Minutes before the occurrence starts, as the reminders table stores them. */
function reminderOffsets(ev: CalEvent): number[] {
  if (ev.isTask) {
    // Done tasks keep their rows (the database skips them), so un-checking restores the reminder.
    if (!ev.remind || ev.remind === "none") return [];
    const beforeNine = ev.remind === "custom" ? ev.remindMinutes : REMIND_TO_MIN[ev.remind];
    return beforeNine === undefined ? [] : [beforeNine - NINE_AM];
  }
  // A countdown to midnight isn't useful, so all-day events get none.
  return ev.allDay ? [] : [...REMINDER_PRESETS_MINUTES];
}

function eventToRow(ev: CalEvent): Database["public"]["Tables"]["events"]["Insert"] {
  const allDay = ev.isTask || ev.allDay;
  return {
    kind: ev.isTask ? "task" : "event",
    title: ev.title.trim() || (ev.isTask ? "Untitled task" : "Untitled event"),
    notes: ev.desc,
    location: ev.location,
    category_id: ev.categoryId,
    all_day: allDay,
    starts_at: allDay ? null : localDateTimeToIso(ev.date, ev.time || "09:00"),
    ends_at: allDay ? null : localDateTimeToIso(ev.endDate || ev.date, ev.end || "10:00"),
    start_date: allDay ? ev.date : null,
    end_date: allDay ? (ev.endDate && ev.endDate >= ev.date ? ev.endDate : ev.date) : null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    repeat_freq: LABEL_TO_FREQ[ev.recur],
    repeat_interval: ev.recur ? ev.recurInterval : 1,
    repeat_until: ev.recur && ev.recurUntil ? ev.recurUntil : null,
    priority: ev.isTask ? ev.priority ?? "medium" : null,
    completed_at: ev.isTask && ev.done ? new Date().toISOString() : null,
  };
}

function rowToCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, color: row.color, sortOrder: row.sort_order };
}

export function createSupabaseBackend(supabase: SupabaseClient<Database>): CalendarBackend {
  return {
    kind: "supabase",

    async listEvents() {
      const { data, error } = await supabase
        .from("events")
        .select("*, reminders(offset_minutes), event_exceptions(*)")
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      return ((data ?? []) as EventWithReminders[]).map(rowToEvent);
    },

    async saveEvent(ev) {
      const row = eventToRow(ev);
      const { data: saved, error } = ev.id
        ? await supabase.from("events").update(row).eq("id", ev.id).select("id").single()
        : await supabase.from("events").insert(row).select("id").single();
      if (error || !saved) throw new Error(error?.message ?? "Could not save.");

      // Reminders are replaced wholesale; the database works out when each is due.
      const { error: deleteError } = await supabase.from("reminders").delete().eq("event_id", saved.id);
      if (deleteError) throw new Error(deleteError.message);
      const offsets = reminderOffsets(ev);
      if (offsets.length > 0) {
        const { error: insertError } = await supabase.from("reminders")
          .insert(offsets.map((offset_minutes) => ({ event_id: saved.id, offset_minutes })));
        if (insertError) throw new Error(insertError.message);
      }
    },

    async deleteEvent(id) {
      const { error } = await supabase.from("events").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    },

    async saveOccurrence(seriesId, occurrenceDate, override) {
      const { error } = override
        ? await supabase.from("event_exceptions")
          .upsert(overrideToRow(seriesId, occurrenceDate, override), { onConflict: "event_id,occurrence_date" })
        : await supabase.from("event_exceptions").delete().eq("event_id", seriesId).eq("occurrence_date", occurrenceDate);
      if (error) throw new Error(error.message);
    },

    async importEvents(source, items) {
      // One copy per external id, even if the file repeats one.
      const unique = [...new Map(items.map((item) => [item.externalId, item])).values()];
      let added = 0;
      for (let i = 0; i < unique.length; i += 200) {
        const batch = unique.slice(i, i + 200);
        const rows = batch.map(({ event, externalId }) => ({ ...eventToRow(event), source, external_id: externalId }));
        // Already imported (same user, source and external id) → left alone.
        const { data, error } = await supabase.from("events")
          .upsert(rows, { onConflict: "user_id,source,external_id", ignoreDuplicates: true })
          .select("id, external_id");
        if (error) throw new Error(error.message);
        const inserted = data ?? [];
        added += inserted.length;
        const byExternalId = new Map(batch.map((item) => [item.externalId, item.event]));
        const reminders = inserted.flatMap((row) => {
          const event = byExternalId.get(row.external_id ?? "");
          return event ? reminderOffsets(event).map((offset_minutes) => ({ event_id: row.id, offset_minutes })) : [];
        });
        if (reminders.length > 0) {
          const { error: reminderError } = await supabase.from("reminders").insert(reminders);
          if (reminderError) throw new Error(reminderError.message);
        }
      }
      return { added, skipped: items.length - added };
    },

    async listCategories() {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order").order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []).map(rowToCategory);
    },

    async saveCategory(cat) {
      const row = { name: cat.name.trim(), color: cat.color, sort_order: cat.sortOrder };
      const { data, error } = cat.id
        ? await supabase.from("categories").update(row).eq("id", cat.id).select("*").single()
        : await supabase.from("categories").insert(row).select("*").single();
      if (error || !data) throw new Error(error?.message ?? "Could not save the category.");
      return rowToCategory(data);
    },

    async deleteCategory(id) {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
