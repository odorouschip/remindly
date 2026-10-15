import { useEffect, useRef, useState } from "react";
import { addDays, parseIsoDate, toIsoDate, todayIso } from "@/lib/calendar/dates";
import type { CalEvent, CategoryId } from "@/lib/calendar/types";
import { applyThemePref, readThemePref, type ThemePref } from "@/lib/theme";
import { Button } from "@/components/ui/controls";
import { AgendaList } from "./AgendaList";
import { DayPanel } from "./DayPanel";
import { EventPanel } from "./EventPanel";
import { MonthView } from "./MonthView";
import { SettingsModal } from "./SettingsModal";
import { Sidebar, type Account } from "./Sidebar";
import { Toolbar, type ViewMode } from "./Toolbar";
import { WeekView } from "./WeekView";
import styles from "./Workspace.module.css";

type WorkspaceProps = {
  events: CalEvent[];
  account: Account;
  notice: string | null;
  onSave: (ev: CalEvent) => void;
  onDelete: (id: string) => void;
  onSignOut: () => void;
};

export function Workspace({ events, account, notice, onSave, onDelete, onSignOut }: WorkspaceProps) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selDate, setSelDate] = useState<string | null>(todayIso);
  const [view, setView] = useState<ViewMode>("month");
  const [dayPanelOpen, setDayPanelOpen] = useState(true);
  // How many days before today the Agenda view reaches back ("Show earlier").
  const [agendaBack, setAgendaBack] = useState(0);
  const [search, setSearch] = useState("");
  const [hiddenCats, setHiddenCats] = useState<ReadonlySet<CategoryId>>(new Set());
  // `session` changes on every open so the editor resets even if it's already showing.
  const [panel, setPanel] = useState<{
    open: boolean; editing: CalEvent | null; date?: string | undefined; time?: string | undefined; session: number;
  }>({ open: false, editing: null, session: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [themePref, setThemePref] = useState<ThemePref>("system");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setThemePref(readThemePref()), []);

  // "/" focuses search, like most Notion-style apps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || target.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goToDate = (ds: string) => {
    setSelDate(ds);
    const d = parseIsoDate(ds);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  const navMonth = (delta: number) => {
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const nav = (delta: number) => {
    if (view === "week") goToDate(toIsoDate(addDays(selDate ? parseIsoDate(selDate) : new Date(), delta * 7)));
    else navMonth(delta);
  };

  const openNew = (date?: string, time?: string) => {
    if (date) setSelDate(date);
    setPanel((p) => ({ open: true, editing: null, date: date ?? selDate ?? todayIso(), time, session: p.session + 1 }));
  };
  // Occurrences of a repeating event are copies; edit the stored series instead.
  const seriesOf = (ev: CalEvent) => events.find((e) => e.id === ev.id) ?? ev;
  const openEvent = (ev: CalEvent) =>
    setPanel((p) => ({ open: true, editing: seriesOf(ev), session: p.session + 1 }));
  const closePanel = () => setPanel((p) => ({ ...p, open: false, editing: null }));
  const toggleDone = (ev: CalEvent) => {
    const series = seriesOf(ev);
    onSave({ ...series, done: !series.done });
  };

  const toggleCat = (id: CategoryId) => setHiddenCats((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const query = search.trim().toLowerCase();
  const visible = events.filter((e) =>
    !hiddenCats.has(e.cat) && (!query || e.title.toLowerCase().includes(query)));

  const showDayPanel = dayPanelOpen && view !== "agenda" && !panel.open;
  const today = todayIso();
  // While searching, list every match including past ones.
  const agendaFrom = query
    ? visible.reduce((min, e) => (e.date < min ? e.date : min), today)
    : toIsoDate(addDays(parseIsoDate(today), -agendaBack));

  return (
    <div className={styles.workspace}>
      <Sidebar
        search={search} onSearch={setSearch} searchRef={searchRef}
        year={cursor.year} month={cursor.month} selDate={selDate}
        onNavMonth={navMonth}
        onSelectDate={(ds) => { goToDate(ds); if (view === "agenda") setView("month"); }}
        hiddenCats={hiddenCats} onToggleCat={toggleCat}
        account={account} onOpenSettings={() => setShowSettings(true)} onSignOut={onSignOut} />

      <main className={styles.main}>
        <Toolbar year={cursor.year} month={cursor.month} view={view} onView={setView}
          onNav={nav} onToday={() => goToDate(todayIso())}
          dayPanelOpen={dayPanelOpen} onToggleDayPanel={() => setDayPanelOpen((o) => !o)}
          onNew={() => openNew()} />

        {query && (
          <div className={styles.searchBar}>
            {visible.length === 0 ? "No matches" : `${visible.length} ${visible.length === 1 ? "match" : "matches"}`} for “{search.trim()}”
            {view !== "agenda" && visible.length > 0 && (
              <button type="button" onClick={() => setView("agenda")}>Show as list</button>
            )}
            <button type="button" onClick={() => setSearch("")}>Clear</button>
          </div>
        )}

        <div className={styles.content}>
          {view === "month" && (
            <MonthView year={cursor.year} month={cursor.month} events={visible} selDate={selDate}
              onSelect={goToDate} onCreate={openNew} onOpenEvent={openEvent} />
          )}
          {view === "week" && (
            <WeekView selDate={selDate} events={visible} onSelect={goToDate} onOpenEvent={openEvent} onCreate={openNew} />
          )}
          {view === "agenda" && (
            <div className={styles.scroll}>
              {!query && (
                <div className={styles.earlier}>
                  <Button variant="ghost" size="sm" onClick={() => setAgendaBack((d) => d + 30)}>Show earlier</Button>
                </div>
              )}
              <AgendaList events={visible} from={agendaFrom} onOpenEvent={openEvent} onToggleDone={toggleDone} />
            </div>
          )}
        </div>
      </main>

      <aside className={styles.dayPanel} data-open={showDayPanel || undefined} inert={!showDayPanel}>
        <DayPanel date={selDate ?? today} events={visible}
          onOpenEvent={openEvent} onToggleDone={toggleDone} onCreate={openNew} />
      </aside>

      <EventPanel open={panel.open} editing={panel.editing} session={panel.session}
        defaultDate={panel.date ?? selDate ?? today} defaultTime={panel.time}
        onClose={closePanel}
        onSave={(ev) => { onSave(ev); closePanel(); }}
        onDelete={(id) => { onDelete(id); closePanel(); }} />

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)}
        themePref={themePref} onThemePref={(p) => { setThemePref(p); applyThemePref(p); }}
        account={account} onSignOut={onSignOut} />

      {notice && <div className={styles.toast} role="status">{notice}</div>}
    </div>
  );
}
