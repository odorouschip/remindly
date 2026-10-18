import type { CalendarBackend } from "./backend";
import { addDays, toIsoDate } from "./dates";
import { STARTER_CATEGORIES, emptyEvent, type CalEvent, type Category } from "./types";

const DEMO_CATEGORIES: Category[] = STARTER_CATEGORIES.map((c, i) => ({ ...c, id: `cat-${i + 1}` }));
const catId = (name: string) => DEMO_CATEGORIES.find((c) => c.name === name)?.id ?? null;

/** Seed events dated relative to today so every view has something in it. */
function seedEvents(): CalEvent[] {
  const day = (offset: number) => toIsoDate(addDays(new Date(), offset));
  const ev = (offset: number, title: string, time: string, end: string, cat: string, extra: Partial<CalEvent> = {}): CalEvent => ({
    ...emptyEvent(day(offset)), title, time, end, categoryId: catId(cat), ...extra,
  });
  const allDay = (offset: number, title: string, cat: string, extra: Partial<CalEvent> = {}): CalEvent =>
    ev(offset, title, "", "", cat, { allDay: true, ...extra });
  const task = (offset: number, title: string, priority: CalEvent["priority"], extra: Partial<CalEvent> = {}): CalEvent => ({
    ...emptyEvent(day(offset)), title, allDay: true, isTask: true, categoryId: catId("Personal"),
    remind: "1-day", priority, ...extra,
  });

  const events: CalEvent[] = [
    ev(-12, "Coffee with Jordan", "09:30", "10:15", "Social"),
    ev(-9, "Quarterly review", "10:00", "11:30", "Work"),
    ev(-26, "Book club", "19:00", "20:30", "Social", { recur: "Monthly", desc: "Chapters 8–12" }),
    ev(-2, "Haircut", "16:00", "16:45", "Personal"),
    task(-1, "Order air filters", "low", { done: true }),
    ev(-1, "Climbing", "18:30", "20:00", "Health"),
    ev(-3, "Standup", "09:30", "09:45", "Work", { recur: "Daily", recurUntil: day(9) }),
    ev(0, "Lunch with Sam", "12:30", "13:30", "Social", { location: "Tartine" }),
    ev(0, "Gym", "18:00", "19:00", "Health"),
    task(0, "Reply to landlord", "medium"),
    task(0, "Water plants", "low", { recur: "Weekly" }),
    ev(1, "Design review", "14:00", "15:00", "Work", { desc: "Calendar redesign — bring screenshots" }),
    task(1, "Pay rent", "high"),
    ev(2, "Dentist", "10:00", "11:00", "Health"),
    ev(-4, "1:1 with Priya", "11:00", "11:30", "Work", { recur: "Weekly", recurInterval: 2 }),
    ev(5, "Dinner at Nonna's", "19:00", "21:00", "Social", { desc: "Bring dessert" }),
    ev(7, "Sprint planning", "10:00", "11:30", "Work"),
    ev(7, "Run club", "07:00", "08:00", "Health"),
    ev(10, "Flight to Denver", "07:15", "09:40", "Personal", { desc: "UA 1432 · Seat 14C" }),
    ev(1, "Road trip", "10:00", "11:00", "Personal", { endDate: day(3), location: "Big Sur" }),
    ev(2, "Red-eye home", "23:00", "01:00", "Personal", { endDate: day(3) }),
    allDay(11, "Conference", "Work", { endDate: day(12) }),
    allDay(4, "Sam's birthday", "Social", { recur: "Yearly" }),
    task(14, "Renew passport", "high"),
    ev(16, "Yoga", "08:00", "09:00", "Health"),
    ev(19, "Mom's birthday dinner", "18:30", "21:00", "Personal"),
  ];
  return events.map((e, i) => ({ ...e, id: `demo-${i + 1}` }));
}

/** In-memory backend used when Supabase isn't configured. Edits last until reload. */
export function createDemoBackend(): CalendarBackend {
  let events = seedEvents();
  let categories = DEMO_CATEGORIES.map((c) => ({ ...c }));
  const imported = new Set<string>();

  return {
    kind: "demo",
    async listEvents() {
      return events.map((e) => ({ ...e }));
    },
    async saveEvent(ev) {
      if (ev.id) events = events.map((e) => (e.id === ev.id ? { ...ev } : e));
      else events = [...events, { ...ev, id: crypto.randomUUID() }];
    },
    async deleteEvent(id) {
      events = events.filter((e) => e.id !== id);
    },
    async saveOccurrence(seriesId, occurrenceDate, override) {
      events = events.map((e) => {
        if (e.id !== seriesId) return e;
        const exceptions = { ...e.exceptions };
        if (override) exceptions[occurrenceDate] = override;
        else delete exceptions[occurrenceDate];
        return { ...e, exceptions };
      });
    },
    async importEvents(source, items) {
      let added = 0;
      for (const { event, externalId } of items) {
        const key = `${source}:${externalId}`;
        if (imported.has(key)) continue;
        imported.add(key);
        events = [...events, { ...event, id: crypto.randomUUID() }];
        added++;
      }
      return { added, skipped: items.length - added };
    },
    async listCategories() {
      return [...categories].sort((a, b) => a.sortOrder - b.sortOrder).map((c) => ({ ...c }));
    },
    async saveCategory(cat) {
      const saved = { ...cat, name: cat.name.trim(), id: cat.id || crypto.randomUUID() };
      categories = cat.id ? categories.map((c) => (c.id === cat.id ? saved : c)) : [...categories, saved];
      return { ...saved };
    },
    async deleteCategory(id) {
      categories = categories.filter((c) => c.id !== id);
      events = events.map((e) => (e.categoryId === id ? { ...e, categoryId: null } : e));
    },
  };
}
