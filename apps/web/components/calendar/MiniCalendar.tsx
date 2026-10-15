import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/controls";
import { WEEKDAYS, monthGrid, monthName, toIsoDate, todayIso } from "@/lib/calendar/dates";
import styles from "./MiniCalendar.module.css";

type MiniCalendarProps = {
  year: number;
  month: number;
  selDate: string | null;
  onNav: (delta: number) => void;
  onSelect: (date: string) => void;
};

export function MiniCalendar({ year, month, selDate, onNav, onSelect }: MiniCalendarProps) {
  const today = todayIso();

  return (
    <div>
      <div className={styles.header}>
        <span className={styles.title}>{monthName(month)} {year}</span>
        <IconButton label="Previous month" size={24} onClick={() => onNav(-1)}>
          <ChevronLeft size={14} strokeWidth={1.75} />
        </IconButton>
        <IconButton label="Next month" size={24} onClick={() => onNav(1)}>
          <ChevronRight size={14} strokeWidth={1.75} />
        </IconButton>
      </div>
      <div className={styles.grid}>
        {WEEKDAYS.map((d) => <div key={d} className={styles.weekday}>{d[0]}</div>)}
        {monthGrid(year, month).map((d) => {
          const ds = toIsoDate(d);
          return (
            <button key={ds} type="button" className={styles.day} onClick={() => onSelect(ds)}
              data-outside={d.getMonth() !== month || undefined}
              data-today={ds === today || undefined}
              data-selected={ds === selDate || undefined}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
