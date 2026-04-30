"use client";

import {
  Bell,
  CalendarDays,
  Check,
  Clock3,
  LogOut,
  Plus,
  RefreshCcw,
  Save,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  REMINDER_PRESETS_MINUTES,
  reminderDueAt,
  type RepeatFrequency,
} from "@calender/shared";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  type EventRow,
  type ReminderRow,
} from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";

type EventForm = {
  title: string;
  notes: string;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  repeatFrequency: RepeatFrequency;
  repeatUntil: string;
  reminderOffsets: number[];
};

type EventWithReminders = EventRow & {
  reminders: ReminderRow[];
};

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const initialStart = roundToNextHalfHour(new Date());
const initialEnd = new Date(initialStart.getTime() + 60 * 60_000);

const emptyForm: EventForm = {
  title: "",
  notes: "",
  startsAt: toDateTimeLocal(initialStart),
  endsAt: toDateTimeLocal(initialEnd),
  isAllDay: false,
  repeatFrequency: "none",
  repeatUntil: "",
  reminderOffsets: [...REMINDER_PRESETS_MINUTES],
};

export function CalendarApp() {
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventWithReminders[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [status, setStatus] = useState("Ready to build your day.");
  const [isPending, startTransition] = useTransition();

  const supabase = useMemo(() => (isSupabaseConfigured ? getSupabaseBrowserClient() : null), []);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const upcomingEvents = events.filter((event) => !event.deleted_at && !event.is_archived);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      const currentUserId = data.session?.user.id ?? null;
      setUserId(currentUserId);
      if (currentUserId) void loadEvents(currentUserId);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUserId = session?.user.id ?? null;
      setUserId(currentUserId);
      if (currentUserId) void loadEvents(currentUserId);
      if (!currentUserId) setEvents([]);
    });

    return () => subscription.subscription.unsubscribe();
  }, [supabase]);

  async function loadEvents(currentUserId = userId) {
    if (!supabase || !currentUserId) return;

    const { data, error } = await supabase
      .from("events")
      .select("*, reminders(*)")
      .eq("user_id", currentUserId)
      .is("deleted_at", null)
      .order("starts_at", { ascending: true });

    if (error) {
      setStatus(error.message);
      return;
    }

    setEvents((data ?? []) as EventWithReminders[]);
    setStatus("Calendar synced.");
  }

  async function handleAuth() {
    if (!supabase) return;
    const authCall =
      authMode === "sign-in"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { data, error } = await authCall;
    if (error) {
      setStatus(error.message);
      return;
    }

    setUserId(data.user?.id ?? null);
    setStatus(authMode === "sign-up" ? "Account created. Check email confirmation if Supabase requires it." : "Signed in.");
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUserId(null);
    setEvents([]);
    setSelectedEventId(null);
    setForm(emptyForm);
  }

  async function handleSaveEvent() {
    if (!supabase || !userId) return;

    const startsAt = fromDateTimeLocal(form.startsAt).toISOString();
    const endsAt = fromDateTimeLocal(form.endsAt).toISOString();

    if (!form.title.trim()) {
      setStatus("Give the event a title first.");
      return;
    }

    if (new Date(endsAt) <= new Date(startsAt)) {
      setStatus("End time needs to be after start time.");
      return;
    }

    startTransition(async () => {
      const eventPayload = {
        user_id: userId,
        title: form.title.trim(),
        notes: form.notes.trim() || null,
        starts_at: startsAt,
        ends_at: endsAt,
        timezone,
        is_all_day: form.isAllDay,
        repeat_frequency: form.repeatFrequency,
        repeat_until: form.repeatUntil ? fromDateTimeLocal(form.repeatUntil).toISOString() : null,
        is_archived: false,
        deleted_at: null,
      };

      const { data: savedEvent, error: eventError } = selectedEvent
        ? await supabase.from("events").update(eventPayload).eq("id", selectedEvent.id).select("*").single()
        : await supabase.from("events").insert(eventPayload).select("*").single();

      if (eventError || !savedEvent) {
        setStatus(eventError?.message ?? "Could not save event.");
        return;
      }

      await supabase.from("reminders").delete().eq("event_id", savedEvent.id);

      if (form.reminderOffsets.length > 0) {
        const reminderRows = form.reminderOffsets.map((offset) => ({
          event_id: savedEvent.id,
          user_id: userId,
          offset_minutes: offset,
          channel: "live_activity" as const,
          due_at: reminderDueAt(startsAt, offset),
          delivered_at: null,
        }));

        const { error: reminderError } = await supabase.from("reminders").insert(reminderRows);
        if (reminderError) {
          setStatus(reminderError.message);
          return;
        }
      }

      setSelectedEventId(null);
      setForm(emptyForm);
      await loadEvents(userId);
    });
  }

  async function handleDeleteEvent(eventId: string) {
    if (!supabase || !userId) return;
    const { error } = await supabase.from("events").update({ deleted_at: new Date().toISOString() }).eq("id", eventId);
    if (error) {
      setStatus(error.message);
      return;
    }

    if (selectedEventId === eventId) {
      setSelectedEventId(null);
      setForm(emptyForm);
    }
    await loadEvents(userId);
  }

  function editEvent(event: EventWithReminders) {
    setSelectedEventId(event.id);
    setForm({
      title: event.title,
      notes: event.notes ?? "",
      startsAt: toDateTimeLocal(new Date(event.starts_at)),
      endsAt: toDateTimeLocal(new Date(event.ends_at)),
      isAllDay: event.is_all_day,
      repeatFrequency: event.repeat_frequency,
      repeatUntil: event.repeat_until ? toDateTimeLocal(new Date(event.repeat_until)) : "",
      reminderOffsets: event.reminders.map((reminder) => reminder.offset_minutes).sort((a, b) => b - a),
    });
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="shell setup-shell">
        <section className="setup-panel">
          <CalendarDays aria-hidden />
          <h1>Connect Supabase to start Calender</h1>
          <p>Add the values from your Supabase project to <code>apps/web/.env.local</code>, then restart the web app.</p>
          <pre>{`NEXT_PUBLIC_SUPABASE_URL=...\nNEXT_PUBLIC_SUPABASE_ANON_KEY=...`}</pre>
        </section>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="auth-screen">
        <section className="auth-copy">
          <div className="brand-lockup">
            <CalendarDays aria-hidden />
            <span>Calender</span>
          </div>
          <h1>Calendar reminders that stay visible when they matter.</h1>
          <p>Sync events across web and iPhone, then let Live Activities handle the hard-to-miss countdown.</p>
        </section>
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAuth();
          }}
        >
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={authMode === "sign-in" ? "current-password" : "new-password"}
              required
            />
          </label>
          <button type="submit">
            <Check aria-hidden />
            {authMode === "sign-in" ? "Sign in" : "Create account"}
          </button>
          <button type="button" className="text-button" onClick={() => setAuthMode(authMode === "sign-in" ? "sign-up" : "sign-in")}>
            {authMode === "sign-in" ? "Need an account?" : "Already have one?"}
          </button>
          <p className="status-line">{status}</p>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <CalendarDays aria-hidden />
          <span>Calender</span>
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-button" title="Refresh events" onClick={() => void loadEvents()}>
            <RefreshCcw aria-hidden />
          </button>
          <button type="button" className="icon-button" title="Sign out" onClick={handleSignOut}>
            <LogOut aria-hidden />
          </button>
        </div>
      </header>

      <section className="hero-strip">
        <div>
          <p className="eyebrow">Next countdown</p>
          <h1>{upcomingEvents[0]?.title ?? "No events yet"}</h1>
        </div>
        <div className="next-time">
          <Clock3 aria-hidden />
          <span>{upcomingEvents[0] ? formatDateTime(upcomingEvents[0].starts_at) : "Create your first reminder"}</span>
        </div>
      </section>

      <section className="workspace">
        <aside className="event-list" aria-label="Upcoming events">
          <div className="section-heading">
            <h2>Events</h2>
            <button
              type="button"
              className="mini-command"
              onClick={() => {
                setSelectedEventId(null);
                setForm(emptyForm);
              }}
            >
              <Plus aria-hidden />
              New
            </button>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="empty-state">Nothing on deck. Add one event and we have a heartbeat.</p>
          ) : (
            <div className="event-stack">
              {upcomingEvents.map((event) => (
                <article className="event-card" key={event.id}>
                  <button type="button" className="event-main" onClick={() => editEvent(event)}>
                    <span className="event-date">{formatDateTime(event.starts_at)}</span>
                    <strong>{event.title}</strong>
                    <span>{event.reminders.length} reminder{event.reminders.length === 1 ? "" : "s"}</span>
                  </button>
                  <button type="button" className="icon-button quiet" title="Delete event" onClick={() => void handleDeleteEvent(event.id)}>
                    <Trash2 aria-hidden />
                  </button>
                </article>
              ))}
            </div>
          )}
        </aside>

        <form
          className="editor"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSaveEvent();
          }}
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">{selectedEvent ? "Editing" : "New event"}</p>
              <h2>{selectedEvent ? selectedEvent.title : "Build a countdown"}</h2>
            </div>
            <button type="submit" disabled={isPending}>
              <Save aria-hidden />
              {isPending ? "Saving" : "Save"}
            </button>
          </div>

          <div className="form-grid">
            <label className="wide">
              Title
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </label>
            <label className="wide">
              Notes
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} />
            </label>
            <label>
              Starts
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
                required
              />
            </label>
            <label>
              Ends
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
                required
              />
            </label>
            <label>
              Repeats
              <select
                value={form.repeatFrequency}
                onChange={(event) => setForm({ ...form, repeatFrequency: event.target.value as RepeatFrequency })}
              >
                <option value="none">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label>
              Repeat until
              <input
                type="datetime-local"
                value={form.repeatUntil}
                onChange={(event) => setForm({ ...form, repeatUntil: event.target.value })}
                disabled={form.repeatFrequency === "none"}
              />
            </label>
          </div>

          <fieldset className="reminder-fieldset">
            <legend>
              <Bell aria-hidden />
              Reminder offsets
            </legend>
            <div className="reminder-options">
              {REMINDER_PRESETS_MINUTES.map((offset) => {
                const checked = form.reminderOffsets.includes(offset);
                return (
                  <label className={checked ? "reminder-chip selected" : "reminder-chip"} key={offset}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const nextOffsets = event.target.checked
                          ? [...form.reminderOffsets, offset]
                          : form.reminderOffsets.filter((item) => item !== offset);
                        setForm({ ...form, reminderOffsets: nextOffsets.sort((a, b) => b - a) });
                      }}
                    />
                    <Smartphone aria-hidden />
                    {offset === 0 ? "At start" : `${offset} min before`}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <p className="status-line">{status}</p>
        </form>
      </section>
    </main>
  );
}

function roundToNextHalfHour(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  rounded.setMinutes(minutes <= 30 ? 30 : 60);
  return rounded;
}

function toDateTimeLocal(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string): Date {
  return new Date(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
