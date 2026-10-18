import { Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/controls";
import { todayIso } from "@/lib/calendar/dates";
import { parseTakeoutTasks, takeoutToEvents, type TakeoutTasks } from "@/lib/calendar/googleTasks";
import { REMIND_OPTIONS, type CalEvent, type RemindKey } from "@/lib/calendar/types";
import { useCategories } from "./categories";
import styles from "./GoogleTasksImport.module.css";

export type ImportTasks = (items: { event: CalEvent; externalId: string }[]) => Promise<{ added: number; skipped: number }>;

type Remind = Exclude<RemindKey, "custom">;
const REMINDERS = REMIND_OPTIONS.filter((o): o is { value: Remind; label: string } => o.value !== "custom");

/** Settings → Import: moves tasks over from a Google Takeout export. */
export function GoogleTasksImport({ onImport }: { onImport: ImportTasks }) {
  const categories = useCategories();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<TakeoutTasks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeDone, setIncludeDone] = useState(false);
  const [remind, setRemind] = useState<Remind>("at-time");
  const [listCategories, setListCategories] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const next = parseTakeoutTasks(JSON.parse(await file.text()));
      setParsed(next);
      // A list named like a category goes into it.
      setListCategories(Object.fromEntries(next.lists.map((l) => [
        l.title, categories.find((c) => c.name.toLowerCase() === l.title.toLowerCase())?.id ?? null,
      ])));
    } catch (err) {
      setParsed(null);
      setError(err instanceof SyntaxError ? "That file isn't valid JSON." : err instanceof Error ? err.message : "Couldn't read that file.");
    }
  };

  const items = parsed
    ? takeoutToEvents(parsed, { includeDone, undatedDue: todayIso(), remind, categories: listCategories })
    : [];
  const doneCount = parsed?.tasks.filter((t) => t.done).length ?? 0;
  const undated = parsed?.tasks.filter((t) => !t.due && (includeDone || !t.done)).length ?? 0;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const { added, skipped } = await onImport(items);
      setResult(`Imported ${added} ${added === 1 ? "task" : "tasks"}${skipped ? ` · ${skipped} already here, skipped` : ""}.`);
      setParsed(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The import didn't finish.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.import}>
      <div className={styles.head}>
        <div>
          <div className={styles.name}>Google Tasks</div>
          <p className={styles.hint}>
            In <a href="https://takeout.google.com" target="_blank" rel="noreferrer">Google Takeout</a>, export only Tasks,
            unzip the download and pick <code>Tasks.json</code>.
          </p>
        </div>
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload size={14} strokeWidth={1.75} /> Choose file
        </Button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => void pick(e)} />
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {result && <p className={styles.result} role="status">{result}</p>}

      {parsed && (
        <div className={styles.preview}>
          <p className={styles.summary}>
            {parsed.tasks.length} {parsed.tasks.length === 1 ? "task" : "tasks"} in {parsed.lists.length} {parsed.lists.length === 1 ? "list" : "lists"}
            {doneCount > 0 && ` · ${doneCount} completed`}
          </p>

          <div className={styles.lists}>
            {parsed.lists.map((list) => (
              <label key={list.title} className={styles.list}>
                <span className={styles.listName}>{list.title}</span>
                <span className={styles.count}>{list.count}</span>
                <select className={styles.select} value={listCategories[list.title] ?? ""} aria-label={`Category for ${list.title}`}
                  onChange={(e) => setListCategories((m) => ({ ...m, [list.title]: e.target.value || null }))}>
                  <option value="">No category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            ))}
          </div>

          <label className={styles.option}>
            <span>Remind</span>
            <select className={styles.select} value={remind} onChange={(e) => setRemind(e.target.value as Remind)}>
              {REMINDERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          {doneCount > 0 && (
            <label className={styles.check}>
              <input type="checkbox" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} />
              Also bring over completed tasks
            </label>
          )}

          <ul className={styles.notes}>
            {undated > 0 && <li>{undated} {undated === 1 ? "task has" : "tasks have"} no due date, so {undated === 1 ? "it'll be" : "they'll be"} due today.</li>}
            <li>Google&apos;s export doesn&apos;t include repeats. Open a repeating task afterwards and set its repeat.</li>
            <li>Importing the same file again skips tasks already brought over.</li>
          </ul>

          <div className={styles.actions}>
            <Button size="sm" variant="ghost" onClick={() => setParsed(null)} disabled={busy}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={() => void run()} disabled={busy || items.length === 0}>
              {busy ? "Importing…" : `Import ${items.length} ${items.length === 1 ? "task" : "tasks"}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
