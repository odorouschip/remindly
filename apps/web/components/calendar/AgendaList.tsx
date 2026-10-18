import { Repeat } from "lucide-react";
import type { ReactNode } from "react";
import { addDays, parseIsoDate, relativeDayLabel, toIsoDate, todayIso } from "@/lib/calendar/dates";
import { timeColumnLabel, untilLabel, whenLabel } from "@/lib/calendar/display";
import { byDay, occurrenceKey, occurrencesBetween } from "@/lib/calendar/recurrence";
import { sortByStart, type CalEvent } from "@/lib/calendar/types";
import { catStyle, useCategoryLookup } from "./categories";
import { TaskCheck } from "./TaskCheck";
import styles from "./AgendaList.module.css";

/** How far past `from` repeating events are listed when no `to` is given. */
const HORIZON_DAYS = 60;

type AgendaListProps = {
  events: CalEvent[];
  onOpenEvent: (ev: CalEvent) => void;
  onToggleDone: (ev: CalEvent) => void;
  /** First day listed (YYYY-MM-DD). */
  from: string;
  /** Last day listed. Defaults to a horizon that still includes every later one-off event. */
  to?: string;
  /** The narrow side-panel layout. */
  compact?: boolean;
  /** Hide the per-day headings, e.g. when listing a single day. */
  hideDayLabels?: boolean;
  empty?: ReactNode;
};

/** Events and tasks from `from` onward, grouped by day. */
export function AgendaList({ events, onOpenEvent, onToggleDone, from, to, compact = false, hideDayLabels = false, empty }: AgendaListProps) {
  const lookup = useCategoryLookup();
  const today = todayIso();
  const last = to ?? events.reduce(
    (max, e) => (!e.recur && e.date > max ? e.date : max),
    toIsoDate(addDays(parseIsoDate(from), HORIZON_DAYS)),
  );

  const groups = new Map<string, CalEvent[]>();
  for (const ev of byDay(occurrencesBetween(events, from, last), from, last).sort(sortByStart)) {
    const list = groups.get(ev.date);
    if (list) list.push(ev);
    else groups.set(ev.date, [ev]);
  }

  if (groups.size === 0) {
    return empty ?? (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Nothing coming up</p>
        <p className={styles.emptyHint}>New events and tasks will show here.</p>
      </div>
    );
  }

  return (
    <div className={compact ? styles.compact : styles.full}>
      {[...groups].map(([date, dayEvents]) => (
        <section key={date} className={styles.group} data-past={date < today || undefined}>
          {!hideDayLabels && (
            <h3 className={styles.dayLabel} data-today={date === today || undefined}>
              {relativeDayLabel(date, !compact)}
            </h3>
          )}
          {dayEvents.map((ev) => (
            <div key={occurrenceKey(ev)} className={styles.row} style={catStyle(lookup(ev.categoryId)?.color)} data-done={ev.done || undefined}>
              {!compact && (
                <span className={styles.time}>{timeColumnLabel(ev)}</span>
              )}
              {ev.isTask
                ? <TaskCheck done={ev.done} onToggle={() => onToggleDone(ev)} />
                : <span className={styles.bar} />}
              <button type="button" className={styles.main} onClick={() => onOpenEvent(ev)}>
                <span className={styles.title}>
                  {ev.title}
                  {ev.recur && <Repeat size={11} strokeWidth={2} className={styles.recur} aria-label={`Repeats ${ev.recur.toLowerCase()}`} />}
                </span>
                {compact && !ev.isTask && <span className={styles.meta}>{whenLabel(ev)}</span>}
                {!compact && untilLabel(ev) && <span className={styles.meta}>{untilLabel(ev)}</span>}
                {ev.desc && <span className={styles.desc}>{ev.desc}</span>}
              </button>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
