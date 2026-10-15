import { CircleCheck, Repeat } from "lucide-react";
import { addDays, fmtTime, fmtTimeRange, parseIsoDate, relativeDayLabel, toIsoDate, todayIso } from "@/lib/calendar/dates";
import { occurrenceKey, occurrencesBetween } from "@/lib/calendar/recurrence";
import { displayTitle, sortByStart, type CalEvent } from "@/lib/calendar/types";
import { catStyle } from "./catStyle";
import styles from "./AgendaList.module.css";

type AgendaListProps = {
  events: CalEvent[];
  onOpenEvent: (ev: CalEvent) => void;
  /** The narrow side-panel layout. */
  compact?: boolean;
};

/** How far ahead repeating events are listed. */
const HORIZON_DAYS = 60;

/** Upcoming events (today onward), grouped by day. */
export function AgendaList({ events, onOpenEvent, compact = false }: AgendaListProps) {
  const today = todayIso();
  const groups = new Map<string, CalEvent[]>();
  const horizon = toIsoDate(addDays(parseIsoDate(today), HORIZON_DAYS));
  const lastDate = events.reduce((max, e) => (!e.recur && e.date > max ? e.date : max), horizon);
  for (const ev of occurrencesBetween(events, today, lastDate).sort(sortByStart)) {
    const list = groups.get(ev.date);
    if (list) list.push(ev);
    else groups.set(ev.date, [ev]);
  }

  if (groups.size === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Nothing coming up</p>
        <p className={styles.emptyHint}>New events and tasks will show here.</p>
      </div>
    );
  }

  return (
    <div className={compact ? styles.compact : styles.full}>
      {[...groups].map(([date, dayEvents]) => (
        <section key={date} className={styles.group}>
          <h3 className={styles.dayLabel} data-today={date === today || undefined}>
            {relativeDayLabel(date, !compact)}
          </h3>
          {dayEvents.map((ev) => (
            <button key={occurrenceKey(ev)} type="button" className={styles.row} style={catStyle(ev.cat)} onClick={() => onOpenEvent(ev)}>
              {!compact && (
                <span className={styles.time}>{ev.isTask ? "Task" : ev.allDay ? "All day" : fmtTime(ev.time)}</span>
              )}
              {ev.isTask
                ? <CircleCheck size={14} strokeWidth={2} className={styles.taskIcon} />
                : <span className={styles.bar} />}
              <span className={styles.main}>
                <span className={styles.title}>
                  {displayTitle(ev)}
                  {ev.recur && <Repeat size={11} strokeWidth={2} className={styles.recur} aria-label={`Repeats ${ev.recur.toLowerCase()}`} />}
                </span>
                {compact && !ev.isTask && <span className={styles.meta}>{ev.allDay ? "All day" : fmtTimeRange(ev.time, ev.end)}</span>}
                {!compact && !ev.allDay && ev.end && <span className={styles.meta}>until {fmtTime(ev.end)}</span>}
                {ev.desc && <span className={styles.desc}>{ev.desc}</span>}
              </span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
