import { CalendarDays, CircleCheck, Columns3, LayoutGrid, List, Monitor, Moon, PanelRight, Plus, Settings, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addDays, parseIsoDate, relativeDayLabel, toIsoDate, todayIso } from "@/lib/calendar/dates";
import { applyToSeries, changesSeriesOnly, endBefore, hasChanges, overrideFor } from "@/lib/calendar/occurrenceEdits";
import { nextTaskDue, occurrenceOf } from "@/lib/calendar/recurrence";
import { emptyEvent, type CalEvent, type Category, type OccurrenceOverride } from "@/lib/calendar/types";
import { applyThemePref, readThemePref, type ThemePref } from "@/lib/theme";
import { Button } from "@/components/ui/controls";
import { AgendaList } from "./AgendaList";
import { CategoriesContext } from "./categories";
import { CommandBar, type CommandAction } from "./CommandBar";
import { DayPanel } from "./DayPanel";
import { EventPanel } from "./EventPanel";
import { MonthView } from "./MonthView";
import type { ImportTasks } from "./GoogleTasksImport";
import { ScopeDialog, type Scope } from "./ScopeDialog";
import { SettingsModal } from "./SettingsModal";
import { Sidebar, type Account } from "./Sidebar";
import { Toolbar, type ViewMode } from "./Toolbar";
import { WeekView } from "./WeekView";
import styles from "./Workspace.module.css";

type WorkspaceProps = {
  events: CalEvent[];
  categories: Category[];
  account: Account;
  notice: string | null;
  onNotify: (message: string) => void;
  onSave: (ev: CalEvent) => void;
  onDelete: (id: string) => void;
  onSaveOccurrence: (seriesId: string, occurrenceDate: string, override: OccurrenceOverride | null) => void;
  onSaveCategory: (cat: Category) => void;
  onImportTasks: ImportTasks;
  onDeleteCategory: (id: string) => void;
  onSignOut: () => void;
};

