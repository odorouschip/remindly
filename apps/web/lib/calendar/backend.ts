import type { CalEvent, Category } from "./types";

/**
 * Everything the calendar UI needs from storage. The UI only talks to this,
 * so moving off Supabase (e.g. to a self-hosted API) means adding a backend,
 * not touching components.
 */
export interface CalendarBackend {
  readonly kind: "supabase" | "demo";
  listEvents(): Promise<CalEvent[]>;
  /** Inserts when `ev.id` is empty, otherwise updates. */
  saveEvent(ev: CalEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;

  listCategories(): Promise<Category[]>;
  /** Inserts when `cat.id` is empty, otherwise updates. Returns the saved category. */
  saveCategory(cat: Category): Promise<Category>;
  /** Events in the category become uncategorized. */
  deleteCategory(id: string): Promise<void>;
}
