import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CategoryColor, Priority } from "@/lib/calendar/types";

// Row shapes for supabase/migrations/202610170001_schema_v2.sql. Only the
// tables the web app touches are typed here.

export type EventRow = {
  id: string;
  user_id: string;
  kind: "event" | "task";
  title: string;
  notes: string;
  location: string;
  category_id: string | null;
  all_day: boolean;
  starts_at: string | null;
  ends_at: string | null;
  start_date: string | null;
  end_date: string | null;
  timezone: string;
  repeat_freq: "daily" | "weekly" | "monthly" | "yearly" | null;
  repeat_interval: number;
  repeat_until: string | null;
  priority: Priority | null;
  completed_at: string | null;
  source: string;
  external_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReminderRow = {
  id: string;
  event_id: string;
  user_id: string;
  offset_minutes: number;
  channel: "live_activity" | "notification";
  next_due_at: string | null;
  next_occurrence_date: string | null;
  created_at: string;
};

export type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  color: CategoryColor;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type Table<Row, Required extends keyof Row, Generated extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required | Generated>>;
  Update: Partial<Omit<Row, Generated>>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      events: Table<EventRow, "title", "id" | "user_id" | "created_at" | "updated_at">;
      reminders: Table<ReminderRow, "event_id" | "offset_minutes", "id" | "user_id" | "created_at" | "next_due_at" | "next_occurrence_date">;
      categories: Table<CategoryRow, "name", "id" | "user_id" | "created_at" | "updated_at">;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let client: SupabaseClient<Database> | null = null;

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase environment variables are missing.");
  }

  client ??= createClient<Database>(supabaseUrl, supabaseAnonKey);
  return client;
}