export function Workspace(props: WorkspaceProps) {
  const { events, categories, account, notice, onNotify, onSave, onDelete, onSaveOccurrence, onSignOut } = props;
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
  const [hiddenCats, setHiddenCats] = useState<ReadonlySet<string>>(new Set());
  // `session` changes on every open so the editor resets even if it's already showing.
  const [panel, setPanel] = useState<{
    open: boolean; editing: CalEvent | null; date?: string | undefined; time?: string | undefined; session: number;
  }>({ open: false, editing: null, session: 0 });
  // Asking "this event or all events?" about the occurrence in the panel.
  const [scope, setScope] = useState<{ action: "save"; edited: CalEvent } | { action: "delete" } | null>(null);
  // Which settings section to scroll to, or null when closed.
  const [settings, setSettings] = useState<null | "top" | "categories">(null);
  const [themePref, setThemePref] = useState<ThemePref>("system");
  const [commandOpen, setCommandOpen] = useState(false);
  const [modKey, setModKey] = useState("Ctrl");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setThemePref(readThemePref());
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setModKey("⌘");
  }, []);

  // ⌘K / Ctrl+K opens the command bar; "/" focuses search, like most Notion-style apps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
        return;
      }
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
  // Views hand over copies (occurrences, day segments); the stored series is the source of truth.
  const seriesOf = (ev: CalEvent) => events.find((e) => e.id === ev.id) ?? ev;
  // A repeating event opens at the occurrence that was clicked; anything else opens as stored.
  const openEvent = (ev: CalEvent) => {
    const series = seriesOf(ev);
    const editing = series.recur && ev.occurrenceDate ? occurrenceOf(series, ev.occurrenceDate) : series;
    setPanel((p) => ({ open: true, editing, session: p.session + 1 }));
  };
  const closePanel = () => setPanel((p) => ({ ...p, open: false, editing: null }));

  // Saving or deleting one occurrence of a repeating event asks which ones it applies to.
  const shown = panel.editing;
  const occurrence = shown?.id && shown.occurrenceDate && seriesOf(shown).recur ? shown : null;

  const saveFromPanel = (edited: CalEvent) => {
    if (!occurrence) { onSave(edited); closePanel(); return; }
    if (!hasChanges(occurrence, edited)) { closePanel(); return; }
    // A new repeat rule, all-day or kind can only mean the whole series.
    if (changesSeriesOnly(occurrence, edited)) { onSave(applyToSeries(seriesOf(occurrence), occurrence, edited)); closePanel(); return; }
    setScope({ action: "save", edited });
  };

  const deleteFromPanel = (id: string) => {
    if (!occurrence) { onDelete(id); closePanel(); return; }
    setScope({ action: "delete" });
  };

  const chooseScope = (choice: Scope) => {
    if (!occurrence || !scope) return;
    const series = seriesOf(occurrence);
    const date = occurrence.occurrenceDate!;
    if (scope.action === "save") {
      if (choice === "this") onSaveOccurrence(series.id, date, overrideFor(series, date, scope.edited));
      else onSave(applyToSeries(series, occurrence, scope.edited));
    } else if (choice === "this") {
      onSaveOccurrence(series.id, date, { cancelled: true });
    } else {
      const shortened = choice === "following" ? endBefore(series, date) : null;
      if (shortened) onSave(shortened);
      else onDelete(series.id);
    }
    setScope(null);
    closePanel();
  };
  const toggleDone = (ev: CalEvent) => {
    const series = seriesOf(ev);
    // Checking off a repeating task moves it to its next due date instead.
    const next = series.recur && !series.done ? nextTaskDue(series, todayIso()) : null;
    if (next) {
      onSave({ ...series, date: next, endDate: next });
      const label = relativeDayLabel(next);
      onNotify(`Done · “${series.title}” is next due ${next <= toIsoDate(addDays(new Date(), 1)) ? label.toLowerCase() : label}`);
      return;
    }
    onSave({ ...series, done: !series.done });
  };

  const toggleCat = (id: string) => setHiddenCats((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const query = search.trim().toLowerCase();
  const visible = events.filter((e) =>
    !(e.categoryId && hiddenCats.has(e.categoryId)) && (!query || e.title.toLowerCase().includes(query)));

  const setTheme = (p: ThemePref) => { setThemePref(p); applyThemePref(p); };
  const jumpTo = (date: string) => {
    goToDate(date);
    if (view === "agenda") setView("month");
  };

  const commandActions: CommandAction[] = [
    { id: "new-event", label: "New event", icon: <Plus size={16} strokeWidth={1.75} />, keywords: "create add", run: () => openNew() },
    { id: "new-task", label: "New task", icon: <CircleCheck size={16} strokeWidth={1.75} />, keywords: "create add todo",
      run: () => openEvent({ ...emptyEvent(selDate ?? todayIso()), allDay: true, isTask: true, remind: "1-day", priority: "medium" }) },
    { id: "today", label: "Go to today", icon: <CalendarDays size={16} strokeWidth={1.75} />, run: () => jumpTo(todayIso()) },
    { id: "view-month", label: "Month view", icon: <LayoutGrid size={16} strokeWidth={1.75} />, keywords: "switch show", run: () => setView("month") },
    { id: "view-week", label: "Week view", icon: <Columns3 size={16} strokeWidth={1.75} />, keywords: "switch show", run: () => setView("week") },
    { id: "view-agenda", label: "Agenda view", icon: <List size={16} strokeWidth={1.75} />, keywords: "switch show list", run: () => setView("agenda") },
    { id: "day-panel", label: dayPanelOpen ? "Hide day panel" : "Show day panel", icon: <PanelRight size={16} strokeWidth={1.75} />,
      keywords: "toggle sidebar", run: () => setDayPanelOpen((o) => !o) },
    { id: "theme-light", label: "Light theme", icon: <Sun size={16} strokeWidth={1.75} />, keywords: "appearance mode", run: () => setTheme("light") },
    { id: "theme-dark", label: "Dark theme", icon: <Moon size={16} strokeWidth={1.75} />, keywords: "appearance mode", run: () => setTheme("dark") },
    { id: "theme-system", label: "Match system theme", icon: <Monitor size={16} strokeWidth={1.75} />, keywords: "appearance mode auto", run: () => setTheme("system") },
    { id: "settings", label: "Settings", icon: <Settings size={16} strokeWidth={1.75} />, keywords: "preferences account", run: () => setSettings("top") },
  ];

  const createFromCommand = (draft: CalEvent) => {
    onSave(draft);
    jumpTo(draft.date);
    onNotify(`Added “${draft.title}” · ${relativeDayLabel(draft.date)}`);
  };

  const showDayPanel = dayPanelOpen && view !== "agenda" && !panel.open;
  const today = todayIso();
  // While searching, list every match including past ones.
  const agendaFrom = query
    ? visible.reduce((min, e) => (e.date < min ? e.date : min), today)
    : toIsoDate(addDays(parseIsoDate(today), -agendaBack));

  return (
    <CategoriesContext.Provider value={categories}>
      <div className={styles.workspace}>
        <Sidebar
          search={search} onSearch={setSearch} searchRef={searchRef}
          year={cursor.year} month={cursor.month} selDate={selDate}
          onNavMonth={navMonth}
          onSelectDate={(ds) => { goToDate(ds); if (view === "agenda") setView("month"); }}
          hiddenCats={hiddenCats} onToggleCat={toggleCat} onEditCategories={() => setSettings("categories")}
          account={account} onOpenSettings={() => setSettings("top")} onSignOut={onSignOut}
          onOpenCommand={() => setCommandOpen(true)} modKey={modKey} />

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
          onSave={saveFromPanel}
          onDelete={deleteFromPanel} />

        <ScopeDialog action={scope?.action ?? null} isFirst={Boolean(occurrence && occurrence.occurrenceDate! <= seriesOf(occurrence).date)}
          onChoose={chooseScope} onCancel={() => setScope(null)} />

        <SettingsModal open={settings !== null} focus={settings ?? "top"} onClose={() => setSettings(null)}
          themePref={themePref} onThemePref={setTheme}
          onSaveCategory={props.onSaveCategory} onDeleteCategory={props.onDeleteCategory} onImportTasks={props.onImportTasks}
          account={account} onSignOut={onSignOut} />

        <CommandBar open={commandOpen} onClose={() => setCommandOpen(false)} events={events} actions={commandActions}
          onCreate={createFromCommand} onEditDraft={openEvent} onGoToDate={jumpTo}
          onOpenEvent={(ev) => { jumpTo(ev.date); openEvent(ev); }} />

        {notice && <div className={styles.toast} role="status">{notice}</div>}
      </div>
    </CategoriesContext.Provider>
  );
}
