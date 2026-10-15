import { AlignLeft, Bell, Calendar, CalendarX, Clock, Flag, Repeat, Sun, Tag, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, IconButton, Segmented, Switch } from "@/components/ui/controls";
import { addDays, fromMinutes, minutesOf, parseIsoDate, toIsoDate } from "@/lib/calendar/dates";
import {
  CATEGORIES, PRIORITIES, RECUR_OPTIONS, REMIND_OPTIONS,
  displayTitle, type CalEvent, type CategoryId, type Priority, type RecurLabel, type RemindKey,
} from "@/lib/calendar/types";
import { catStyle } from "./catStyle";
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
  defaultDate: string;
  onClose: () => void;
  onSave: (ev: CalEvent) => void;
  onDelete: (id: string) => void;
};

export function EventPanel({ open, editing, defaultDate, onClose, onSave, onDelete }: EventPanelProps) {
  const isEdit = Boolean(editing?.id);

  const [kind, setKind] = useState<Kind>("event");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [cat, setCat] = useState<CategoryId>("work");
  const [recur, setRecur] = useState<RecurLabel>("");
  const [recurUntil, setRecurUntil] = useState("");
  const [remind, setRemind] = useState<RemindKey>("1-day");
  const [custom, setCustom] = useState<{ amount: number; unit: Unit }>({ amount: 2, unit: "hours" });
  const [priority, setPriority] = useState<Priority>("medium");
  const [desc, setDesc] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const ev = editing;
    setKind(ev?.isTask ? "task" : "event");
    setTitle(ev ? displayTitle(ev) : "");
    setDate(ev?.date || defaultDate);
    setTime(ev?.time || "09:00");
    setEnd(ev?.end || "10:00");
    setAllDay(Boolean(ev?.allDay && !ev.isTask));
    setCat(ev?.cat ?? "work");
    setRecur(ev?.recur ?? "");
    setRecurUntil(ev?.recurUntil ?? "");
    setRemind(ev?.remind ?? "1-day");
    setCustom(ev?.remindMinutes ? splitMinutes(ev.remindMinutes) : { amount: 2, unit: "hours" });
    setPriority(ev?.priority ?? "medium");
    setDesc(ev?.desc ?? "");
    // Wait for the slide-in to start so focus doesn't jump the layout.
    const id = window.setTimeout(() => titleRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  // Moving the start keeps the event's length, like most calendars.
  const changeStart = (next: string) => {
    if (time && end && minutesOf(end) > minutesOf(time)) {
      setEnd(fromMinutes(minutesOf(next) + minutesOf(end) - minutesOf(time)));
    }
    setTime(next);
  };

  const changeRecur = (next: RecurLabel) => {
    setRecur(next);
    if (!next) setRecurUntil("");
  };

  const timeError = kind === "event" && !allDay && end <= time ? "End time must be after the start." : null;
  const untilError = kind === "event" && recur && recurUntil && recurUntil < date ? "Can't stop repeating before it starts." : null;
  const customMinutes = custom.amount * (UNITS.find((u) => u.value === custom.unit)?.minutes ?? 1);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) { titleRef.current?.focus(); return; }
    if (timeError || untilError) return;
    const id = editing?.id ?? "";
    if (kind === "event") {
      onSave({
        id, title: t, date, time: allDay ? "" : time, end: allDay ? "" : end, allDay,
        cat, recur, recurUntil: recur ? recurUntil : "", isTask: false, desc,
      });
    } else {
      onSave({
        id, title: `${t} ✓`, date, time: "", end: "", allDay: true, cat: "personal", recur: "", recurUntil: "",
        isTask: true, desc, remind, priority,
        ...(remind === "custom" ? { remindMinutes: customMinutes } : {}),
      });
    }
  };

  const noun = kind === "task" ? "task" : "event";

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
            <Prop icon={<Calendar size={14} />} label={kind === "task" ? "Due" : "Date"}>
              <input type="date" className={styles.control} value={date} onChange={(e) => setDate(e.target.value)} />
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
                <Prop icon={<Tag size={14} />} label="Category">
                  <div className={styles.selectWrap} style={catStyle(cat)}>
                    <span className={styles.catDot} />
                    <select className={styles.control} value={cat} onChange={(e) => setCat(e.target.value as CategoryId)}>
                      {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </Prop>
                <Prop icon={<Repeat size={14} />} label="Repeat">
                  <select className={styles.control} value={recur} onChange={(e) => changeRecur(e.target.value as RecurLabel)}>
                    {RECUR_OPTIONS.map((r) => <option key={r} value={r}>{r || "Does not repeat"}</option>)}
                  </select>
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
              </>
            )}

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
