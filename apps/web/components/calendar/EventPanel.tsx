import { AlignLeft, Bell, Calendar, CalendarX, Clock, Flag, MapPin, Repeat, Sun, Tag, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, IconButton, Segmented, Switch } from "@/components/ui/controls";
import { addDays, fromMinutes, minutesOf, parseIsoDate, toIsoDate } from "@/lib/calendar/dates";
import {
  PRIORITIES, RECUR_OPTIONS, RECUR_UNIT, REMIND_OPTIONS,
  type CalEvent, type Priority, type RecurLabel, type RemindKey,
} from "@/lib/calendar/types";
import { catStyle, useCategories } from "./categories";
import styles from "./EventPanel.module.css";

type Kind = "event" | "task";

const KIND_OPTIONS = [
  { value: "event", label: "Event" },
  { value: "task", label: "Task" },
] as const;

const UNITS = [
  { value: "minutes", label: "minutes", minutes: 1 },
  { value: "hours",   label: "hours",   minutes: 60 },
  { value: "days",    label: "days",    minutes: 1440 },
  { value: "weeks",   label: "weeks",   minutes: 10080 },
] as const;
type Unit = (typeof UNITS)[number]["value"];

/** 2880 → { amount: 2, unit: "days" } — the largest unit that divides evenly. */
function splitMinutes(total: number): { amount: number; unit: Unit } {
  const unit = [...UNITS].reverse().find((u) => total > 0 && total % u.minutes === 0) ?? UNITS[0];
  return { amount: total / unit.minutes, unit: unit.value };
}

/** Where "Ends" starts when first turned on: a sensible span for each frequency. */
const DEFAULT_REPEAT_DAYS: Record<Exclude<RecurLabel, "">, number> = {
  Daily: 30, Weekly: 84, Monthly: 365, Yearly: 365 * 5,
};

type EventPanelProps = {
  open: boolean;
  /** The event being edited, or null when creating. */
  editing: CalEvent | null;
  /** Changes on every open, so the form resets even when it's already showing. */
  session: number;
  defaultDate: string;
  /** Start time for a new event, e.g. from clicking a week-view slot. */
  defaultTime?: string | undefined;
  onClose: () => void;
  onSave: (ev: CalEvent) => void;
  onDelete: (id: string) => void;
};

