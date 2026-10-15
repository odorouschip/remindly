import type { CalendarBackend } from "./backend";
import { addDays, toIsoDate } from "./dates";
import type { CalEvent } from "./types";

/** Seed events dated relative to today so every view has something in it. */
function seedEvents(): CalEvent[] {
  const day = (offset: number) => toIsoDate(addDays(new Date(), offset));
  const ev = (offset: number, title: string, time: string, end: string, cat: CalEvent["cat"], extra: Partial<CalEvent> = {}): CalEvent => ({
    id: "", title, date: day(offset), time, end, allDay: false, cat, recur: "", recurUntil: "", isTask: false, desc: "", ...extra,
  });
  const allDay = (offset: number, title: string, cat: CalEvent["cat"], extra: Partial<CalEvent> = {}): CalEvent =>
    ev(offset, title, "", "", cat, { allDay: true, ...extra });
  const task = (offset: number, title: string, priority: CalEvent["priority"], extra: Partial<CalEvent> = {}): CalEvent => ({
    id: "", title: `${title} ✓`, date: day(offset), time: "", end: "", allDay: true, cat: "personal", recur: "", recurUntil: "", isTask: true,
    desc: "", remind: "1-day", priority, ...extra,
  });

  const events: CalEvent[] = [
    ev(-12, "Coffee with Jordan", "09:30", "10:15", "social"),
    ev(-9, "Quarterly review", "10:00", "11:30", "work"),
    ev(-26, "Book club", "19:00", "20:30", "social", { recur: "Monthly", desc: "Chapters 8–12" }),
    ev(-2, "Haircut", "16:00", "16:45", "personal"),
    ev(-1, "Climbing", "18:30", "20:00", "health"),
    ev(-3, "Standup", "09:30", "09:45", "work", { recur: "Daily", recurUntil: day(9) }),
    ev(0, "Lunch with Sam", "12:30", "13:30", "social"),
    ev(0, "Gym", "18:00", "19:00", "health"),
    task(0, "Reply to landlord", "medium"),
    ev(1, "Design review", "14:00", "15:00", "work", { desc: "Calendar redesign — bring screenshots" }),
    task(1, "Pay rent", "high"),
    ev(2, "Dentist", "10:00", "11:00", "health"),
    ev(-4, "1:1 with Priya", "11:00", "11:30", "work", { recur: "Weekly" }),
    ev(5, "Dinner at Nonna's", "19:00", "21:00", "social", { desc: "Bring dessert" }),
    ev(7, "Sprint planning", "10:00", "11:30", "work"),
    ev(7, "Run club", "07:00", "08:00", "health"),
    ev(10, "Flight to Denver", "07:15", "09:40", "personal", { desc: "UA 1432 · Seat 14C" }),
    allDay(11, "Conference day 1", "work"),
    allDay(12, "Conference day 2", "work"),
    allDay(4, "Sam's birthday", "social", { recur: "Yearly" }),
    task(14, "Renew passport", "high"),
    ev(16, "Yoga", "08:00", "09:00", "health"),
    ev(19, "Mom's birthday dinner", "18:30", "21:00", "personal"),
  ];
  return events.map((e, i) => ({ ...e, id: `demo-${i + 1}` }));
}

/** In-memory backend used when Supabase isn't configured. Edits last until reload. */
export function createDemoBackend(): CalendarBackend {
  let events = seedEvents();

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
  };
}
