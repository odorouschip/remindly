import { CalendarDays, CalendarPlus, CircleCheck, PencilLine, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addDays, fmtTimeRange, parseIsoDate, relativeDayLabel, toIsoDate, todayIso } from "@/lib/calendar/dates";
import { parseQuickAdd, quickAddToEvent, type QuickAdd } from "@/lib/calendar/quickAdd";
import { occurrencesBetween } from "@/lib/calendar/recurrence";
import { displayTitle, getCategory, type CalEvent } from "@/lib/calendar/types";
import { catStyle } from "./catStyle";
import styles from "./CommandBar.module.css";

export type CommandAction = {
  id: string;
  label: string;
  icon: ReactNode;
  /** Extra words the filter should match, e.g. "appearance" for theme actions. */
  keywords?: string;
  run: () => void;
};

type Item = {
  id: string;
  group: string;
  icon: ReactNode;
  label: ReactNode;
  detail?: string | undefined;
  run: () => void;
};

type CommandBarProps = {
  open: boolean;
  onClose: () => void;
  events: CalEvent[];
  actions: CommandAction[];
  /** Save a parsed draft right away. */
  onCreate: (draft: CalEvent) => void;
  /** Open a parsed draft in the editor instead. */
  onEditDraft: (draft: CalEvent) => void;
  onGoToDate: (date: string) => void;
  onOpenEvent: (ev: CalEvent) => void;
};

const MAX_EVENTS = 6;

function summarize(q: QuickAdd): string {
  const parts = [q.isTask ? `Task · ${relativeDayLabel(q.date)}` : relativeDayLabel(q.date)];
  if (!q.isTask) parts.push(q.allDay ? "All day" : fmtTimeRange(q.time, q.end));
  if (q.recur) parts.push(`Repeats ${q.recur.toLowerCase()}`);
  if (q.cat) parts.push(getCategory(q.cat).label);
  return parts.join(" · ");
}

/** Matches for `text`, soonest upcoming first, then most recent past. */
function matchingEvents(events: CalEvent[], text: string): CalEvent[] {
  const today = todayIso();
  const yearOut = toIsoDate(addDays(parseIsoDate(today), 366));
  const needle = text.toLowerCase();
  return events
    .filter((e) => displayTitle(e).toLowerCase().includes(needle))
    // A repeating event is shown at its next occurrence.
    .map((e) => (e.recur ? occurrencesBetween([e], today, yearOut)[0] ?? e : e))
    .sort((a, b) => {
      const aPast = a.date < today, bPast = b.date < today;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return aPast ? b.date.localeCompare(a.date) : (a.date + a.time).localeCompare(b.date + b.time);
    })
    .slice(0, MAX_EVENTS);
}

export function CommandBar({ open, onClose, events, actions, onCreate, onEditDraft, onGoToDate, onOpenEvent }: CommandBarProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const text = query.trim();
    const actionItems = (filter: string) => actions
      .filter((a) => `${a.label} ${a.keywords ?? ""}`.toLowerCase().includes(filter.toLowerCase()))
      .map((a) => ({ id: a.id, group: "Actions", icon: a.icon, label: a.label, run: a.run }));
    if (!text) return actionItems("");

    const create: Item[] = [];
    const parsed = parseQuickAdd(text);
    if (parsed.title) {
      const draft = quickAddToEvent(parsed);
      create.push({
        id: "create", group: "Create",
        icon: parsed.isTask ? <CircleCheck size={16} strokeWidth={1.75} /> : <CalendarPlus size={16} strokeWidth={1.75} />,
        label: <>{parsed.isTask ? "New task" : "New event"} <strong>{parsed.title}</strong></>,
        detail: summarize(parsed),
        run: () => onCreate(draft),
      });
      create.push({
        id: "create-edit", group: "Create", icon: <PencilLine size={16} strokeWidth={1.75} />,
        label: "Add details first…", detail: "Opens it in the editor", run: () => onEditDraft(draft),
      });
    } else if (parsed.dateMentioned) {
      const label = parseIsoDate(parsed.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      create.push({
        id: "goto", group: "Go to", icon: <CalendarDays size={16} strokeWidth={1.75} />,
        label: `Go to ${label}`, run: () => onGoToDate(parsed.date),
      });
    }

    const found: Item[] = [];
    for (const ev of matchingEvents(events, text)) {
      found.push({
        id: `event-${ev.id}`, group: "Events",
        icon: <span className={styles.dot} style={catStyle(ev.cat)} />,
        label: displayTitle(ev),
        detail: `${relativeDayLabel(ev.date)}${ev.allDay ? "" : ` · ${fmtTimeRange(ev.time, ev.end)}`}`,
        run: () => onOpenEvent(ev),
      });
    }
    // A bare title ("standup") is more likely a lookup than a new event.
    const isJustTitle = !parsed.dateMentioned && parsed.allDay && !parsed.recur && !parsed.isTask && !parsed.cat;
    const ordered = isJustTitle && found.length > 0 ? [...found, ...create] : [...create, ...found];
    return [...ordered, ...actionItems(text)];
  }, [query, events, actions, onCreate, onEditDraft, onGoToDate, onOpenEvent]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const run = (i: number) => {
    const item = items[i];
    if (!item) return;
    onClose();
    item.run();
  };

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.dialog} role="dialog" aria-label="Command menu">
        <div className={styles.inputRow}>
          <Search size={16} strokeWidth={1.75} className={styles.searchIcon} />
          <input ref={inputRef} className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Add an event, jump to a date, or search…"
            role="combobox" aria-expanded aria-controls="command-list"
            aria-activedescendant={items[active] ? `command-${items[active]!.id}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); run(active); }
              else if (e.key === "Escape") { e.preventDefault(); onClose(); }
            }} />
          <kbd className={styles.kbd}>esc</kbd>
        </div>

        <div ref={listRef} id="command-list" role="listbox" className={styles.list}>
          {items.length === 0 && <p className={styles.empty}>No results</p>}
          {items.map((item, i) => (
            <div key={item.id}>
              {item.group !== items[i - 1]?.group && <div className={styles.group}>{item.group}</div>}
              <div id={`command-${item.id}`} role="option" aria-selected={i === active} data-index={i}
                className={styles.item} onMouseMove={() => setActive(i)} onClick={() => run(i)}>
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.text}>
                  <span className={styles.label}>{item.label}</span>
                  {item.detail && <span className={styles.detail}>{item.detail}</span>}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          {query.trim()
            ? <span><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>↵</kbd> to select</span>
            : <span>Try “lunch with Sam fri at noon” or “gym every monday 6-7pm #health”</span>}
        </div>
      </div>
    </div>
  );
}
