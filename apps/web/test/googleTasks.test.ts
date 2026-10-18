import { describe, expect, it } from "vitest";
import { parseTakeoutTasks, takeoutToEvents } from "../lib/calendar/googleTasks";

// Shaped like the Tasks API resources Takeout mirrors.
const EXPORT = {
  kind: "tasks#taskLists",
  items: [
    {
      kind: "tasks#taskList", id: "L1", title: "My Tasks",
      items: [
        { kind: "tasks#task", id: "a", title: "Pay rent", status: "needsAction", due: "2026-11-01T00:00:00.000Z", notes: "Online portal" },
        { kind: "tasks#task", id: "b", title: "Bring forms", status: "needsAction", parent: "a" },
        { kind: "tasks#task", id: "c", title: "Old thing", status: "completed", completed: "2026-09-01T12:00:00.000Z", due: "2026-08-30T00:00:00.000Z" },
        { kind: "tasks#task", id: "d", title: "Cleared", status: "completed", hidden: true },
        { kind: "tasks#task", id: "e", title: "Gone", status: "needsAction", deleted: true },
        { kind: "tasks#task", id: "f", title: "  ", status: "needsAction" },
      ],
    },
    { kind: "tasks#taskList", id: "L2", title: "Groceries", items: [{ kind: "tasks#task", id: "g", title: "Milk", status: "needsAction" }] },
    { kind: "tasks#taskList", id: "L3", title: "Empty" },
  ],
};

describe("parseTakeoutTasks", () => {
  const parsed = parseTakeoutTasks(EXPORT);

  it("reads every list, skipping deleted and blank tasks", () => {
    expect(parsed.lists).toEqual([{ title: "My Tasks", count: 4 }, { title: "Groceries", count: 1 }, { title: "Empty", count: 0 }]);
    expect(parsed.tasks.map((t) => t.id)).toEqual(["a", "b", "c", "d", "g"]);
  });

  it("keeps due dates as dates, done state, notes and parents", () => {
    expect(parsed.tasks[0]).toMatchObject({ title: "Pay rent", due: "2026-11-01", done: false, notes: "Online portal", list: "My Tasks" });
    expect(parsed.tasks[1]).toMatchObject({ due: null, parentTitle: "Pay rent" });
    expect(parsed.tasks.filter((t) => t.done).map((t) => t.id)).toEqual(["c", "d"]);
  });

  it("accepts a bare array of lists or a single list", () => {
    expect(parseTakeoutTasks(EXPORT.items).tasks).toHaveLength(5);
    expect(parseTakeoutTasks(EXPORT.items[1]).tasks.map((t) => t.title)).toEqual(["Milk"]);
  });

  it("says so when the file isn't a Tasks export", () => {
    expect(() => parseTakeoutTasks({ foo: 1 })).toThrow(/Google Tasks export/);
    expect(() => parseTakeoutTasks("hello")).toThrow(/Google Tasks export/);
  });
});

describe("takeoutToEvents", () => {
  const parsed = parseTakeoutTasks(EXPORT);
  const options = { includeDone: false, undatedDue: "2026-10-18", remind: "at-time" as const, categories: { Groceries: "c-home" } };

  it("makes open tasks into Remindly tasks, undated ones due on the given day", () => {
    const out = takeoutToEvents(parsed, options);
    expect(out.map((o) => o.externalId)).toEqual(["a", "b", "g"]);
    expect(out[0]!.event).toMatchObject({ title: "Pay rent", date: "2026-11-01", endDate: "2026-11-01", isTask: true, allDay: true, desc: "Online portal", remind: "at-time", categoryId: null });
    expect(out[1]!.event).toMatchObject({ date: "2026-10-18", desc: "Subtask of “Pay rent” in Google Tasks." });
    expect(out[2]!.event.categoryId).toBe("c-home");
  });

  it("brings completed tasks only when asked, already checked off", () => {
    const out = takeoutToEvents(parsed, { ...options, includeDone: true });
    expect(out.filter((o) => o.event.done).map((o) => o.externalId)).toEqual(["c", "d"]);
  });
});
