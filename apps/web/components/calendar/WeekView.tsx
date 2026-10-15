import { CircleCheck } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fmtTimeRangeShort, fmtTimeShort, hourLabel, minutesOf, parseIsoDate, toIsoDate, todayIso, weekOf, weekdayShort } from "@/lib/calendar/dates";
import { occurrenceKey, occurrencesBetween } from "@/lib/calendar/recurrence";
import { displayTitle, type CalEvent } from "@/lib/calendar/types";
import { catStyle } from "./catStyle";
import styles from "./WeekView.module.css";

const HOUR_PX = 48;
const FIRST_VISIBLE_HOUR = 7;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Current time, refreshed every minute. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

type WeekViewProps = {
  selDate: string | null;
  events: CalEvent[];
  onSelect: (date: string) => void;
  onOpenEvent: (ev: CalEvent) => void;
};

export function WeekView({ selDate, events: allEvents, onSelect, onOpenEvent }: WeekViewProps) {
  const now = useNow();
  const today = todayIso();
  const days = weekOf(selDate ? parseIsoDate(selDate) : new Date());
  const events = occurrencesBetween(allEvents, toIsoDate(days[0]!), toIsoDate(days[6]!));
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = FIRST_VISIBLE_HOUR * HOUR_PX - 8;
  }, []);

  const allDayOn = (ds: string) => events.filter((e) => e.date === ds && e.allDay);
  const hasAllDay = events.some((e) => e.allDay);

  return (
    <div className={styles.week}>
      <div className={styles.header}>
        <div className={styles.gutter} />
        {days.map((d) => {
          const ds = toIsoDate(d);
          return (
            <button key={ds} type="button" className={styles.dayHead} onClick={() => onSelect(ds)}>
              <span className={styles.dayName}>{weekdayShort(d.getDay())}</span>
              <span className={styles.dayNum} data-today={ds === today || undefined}>{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      {hasAllDay && (
        <div className={styles.allDay}>
          <div className={styles.gutterLabel}>All day</div>
          {days.map((d) => {
            const ds = toIsoDate(d);
            return (
              <div key={ds} className={styles.allDayCol}>
                {allDayOn(ds).map((ev) => (
                  <button key={occurrenceKey(ev)} type="button" className={styles.allDayItem} style={catStyle(ev.cat)} onClick={() => onOpenEvent(ev)}>
                    {ev.isTask && <CircleCheck size={12} strokeWidth={2} />}
                    <span>{displayTitle(ev)}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div ref={scrollRef} className={styles.scroll}>
        <div className={styles.body} style={{ height: HOURS.length * HOUR_PX }}>
          <div className={styles.gutter}>
            {HOURS.map((h) => (
              <div key={h} className={styles.hourLabel} style={{ top: h * HOUR_PX }}>{h === 0 ? "" : hourLabel(h)}</div>
            ))}
          </div>
          {days.map((d) => {
            const ds = toIsoDate(d);
            const isToday = ds === today;
            return (
              <div key={ds} className={styles.col} data-today={isToday || undefined}>
                {events.filter((e) => e.date === ds && !e.allDay).map((ev) => {
                  const start = minutesOf(ev.time);
                  const end = ev.end ? minutesOf(ev.end) : start + 60;
                  const height = Math.max(((end - start) / 60) * HOUR_PX - 2, 20);
                  const short = height < 36;
                  return (
                    <button key={occurrenceKey(ev)} type="button" className={styles.event} style={{ ...catStyle(ev.cat), top: (start / 60) * HOUR_PX + 1, height }}
                      onClick={() => onOpenEvent(ev)} data-short={short || undefined}>
                      <span className={styles.eventTitle}>{displayTitle(ev)}</span>
                      <span className={styles.eventTime}>{short ? fmtTimeShort(ev.time) : fmtTimeRangeShort(ev.time, ev.end)}</span>
                    </button>
                  );
                })}
                {isToday && (
                  <div className={styles.nowLine} style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
