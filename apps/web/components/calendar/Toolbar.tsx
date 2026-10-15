import { ChevronLeft, ChevronRight, PanelRight, Plus } from "lucide-react";
import { Button, IconButton, Segmented } from "@/components/ui/controls";
import { monthName } from "@/lib/calendar/dates";
import styles from "./Toolbar.module.css";

export type ViewMode = "month" | "week" | "agenda";

const VIEW_OPTIONS = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "agenda", label: "Agenda" },
] as const;

type ToolbarProps = {
  year: number;
  month: number;
  view: ViewMode;
  onView: (view: ViewMode) => void;
  onNav: (delta: number) => void;
  onToday: () => void;
  dayPanelOpen: boolean;
  onToggleDayPanel: () => void;
  onNew: () => void;
};

export function Toolbar({ year, month, view, onView, onNav, onToday, dayPanelOpen, onToggleDayPanel, onNew }: ToolbarProps) {
  const unit = view === "week" ? "week" : "month";

  return (
    <header className={styles.toolbar}>
      <h1 className={styles.title}>
        {monthName(month)} <span className={styles.year}>{year}</span>
      </h1>

      {view !== "agenda" && (
        <div className={styles.nav}>
          <Button size="sm" onClick={onToday}>Today</Button>
          <IconButton label={`Previous ${unit}`} onClick={() => onNav(-1)}>
            <ChevronLeft size={16} strokeWidth={1.75} />
          </IconButton>
          <IconButton label={`Next ${unit}`} onClick={() => onNav(1)}>
            <ChevronRight size={16} strokeWidth={1.75} />
          </IconButton>
        </div>
      )}

      <div className={styles.spacer} />

      <Segmented ariaLabel="Calendar view" options={VIEW_OPTIONS} value={view} onChange={onView} />
      {view !== "agenda" && (
        <IconButton label={dayPanelOpen ? "Hide day panel" : "Show day panel"} pressed={dayPanelOpen} onClick={onToggleDayPanel}>
          <PanelRight size={16} strokeWidth={1.75} />
        </IconButton>
      )}
      <Button variant="primary" size="sm" onClick={onNew}>
        <Plus size={14} strokeWidth={2.25} /> New
      </Button>
    </header>
  );
}
