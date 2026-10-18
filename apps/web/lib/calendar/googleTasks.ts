import { emptyEvent, type CalEvent, type RemindKey } from "./types";

// Reads the Tasks.json from a Google Takeout export (takeout.google.com → Tasks)
// so tasks can be moved into Remindly. Google doesn't document the file; it
// mirrors the Tasks API (task lists with `items`, each task with title, notes,
// status, due, parent…), so this accepts the shapes that can take and ignores
// anything else. Repeat rules aren't in the export at all.

export const GOOGLE_TASKS_SOURCE = "google_tasks";

export type TakeoutTask = {
  /** Google's task id, stored as external_id so importing twice doesn't duplicate. */
  id: string;
  list: string;
  title: string;
  notes: string;
  /** YYYY-MM-DD, or null when the task has no due date. */
  due: string | null;
  done: boolean;
  /** Title of the parent task, for subtasks. */
  parentTitle: string | null;
};

export type TakeoutTasks = {
  lists: { title: string; count: number }[];
  tasks: TakeoutTask[];
};

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Throws with a readable message when the file isn't a Tasks export. */
export function parseTakeoutTasks(data: unknown): TakeoutTasks {
  const lists = findLists(data);
  if (lists.length === 0) throw new Error("This doesn't look like a Google Tasks export. Pick the Tasks.json file from the Takeout download.");

  const tasks: TakeoutTask[] = [];
  const counts: { title: string; count: number }[] = [];
  lists.forEach((list, i) => {
    const listTitle = str(list.title).trim() || (lists.length === 1 ? "My Tasks" : `List ${i + 1}`);
    const raw = (Array.isArray(list.items) ? list.items : []).filter(isObject);
    const titles = new Map(raw.map((t) => [str(t.id), str(t.title).trim()]));
    let count = 0;
    for (const t of raw) {
      const title = str(t.title).trim();
      // Deleted tasks, and the blank rows Google keeps for unfinished new tasks, aren't worth bringing.
      if (t.deleted === true || !title) continue;
      const parent = str(t.parent);
      tasks.push({
        id: str(t.id) || `${listTitle}:${title}:${str(t.due)}`,
        list: listTitle,
        title,
        notes: str(t.notes).trim(),
        due: /^\d{4}-\d{2}-\d{2}/.test(str(t.due)) ? str(t.due).slice(0, 10) : null,
        // "hidden" tasks are completed ones that were cleared from the list.
        done: t.status === "completed" || Boolean(t.completed) || t.hidden === true,
        parentTitle: parent ? titles.get(parent) || null : null,
      });
      count++;
    }
    counts.push({ title: listTitle, count });
  });
  return { lists: counts, tasks };
}

/** Task lists in the shapes an export can take: { items: [list…] }, [list…], or a single list. */
function findLists(data: unknown): Json[] {
  const isList = (v: unknown): v is Json => isObject(v) && (v.kind === "tasks#taskList" || Array.isArray(v.items));
  if (Array.isArray(data)) return data.filter(isList);
  if (!isObject(data)) return [];
  if (Array.isArray(data.items) && data.items.some(isList)) return data.items.filter(isList);
  // A single list, or a bare object of tasks.
  if (Array.isArray(data.items) && data.items.some((t) => isObject(t) && "title" in t)) return [data];
  return [];
}

export type TaskImportOptions = {
  includeDone: boolean;
  /** Due date for tasks that have none. */
  undatedDue: string;
  remind: Exclude<RemindKey, "custom">;
  /** Category for each list title (missing = none). */
  categories: Record<string, string | null>;
};

/** The Remindly tasks to create, each with the Google id it came from. */
export function takeoutToEvents(parsed: TakeoutTasks, options: TaskImportOptions): { event: CalEvent; externalId: string }[] {
  return parsed.tasks
    .filter((t) => options.includeDone || !t.done)
    .map((t) => {
      const date = t.due ?? options.undatedDue;
      const desc = [t.notes, t.parentTitle ? `Subtask of “${t.parentTitle}” in Google Tasks.` : ""].filter(Boolean).join("\n\n");
      return {
        externalId: t.id,
        event: {
          ...emptyEvent(date),
          title: t.title,
          allDay: true,
          isTask: true,
          done: t.done,
          desc,
          categoryId: options.categories[t.list] ?? null,
          remind: options.remind,
          priority: "medium" as const,
        },
      };
    });
}
