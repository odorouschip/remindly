import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type EventRow = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  is_all_day: boolean;
  repeat_frequency: "none" | "daily" | "weekly" | "monthly";
  repeat_until: string | null;
  is_archived: boolean;
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
  due_at: string;
  delivered_at: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      events: {
        Row: EventRow;
        Insert: Omit<EventRow, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<EventRow, "id" | "created_at" | "updated_at">>;
      };
      reminders: {
        Row: ReminderRow;
        Insert: Omit<ReminderRow, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<ReminderRow, "id" | "created_at">>;
      };
    };
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