export function EventPanel({ open, editing, session, defaultDate, defaultTime, onClose, onSave, onDelete }: EventPanelProps) {
  const isEdit = Boolean(editing?.id);

  const [kind, setKind] = useState<Kind>("event");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  // All-day events can span days; timed ones keep whatever span they had.
  const [endDate, setEndDate] = useState(defaultDate);
  const [categoryId, setCategoryId] = useState("");
  const [recur, setRecur] = useState<RecurLabel>("");
  const [recurInterval, setRecurInterval] = useState(1);
  const [recurUntil, setRecurUntil] = useState("");
  const [remind, setRemind] = useState<RemindKey>("1-day");
  const [custom, setCustom] = useState<{ amount: number; unit: Unit }>({ amount: 2, unit: "hours" });
  const [priority, setPriority] = useState<Priority>("medium");
  const [desc, setDesc] = useState("");
  const [location, setLocation] = useState("");
  const categories = useCategories();
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const ev = editing;
    setKind(ev?.isTask ? "task" : "event");
    setTitle(ev ? ev.title : "");
    setDate(ev?.date || defaultDate);
    const start = ev?.time || defaultTime || "09:00";
    setTime(start);
    setEnd(ev?.end || fromMinutes(minutesOf(start) + 60));
    setAllDay(Boolean(ev?.allDay && !ev.isTask));
    setEndDate(ev?.endDate || ev?.date || defaultDate);
    setCategoryId(ev?.categoryId ?? "");
    setRecur(ev?.recur ?? "");
    setRecurInterval(ev?.recurInterval ?? 1);
    setRecurUntil(ev?.recurUntil ?? "");
    setRemind(ev?.remind ?? "1-day");
    setCustom(ev?.remindMinutes ? splitMinutes(ev.remindMinutes) : { amount: 2, unit: "hours" });
    setPriority(ev?.priority ?? "medium");
    setDesc(ev?.desc ?? "");
    setLocation(ev?.location ?? "");
    // Wait for the slide-in to start so focus doesn't jump the layout.
    const id = window.setTimeout(() => titleRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id, session]);

  // Moving the start keeps the event's length, like most calendars.
  const changeStart = (next: string) => {
    if (time && end && minutesOf(end) > minutesOf(time)) {
      setEnd(fromMinutes(minutesOf(next) + minutesOf(end) - minutesOf(time)));
    }
    setTime(next);
  };

  // Moving the start date carries the end date along.
  const changeDate = (next: string) => {
    if (next) {
      const span = Math.round((parseIsoDate(endDate).getTime() - parseIsoDate(date).getTime()) / 86_400_000);
      setEndDate(toIsoDate(addDays(parseIsoDate(next), Math.max(0, span))));
    }
    setDate(next);
  };

  const changeRecur = (next: RecurLabel) => {
    setRecur(next);
    if (!next) setRecurUntil("");
  };

  const timeError = kind === "event" && !allDay && endDate <= date && end <= time ? "End time must be after the start." : null;
  const endDateError = kind === "event" && endDate < date ? "The end can't be before the start." : null;
  const untilError = recur && recurUntil && recurUntil < date ? "Can't stop repeating before it starts." : null;
  const customMinutes = custom.amount * (UNITS.find((u) => u.value === custom.unit)?.minutes ?? 1);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) { titleRef.current?.focus(); return; }
    if (timeError || untilError || endDateError) return;
    const shared = { id: editing?.id ?? "", title: t, date, categoryId: categoryId || null, desc, location };
    if (kind === "event") {
      onSave({
        ...shared, endDate, time: allDay ? "" : time, end: allDay ? "" : end, allDay,
        recur, recurInterval: recur ? recurInterval : 1, recurUntil: recur ? recurUntil : "", isTask: false, done: false,
      });
    } else {
      onSave({
        ...shared, endDate: date, time: "", end: "", allDay: true,
        recur, recurInterval: recur ? recurInterval : 1, recurUntil: recur ? recurUntil : "",
        isTask: true, done: editing?.isTask ? editing.done : false, remind, priority,
        ...(remind === "custom" ? { remindMinutes: customMinutes } : {}),
      });
    }
  };

  const noun = kind === "task" ? "task" : "event";

  // Events and tasks both repeat. A repeating task shows once, at its next due date.
  const repeatProps = (
    <>
      <Prop icon={<Repeat size={14} />} label="Repeat" top={Boolean(recur)}>
        <select className={styles.control} value={recur} onChange={(e) => changeRecur(e.target.value as RecurLabel)}>
          {RECUR_OPTIONS.map((r) => <option key={r} value={r}>{r || "Does not repeat"}</option>)}
        </select>
        {recur && (
          <div className={styles.inline}>
            <span className={styles.every}>Every</span>
            <input type="number" className={`${styles.control} ${styles.amount}`} min={1} max={99}
              value={recurInterval} aria-label="Repeat interval"
              onChange={(e) => setRecurInterval(Math.min(99, Math.max(1, Math.round(Number(e.target.value)) || 1)))} />
            <span className={styles.every}>{RECUR_UNIT[recur]}{recurInterval === 1 ? "" : "s"}</span>
          </div>
        )}
      </Prop>
      {recur && (
        <Prop icon={<CalendarX size={14} />} label="Ends" error={untilError}>
          {recurUntil ? (
            <div className={styles.inline}>
              <input type="date" className={styles.control} value={recurUntil} min={date}
                onChange={(e) => setRecurUntil(e.target.value)} aria-label="Last day it repeats" />
              <IconButton label="Repeat forever" size={26} onClick={() => setRecurUntil("")}>
                <X size={14} strokeWidth={1.75} />
              </IconButton>
            </div>
          ) : (
            <button type="button" className={`${styles.control} ${styles.muted}`}
              onClick={() => setRecurUntil(toIsoDate(addDays(parseIsoDate(date), DEFAULT_REPEAT_DAYS[recur])))}>
              Never
            </button>
          )}
        </Prop>
      )}
    </>
  );

  return (
    <div className={styles.panel} data-open={open || undefined} inert={!open}>
      <form className={styles.inner} onSubmit={handleSubmit}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <div className={styles.header}>
          <Segmented ariaLabel="Type" options={KIND_OPTIONS} value={kind} onChange={setKind} />
          <IconButton label="Close" onClick={onClose}><X size={16} strokeWidth={1.75} /></IconButton>
        </div>

        <div className={styles.body}>
          <input ref={titleRef} className={styles.titleInput} value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === "task" ? "Task name" : "Event name"} />

          <div className={styles.props}>
            <Prop icon={<Calendar size={14} />} label={kind === "task" ? "Due" : "Date"} error={endDateError}>
              {kind === "event" ? (
                <div className={styles.timeRange}>
                  <input type="date" className={styles.control} value={date} onChange={(e) => changeDate(e.target.value)} aria-label={allDay ? "First day" : "Start date"} />
                  <span className={styles.dash}>–</span>
                  <input type="date" className={styles.control} value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} aria-label={allDay ? "Last day" : "End date"} />
                </div>
              ) : (
                <input type="date" className={styles.control} value={date} onChange={(e) => changeDate(e.target.value)} />
              )}
            </Prop>

            {kind === "event" ? (
              <>
                <Prop icon={<Sun size={14} />} label="All day">
                  <div className={styles.switchRow}>
                    <Switch label="All day" checked={allDay} onChange={setAllDay} />
                  </div>
                </Prop>
                {!allDay && (
                  <Prop icon={<Clock size={14} />} label="Time" error={timeError}>
                    <div className={styles.timeRange}>
                      <input type="time" className={styles.control} value={time} onChange={(e) => changeStart(e.target.value)} aria-label="Start time" />
                      <span className={styles.dash}>–</span>
                      <input type="time" className={styles.control} value={end} onChange={(e) => setEnd(e.target.value)} aria-label="End time"
                        aria-invalid={Boolean(timeError)} />
                    </div>
                  </Prop>
                )}
                <Prop icon={<MapPin size={14} />} label="Location">
                  <input className={styles.control} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add a place" />
                </Prop>
                {repeatProps}
              </>
            ) : (
              <>
                <Prop icon={<Bell size={14} />} label="Remind" top={remind === "custom"}>
                  <select className={styles.control} value={remind} onChange={(e) => setRemind(e.target.value as RemindKey)}>
                    {REMIND_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  {remind === "custom" && (
                    <div className={styles.inline}>
                      <input type="number" className={`${styles.control} ${styles.amount}`} min={1} max={999}
                        value={custom.amount} aria-label="Remind amount"
                        onChange={(e) => setCustom((c) => ({ ...c, amount: Math.max(1, Math.round(Number(e.target.value)) || 1) }))} />
                      <select className={styles.control} value={custom.unit} aria-label="Remind unit"
                        onChange={(e) => setCustom((c) => ({ ...c, unit: e.target.value as Unit }))}>
                        {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label} before</option>)}
                      </select>
                    </div>
                  )}
                </Prop>
                <Prop icon={<Flag size={14} />} label="Priority">
                  <Segmented ariaLabel="Priority" options={PRIORITIES} value={priority} onChange={setPriority} fullWidth />
                </Prop>
                {repeatProps}
              </>
            )}

            <Prop icon={<Tag size={14} />} label="Category">
              <div className={styles.selectWrap} style={catStyle(categories.find((c) => c.id === categoryId)?.color)}>
                <span className={styles.catDot} />
                <select className={styles.control} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">No category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </Prop>

            <Prop icon={<AlignLeft size={14} />} label="Notes" top>
              <textarea className={`${styles.control} ${styles.notes}`} value={desc}
                onChange={(e) => setDesc(e.target.value)} placeholder="Add a note" rows={4} />
            </Prop>
          </div>
        </div>

        <div className={styles.footer}>
          {isEdit && editing && (
            <Button variant="danger" size="sm" onClick={() => onDelete(editing.id)}>
              <Trash2 size={14} strokeWidth={1.75} /> Delete
            </Button>
          )}
          <div className={styles.spacer} />
          <Button size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" type="submit">
            {isEdit ? "Save" : `Create ${noun}`}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Prop({ icon, label, top, error, children }: {
  icon: ReactNode; label: string; top?: boolean; error?: string | null; children: ReactNode;
}) {
  return (
    <div className={styles.prop} data-top={top || error ? true : undefined}>
      <span className={styles.propLabel}>{icon}{label}</span>
      <div className={styles.propValue}>
        {children}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </div>
  );
}
