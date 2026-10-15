import { CircleCheck } from "lucide-react";
import { WEEKDAYS, fmtTimeShort, monthGrid, toIsoDate, todayIso } from "@/lib/calendar/dates";
import { displayTitle, sortByStart, type CalEvent } from "@/lib/calendar/types";
import { catStyle } from "./catStyle";
import styles from "./MonthView.module.css";

const MAX_PER_DAY = 3;

type MonthViewProps = {
  year: number;
  month: number;
  events: CalEvent[];
  selDate: string | null;
  onSelect: (date: string) => void;
  onCreate: (date: string) => void;
  onOpenEvent: (ev: CalEvent) => void;
};

export function MonthView({ year, month, events, selDate, onSelect, onCreate, onOpenEvent }: MonthViewProps) {
  const today = todayIso();
  const cells = monthGrid(year, month);
  const byDate = new Map<string, CalEvent[]>();
  for (const ev of [...events].sort(sortByStart)) {
    const list = byDate.get(ev.date);
    if (list) list.push(ev);
    else byDate.set(ev.date, [ev]);
  }

  return (
    <div className={styles.month}>
      <div className={styles.weekdays}>
        {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className={styles.grid} style={{ gridTemplateRows: `repeat(${cells.length / 7}, minmax(0, 1fr))` }}>
        {cells.map((d) => {
          const ds = toIsoDate(d);
          const dayEvents = byDate.get(ds) ?? [];
          return (
            <div key={ds} className={styles.cell}
              data-outside={d.getMonth() !== month || undefined}
              data-selected={ds === selDate || undefined}
              onClick={() => onSelect(ds)}
              onDoubleClick={() => onCreate(ds)}>
              <span className={styles.dayNum} data-today={ds === today || undefined}>
                {d.getDate() === 1 && d.getMonth() !== month ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : d.getDate()}
              </span>
              {dayEvents.slice(0, MAX_PER_DAY).map((ev) => (
                <button key={ev.id} type="button" className={styles.event} style={catStyle(ev.cat)}
                  onClick={(e) => { e.stopPropagation(); onOpenEvent(ev); }}
                  onDoubleClick={(e) => e.stopPropagation()}>
                  <span className={styles.lead}>
                    {ev.isTask
                      ? <CircleCheck size={12} strokeWidth={2} className={styles.taskIcon} />
                      : <span className={styles.dot} />}
                    <span className={styles.eventTitle}>{displayTitle(ev)}</span>
                  </span>
                  {ev.time && <span className={styles.eventTime}>{fmtTimeShort(ev.time)}</span>}
                </button>
              ))}
              {dayEvents.length > MAX_PER_DAY && (
                <span className={styles.more}>{dayEvents.length - MAX_PER_DAY} more</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
