import { Plus } from "lucide-react";
import { IconButton } from "@/components/ui/controls";
import { addDays, parseIsoDate, relativeDayLabel, toIsoDate, todayIso } from "@/lib/calendar/dates";
import type { CalEvent } from "@/lib/calendar/types";
import { AgendaList } from "./AgendaList";
import styles from "./DayPanel.module.css";

const COMING_UP_DAYS = 14;

type DayPanelProps = {
  date: string;
  events: CalEvent[];
  onOpenEvent: (ev: CalEvent) => void;
  onToggleDone: (ev: CalEvent) => void;
  onCreate: (date: string) => void;
};

/** The selected day's schedule, then what's coming after it. */
export function DayPanel({ date, events, onOpenEvent, onToggleDone, onCreate }: DayPanelProps) {
  const fullDate = parseIsoDate(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const relative = relativeDayLabel(date);
  const isRelative = relative === "Today" || relative === "Tomorrow";
  const nextDay = toIsoDate(addDays(parseIsoDate(date), 1));
  const lastDay = toIsoDate(addDays(parseIsoDate(date), COMING_UP_DAYS));

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 className={styles.title} data-today={date === todayIso() || undefined}>{isRelative ? relative : fullDate}</h2>
          {isRelative && <p className={styles.subtitle}>{fullDate}</p>}
        </div>
        <IconButton label="New event on this day" onClick={() => onCreate(date)}>
          <Plus size={16} strokeWidth={1.75} />
        </IconButton>
      </header>

      <div className={styles.scroll}>
        <AgendaList events={events} from={date} to={date} compact hideDayLabels
          onOpenEvent={onOpenEvent} onToggleDone={onToggleDone}
          empty={
            <p className={styles.empty}>
              Nothing scheduled. <button type="button" className={styles.link} onClick={() => onCreate(date)}>Add an event</button>
            </p>
          } />

        <h3 className={styles.section}>Coming up</h3>
        <AgendaList events={events} from={nextDay} to={lastDay} compact
          onOpenEvent={onOpenEvent} onToggleDone={onToggleDone}
          empty={<p className={styles.empty}>Nothing in the next two weeks.</p>} />
      </div>
    </div>
  );
}
