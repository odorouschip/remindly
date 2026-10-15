import { AlignLeft, Bell, Calendar, Clock, Flag, Repeat, Tag, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, IconButton, Segmented } from "@/components/ui/controls";
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
  const [cat, setCat] = useState<CategoryId>("work");
  const [recur, setRecur] = useState<RecurLabel>("");
  const [remind, setRemind] = useState<RemindKey>("1-day");
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
    setCat(ev?.cat ?? "work");
    setRecur(ev?.recur ?? "");
    setRemind(ev?.remind ?? "1-day");
    setPriority(ev?.priority ?? "medium");
    setDesc(ev?.desc ?? "");
    // Wait for the slide-in to start so focus doesn't jump the layout.
    const id = window.setTimeout(() => titleRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) { titleRef.current?.focus(); return; }
    const id = editing?.id ?? "";
    if (kind === "event") {
      onSave({ id, title: t, date, time, end, cat, recur, isTask: false, desc });
    } else {
      onSave({ id, title: `${t} ✓`, date, time: "", end: "", cat: "personal", recur: "", isTask: true, desc, remind, priority });
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
                <Prop icon={<Clock size={14} />} label="Time">
                  <div className={styles.timeRange}>
                    <input type="time" className={styles.control} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Start time" />
                    <span className={styles.dash}>–</span>
                    <input type="time" className={styles.control} value={end} onChange={(e) => setEnd(e.target.value)} aria-label="End time" />
                  </div>
                </Prop>
                <Prop icon={<Tag size={14} />} label="Category">
                  <div className={styles.selectWrap} style={catStyle(cat)}>
                    <span className={styles.catDot} />
                    <select className={styles.control} value={cat} onChange={(e) => setCat(e.target.value as CategoryId)}>
                      {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </Prop>
                <Prop icon={<Repeat size={14} />} label="Repeat">
                  <select className={styles.control} value={recur} onChange={(e) => setRecur(e.target.value as RecurLabel)}>
                    {RECUR_OPTIONS.map((r) => <option key={r} value={r}>{r || "Does not repeat"}</option>)}
                  </select>
                </Prop>
              </>
            ) : (
              <>
                <Prop icon={<Bell size={14} />} label="Remind">
                  <select className={styles.control} value={remind} onChange={(e) => setRemind(e.target.value as RemindKey)}>
                    {REMIND_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
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

function Prop({ icon, label, top, children }: { icon: ReactNode; label: string; top?: boolean; children: ReactNode }) {
  return (
    <div className={styles.prop} data-top={top || undefined}>
      <span className={styles.propLabel}>{icon}{label}</span>
      <div className={styles.propValue}>{children}</div>
    </div>
  );
}
