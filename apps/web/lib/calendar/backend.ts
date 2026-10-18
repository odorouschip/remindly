import type { CalEvent, Category, OccurrenceOverride } from "./types";

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
  /**
   * Changes or skips one occurrence of a repeating event, identified by the
   * date it would normally fall on. Null puts it back to match the series.
   */
  saveOccurrence(seriesId: string, occurrenceDate: string, override: OccurrenceOverride | null): Promise<void>;
  /**
   * Adds events copied from somewhere else (e.g. Google Tasks). Ones already
   * imported from the same source and external id are skipped.
   */
  importEvents(source: string, items: readonly { event: CalEvent; externalId: string }[]): Promise<{ added: number; skipped: number }>;

  listCategories(): Promise<Category[]>;
  /** Inserts when `cat.id` is empty, otherwise updates. Returns the saved category. */
  saveCategory(cat: Category): Promise<Category>;
  /** Events in the category become uncategorized. */
  deleteCategory(id: string): Promise<void>;
}
