"use client";

import { CalendarDays, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  REMINDER_PRESETS_MINUTES,
  reminderDueAt,
  type RepeatFrequency,
} from "@calender/shared";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  type EventRow,
  type ReminderRow,
} from "@/lib/supabase/client";

// ─── DESIGN MODEL ─────────────────────────────────────────────────────────────
type CategoryId = "work" | "personal" | "health" | "social";
type Priority = "low" | "medium" | "high";
type RemindKey = "at-time" | "30-min" | "1-day" | "1-week" | "2-weeks" | "custom";
type RecurLabel = "" | "Daily" | "Weekly" | "Monthly" | "Yearly";

type DesignEvent = {
  id: string;
  title: string;
  date: string;          // YYYY-MM-DD (local)
  time: string;          // HH:MM (local), '' for tasks
  end: string;           // HH:MM (local), '' for tasks
  cat: CategoryId;
  recur: RecurLabel;
  isTask: boolean;
  desc: string;
  remind?: RemindKey | undefined;
  priority?: Priority | undefined;
};

type EventWithReminders = EventRow & { reminders: ReminderRow[] };

type AuthMode = "sign-in" | "sign-up";

// ─── DATA / CONSTANTS ─────────────────────────────────────────────────────────
type Category = { id: CategoryId; label: string; color: string };
const CATS: readonly [Category, Category, Category, Category] = [
  { id: "work",     label: "Work",     color: "#5046E5" },
  { id: "personal", label: "Personal", color: "#E85D3A" },
  { id: "health",   label: "Health",   color: "#2DA87E" },
  { id: "social",   label: "Social",   color: "#C47EDB" },
];
const getCat = (id: CategoryId): Category => CATS.find((c) => c.id === id) ?? CATS[0];

const MONTHS: readonly string[] = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS3: readonly string[]  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const monthName = (m: number): string => MONTHS[m] ?? "";
const dayShort  = (i: number): string => DAYS3[i] ?? "";

const META_SENTINEL = "\n\n%%META%%";

const REMIND_TO_MIN: Record<Exclude<RemindKey, "custom">, number> = {
  "at-time": 0,
  "30-min": 30,
  "1-day": 1440,
  "1-week": 10080,
  "2-weeks": 20160,
};

const RECUR_TO_DB: Record<RecurLabel, RepeatFrequency> = {
  "":        "none",
  "Daily":   "daily",
  "Weekly":  "weekly",
  "Monthly": "monthly",
  "Yearly":  "none", // Yearly is preserved in meta only
};

const ACCENTS = [
  { name: "Coral",      color: "#E85D3A" },
  { name: "Terracotta", color: "#C4472A" },
  { name: "Peach",      color: "#F4845F" },
  { name: "Blush",      color: "#F0A896" },
  { name: "Rust",       color: "#A63D2F" },
  { name: "Indigo",     color: "#5046E5" },
  { name: "Plum",       color: "#9B5DE5" },
  { name: "Forest",     color: "#2DA87E" },
  { name: "Ocean",      color: "#0EA5E9" },
  { name: "Amber",      color: "#D97706" },
];

const todayLocalIso = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
})();

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function p2(n: number): string { return String(n).padStart(2, "0"); }
function fmtDate(d: Date): string { return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`; }
function parseDate(s: string): Date {
  const parts = s.split("-").map(Number) as [number, number, number];
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
function daysInMonth(y: number, m: number): number { return new Date(y, m + 1, 0).getDate(); }
function firstDow(y: number, m: number): number { return new Date(y, m, 1).getDay(); }
function fmtTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number) as [number, number];
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${p2(m)} ${ap}`;
}
function darken(hex: string, amt = 30): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, r - amt); g = Math.max(0, g - amt); b = Math.max(0, b - amt);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Build an ISO timestamp for a local YYYY-MM-DD HH:MM combo
function localDateTimeToIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = (time || "09:00").split(":").map(Number) as [number, number];
  return new Date(y, m - 1, d, h, mi, 0, 0).toISOString();
}

// Reverse: from ISO → local date + time
function isoToLocalParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`,
    time: `${p2(d.getHours())}:${p2(d.getMinutes())}`,
  };
}

// Pack/unpack design-only metadata into the notes column
function packNotes(desc: string, meta: Record<string, unknown>): string {
  const trimmed = desc.trim();
  return `${trimmed}${META_SENTINEL}${JSON.stringify(meta)}`;
}
function unpackNotes(notes: string | null): { desc: string; meta: Record<string, unknown> } {
  if (!notes) return { desc: "", meta: {} };
  const idx = notes.indexOf(META_SENTINEL);
  if (idx < 0) return { desc: notes, meta: {} };
  try {
    const meta = JSON.parse(notes.slice(idx + META_SENTINEL.length)) as Record<string, unknown>;
    return { desc: notes.slice(0, idx), meta };
  } catch {
    return { desc: notes, meta: {} };
  }
}

function rowToDesign(row: EventWithReminders): DesignEvent {
  const { desc, meta } = unpackNotes(row.notes);
  const start = isoToLocalParts(row.starts_at);
  const end = isoToLocalParts(row.ends_at);
  const isTask = Boolean(meta.isTask);
  const recurFromMeta = (meta.recur as RecurLabel | undefined) ?? "";
  const recur: RecurLabel = recurFromMeta || (
    row.repeat_frequency === "daily"   ? "Daily"
    : row.repeat_frequency === "weekly"  ? "Weekly"
    : row.repeat_frequency === "monthly" ? "Monthly"
    : ""
  );
  return {
    id: row.id,
    title: row.title,
    date: start.date,
    time: isTask ? "" : start.time,
    end: isTask ? "" : end.time,
    cat: ((meta.cat as CategoryId | undefined) ?? "work"),
    recur,
    isTask,
    desc,
    remind: meta.remind as RemindKey | undefined,
    priority: meta.priority as Priority | undefined,
  };
}

// ─── ROOT COMPONENT (auth + supabase + design) ────────────────────────────────
export function CalendarApp() {
  const supabase = useMemo(() => (isSupabaseConfigured ? getSupabaseBrowserClient() : null), []);

  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventWithReminders[]>([]);
  const [status, setStatus] = useState("Ready to build your day.");
  const [isAuthWorking, setIsAuthWorking] = useState(false);
  const [accent, setAccent] = useState<string>("#F4845F");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id ?? null;
      setUserId(id);
      if (id) void loadEvents(id);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      setUserId(id);
      if (id) void loadEvents(id);
      else setEvents([]);
    });
    return () => subscription.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function loadEvents(currentUserId: string | null = userId) {
    if (!supabase || !currentUserId) return;
    const { data, error } = await supabase
      .from("events")
      .select("*, reminders(*)")
      .eq("user_id", currentUserId)
      .is("deleted_at", null)
      .order("starts_at", { ascending: true });
    if (error) { setStatus(error.message); return; }
    setEvents((data ?? []) as EventWithReminders[]);
  }

  async function handleAuth() {
    if (!supabase) return;
    setIsAuthWorking(true);
    setStatus(authMode === "sign-in" ? "Signing in…" : "Creating account…");
    try {
      const call = authMode === "sign-in"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
      const { data, error } = await call;
      if (error) { setStatus(error.message); return; }
      const id = data.session?.user.id ?? null;
      setUserId(id);
      if (!data.session) { setStatus("Account created. Confirm your email, then sign in."); return; }
      setStatus(authMode === "sign-up" ? "Account created and signed in." : "Signed in.");
      await loadEvents(id);
    } finally {
      setIsAuthWorking(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUserId(null);
    setEvents([]);
  }

  async function saveDesignEvent(ev: DesignEvent) {
    if (!supabase || !userId) { setStatus("Sign in before saving."); return; }
    const startsAtIso = localDateTimeToIso(ev.date, ev.isTask ? "09:00" : ev.time || "09:00");
    const endsAtIso   = localDateTimeToIso(ev.date, ev.isTask ? "09:30" : ev.end  || "10:00");
    const meta = {
      cat: ev.cat,
      isTask: ev.isTask,
      ...(ev.priority ? { priority: ev.priority } : {}),
      ...(ev.remind   ? { remind: ev.remind } : {}),
      ...(ev.recur === "Yearly" ? { recur: "Yearly" } : {}),
    };
    const payload = {
      user_id: userId,
      title: ev.title.trim() || (ev.isTask ? "Untitled task" : "Untitled event"),
      notes: packNotes(ev.desc, meta),
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      is_all_day: ev.isTask,
      repeat_frequency: RECUR_TO_DB[ev.recur],
      repeat_until: null,
      is_archived: false,
      deleted_at: null,
    };

    // Determine update vs insert
    const existing = events.find((e) => e.id === ev.id);
    const { data: saved, error } = existing
      ? await supabase.from("events").update(payload).eq("id", existing.id).select("*").single()
      : await supabase.from("events").insert(payload).select("*").single();
    if (error || !saved) { setStatus(error?.message ?? "Could not save."); return; }

    // Reset reminders for this event
    await supabase.from("reminders").delete().eq("event_id", saved.id);

    // Compute reminder offsets
    const offsets: number[] = ev.isTask
      ? (ev.remind && ev.remind !== "custom" ? [REMIND_TO_MIN[ev.remind]] : [])
      : [...REMINDER_PRESETS_MINUTES];
    if (offsets.length > 0) {
      const rows = offsets.map((offset) => ({
        event_id: saved.id,
        user_id: userId,
        offset_minutes: offset,
        channel: "live_activity" as const,
        due_at: reminderDueAt(startsAtIso, offset),
        delivered_at: null,
      }));
      await supabase.from("reminders").insert(rows);
    }

    await loadEvents(userId);
    setStatus("Saved.");
  }

  async function deleteDesignEvent(id: string) {
    if (!supabase || !userId) return;
    await supabase.from("events").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    await loadEvents(userId);
  }

  // ── Render branches
  if (!isSupabaseConfigured) {
    return (
      <main className="shell setup-shell">
        <section className="setup-panel">
          <CalendarDays aria-hidden />
          <h1>Connect Supabase to start Calender</h1>
          <p>Add the values from your Supabase project to <code>apps/web/.env.local</code>, then restart the web app.</p>
          <pre>{`NEXT_PUBLIC_SUPABASE_URL=...\nNEXT_PUBLIC_SUPABASE_ANON_KEY=...`}</pre>
        </section>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="auth-screen">
        <section className="auth-copy">
          <div className="brand-lockup">
            <CalendarDays aria-hidden />
            <span>Remindly</span>
          </div>
          <h1>Calendar reminders that stay visible when they matter.</h1>
          <p>Sync events across web and iPhone, then let Live Activities handle the hard-to-miss countdown.</p>
        </section>
        <form
          className="auth-form"
          onSubmit={(event) => { event.preventDefault(); void handleAuth(); }}
        >
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
              autoComplete={authMode === "sign-in" ? "current-password" : "new-password"} required />
          </label>
          <button type="submit" disabled={isAuthWorking}>
            <Check aria-hidden />
            {isAuthWorking ? "Working" : authMode === "sign-in" ? "Sign in" : "Create account"}
          </button>
          <button type="button" className="text-button"
            onClick={() => setAuthMode(authMode === "sign-in" ? "sign-up" : "sign-in")}>
            {authMode === "sign-in" ? "Need an account?" : "Already have one?"}
          </button>
          <p className="status-line">{status}</p>
        </form>
      </main>
    );
  }

  const designEvents = events.map(rowToDesign);

  return (
    <div style={{position:"fixed",inset:0,width:"100vw",height:"100vh",background:"#FAFAF9",fontFamily:"'DM Sans', sans-serif",color:"#1A1714"}}>
      <WebCalendar
        accent={accent}
        setAccent={setAccent}
        events={designEvents}
        onSave={saveDesignEvent}
        onDelete={deleteDesignEvent}
        onSignOut={handleSignOut}
      />
    </div>
  );
}

// ─── WEB CALENDAR ─────────────────────────────────────────────────────────────
type WebCalendarProps = {
  accent: string;
  setAccent: (c: string) => void;
  events: DesignEvent[];
  onSave: (ev: DesignEvent) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
};

function WebCalendar({ accent, setAccent, events, onSave, onDelete, onSignOut }: WebCalendarProps) {
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth());
  const [gridView, setGridView] = useState<"month" | "week" | null>("month");
  const [agendaOpen, setAgendaOpen] = useState<boolean>(false);
  const [selDate, setSelDate] = useState<string | null>(todayLocalIso);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editEv, setEditEv] = useState<DesignEvent | null>(null);
  const [showTweaks, setShowTweaks] = useState(false);

  const openEdit = (ev: DesignEvent) => { setEditEv(ev); setCreateOpen(true); };
  const openNew  = (date?: string | null) => { setEditEv(null); setCreateOpen(true); if (date) setSelDate(date); };
  const closePanel = () => { setCreateOpen(false); setEditEv(null); };
  const deselect = () => setSelDate(null);
  const toggleGrid = (v: "month" | "week") => setGridView((g) => (g === v ? null : v));
  const agendaOnly = agendaOpen && gridView === null;
  const showRightAgenda = agendaOpen && !agendaOnly && !createOpen;

  const navMonth = (d: number) => {
    let m = month + d, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  const filtered = search
    ? events.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
    : events;

  return (
    <div style={{display:"flex",height:"100%",background:"#FAFAF9",overflow:"hidden"}}>
      {/* Sidebar */}
      <aside style={{width:220,flexShrink:0,borderRight:"1px solid #E5E2DD",display:"flex",flexDirection:"column",padding:"20px 16px",gap:16,background:"#FBF9F7",position:"relative"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:4}}>
          <div style={{width:28,height:28,borderRadius:8,background:accent,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="3" width="12" height="10" rx="2" stroke="white" strokeWidth="1.4"/>
              <path d="M1 6h12" stroke="white" strokeWidth="1.4"/>
              <path d="M4 1v3M10 1v3" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{fontWeight:700,fontSize:15,color:"#1A1714",letterSpacing:"-0.02em",flex:1}}>Remindly</span>
          <button onClick={() => setShowTweaks((s) => !s)}
            title="Tweak accent color"
            style={{background:"none",border:"none",cursor:"pointer",color:"#b0ada8",fontSize:14,padding:2}}>⚙</button>
        </div>

        <div style={{position:"relative"}}>
          <svg style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",opacity:0.4}} width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="#1A1714" strokeWidth="1.4"/>
            <path d="M9 9l2.5 2.5" stroke="#1A1714" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
            style={{width:"100%",padding:"7px 8px 7px 26px",borderRadius:7,border:"1px solid #E5E2DD",fontSize:12,background:"#F3F0EC",color:"#1A1714",outline:"none"}}/>
        </div>

        <WebMiniCal year={year} month={month} selDate={selDate}
          onNav={navMonth}
          onSelect={(d) => { setSelDate(d); if (gridView === null) setGridView("month"); }}
          events={filtered} accent={accent}/>

        <WebSidebarAgenda events={filtered} onClickEvent={openEdit}/>

        <WebCategoriesDropdown/>

        <button onClick={() => void onSignOut()}
          style={{marginTop:"auto",padding:"7px 10px",borderRadius:7,border:"1px solid #E5E2DD",background:"transparent",color:"#8a8580",fontSize:11,fontWeight:600,cursor:"pointer"}}>
          Sign out
        </button>
      </aside>

      {/* Main + right panels */}
      <div style={{flex:1,display:"flex",minWidth:0,overflow:"hidden",position:"relative"}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,overflow:"hidden",transition:"all 0.3s ease"}}
          onClick={(e) => { if (gridView !== "month" && !(e.target as HTMLElement).closest("[data-cal-cell]")) deselect(); }}>
          {/* Topbar */}
          <div onClick={(e) => { e.stopPropagation(); deselect(); }}
            style={{display:"flex",alignItems:"center",padding:"14px 24px",borderBottom:"1px solid #E5E2DD",gap:16,flexShrink:0,background:"#FAF8F6"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={() => navMonth(-1)} style={{background:"none",border:"1px solid #E5E2DD",borderRadius:6,padding:"4px 9px",cursor:"pointer",fontSize:13,color:"#4a4744"}}>‹</button>
              <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelDate(todayLocalIso); }}
                style={{background:"none",border:"1px solid #E5E2DD",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:500,color:"#4a4744"}}>Today</button>
              <button onClick={() => navMonth(1)} style={{background:"none",border:"1px solid #E5E2DD",borderRadius:6,padding:"4px 9px",cursor:"pointer",fontSize:13,color:"#4a4744"}}>›</button>
            </div>
            <h2 style={{fontSize:17,fontWeight:600,letterSpacing:"-0.02em",flex:1,margin:0}}>{monthName(month)} {year}</h2>
            <HoverButton accent={accent} blushRest onClick={() => openNew()}
              style={{padding:"6px 14px",borderRadius:7,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:15,lineHeight:1}}>+</span> New
            </HoverButton>
            <div style={{display:"flex",background:"#F0EDE9",borderRadius:8,padding:3,gap:2}}>
              {(["month","week"] as const).map((v) => (
                <button key={v} onClick={() => toggleGrid(v)} style={{
                  padding:"4px 12px",borderRadius:6,border:"none",fontSize:12,fontWeight:500,cursor:"pointer",
                  background:gridView===v?"#fff":"transparent",
                  color:gridView===v?"#1A1714":"#8a8580",
                  boxShadow:gridView===v?"0 1px 3px rgba(0,0,0,0.1)":"none",
                  transition:"all 0.15s",textTransform:"capitalize",
                }}>{v}</button>
              ))}
              <button onClick={() => setAgendaOpen((o) => !o)} style={{
                padding:"4px 12px",borderRadius:6,border:"none",fontSize:12,fontWeight:500,cursor:"pointer",
                background:agendaOpen?"#fff":"transparent",
                color:agendaOpen?"#1A1714":"#8a8580",
                boxShadow:agendaOpen?"0 1px 3px rgba(0,0,0,0.1)":"none",
                transition:"all 0.15s",textTransform:"capitalize",
              }}>agenda</button>
            </div>
          </div>

          {/* View content */}
          {gridView === "month" && (
            <WebMonthView year={year} month={month} events={filtered} selDate={selDate}
              onSelect={(d) => setSelDate(d)} onDeselect={deselect}
              onDoubleClickDay={(d) => openNew(d)} onClickEvent={openEdit} accent={accent}/>
          )}
          {gridView === "week" && (
            <WebWeekView selDate={selDate} events={filtered} onClickEvent={openEdit} accent={accent}/>
          )}
          {agendaOnly && (
            <WebAgendaView events={filtered} onClickEvent={openEdit} accent={accent}/>
          )}
          {gridView === null && !agendaOpen && (
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="2" y="5" width="28" height="24" rx="4" stroke="#d1cec9" strokeWidth="1.5"/>
                <path d="M2 11h28" stroke="#d1cec9" strokeWidth="1.5"/>
                <path d="M8 3v4M24 3v4" stroke="#d1cec9" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 17h10M8 22h6" stroke="#d1cec9" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span style={{fontSize:12,color:"#c8c4be"}}>Pick a view above</span>
            </div>
          )}
        </div>

        <WebAgendaPanel open={showRightAgenda} events={filtered} onClickEvent={openEdit} accent={accent}/>
        <WebCreatePanel accent={accent} defaultDate={selDate || todayLocalIso} open={createOpen} editEv={editEv}
          onClose={closePanel}
          onSave={(ev) => { void onSave(ev); closePanel(); }}
          onDelete={(id) => { void onDelete(id); closePanel(); }}/>
      </div>

      {showTweaks && (
        <div style={{position:"fixed",bottom:20,right:20,background:"#1c1c1e",borderRadius:16,padding:20,width:280,boxShadow:"0 8px 32px rgba(0,0,0,.5)",border:"1px solid #333",zIndex:1000}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <span style={{fontWeight:700,fontSize:14,color:"#fff"}}>Tweaks</span>
            <button onClick={() => setShowTweaks(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#666",fontSize:18,lineHeight:1}}>×</button>
          </div>
          <div style={{fontSize:11,fontWeight:600,color:"#555",letterSpacing:".08em",marginBottom:10}}>ACCENT COLOR</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
            {ACCENTS.map((a) => (
              <div key={a.name} onClick={() => setAccent(a.color)}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer"}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:a.color,boxShadow:accent===a.color?`0 0 0 2px #1c1c1e, 0 0 0 4px ${a.color}`:"none",transition:"box-shadow 0.15s"}}/>
                <span style={{fontSize:9,color:"#666",textAlign:"center"}}>{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HOVER BUTTON ─────────────────────────────────────────────────────────────
function HoverButton({ accent, onClick, children, style = {}, blushRest = false }: {
  accent: string; onClick?: () => void; children: ReactNode; style?: CSSProperties; blushRest?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const restBg = blushRest ? "#F0A896" : accent;
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        ...style,
        background: hov ? darken(accent, 22) : restBg,
        color: "#fff",
        transition: "background 0.18s, box-shadow 0.18s",
      }}>{children}</button>
  );
}

// ─── SIDEBAR MINI AGENDA ──────────────────────────────────────────────────────
function WebSidebarAgenda({ events, onClickEvent }: {
  events: DesignEvent[]; onClickEvent: (ev: DesignEvent) => void;
}) {
  const upcoming = [...events]
    .filter((e) => e.date >= todayLocalIso)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 5);
  return (
    <div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column"}}>
      <div style={{fontSize:10,fontWeight:600,color:"#b0ada8",letterSpacing:".08em",marginBottom:8}}>UPCOMING</div>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
        {upcoming.length === 0 && <div style={{fontSize:11,color:"#c8c4be",padding:"6px 0"}}>Nothing coming up</div>}
        {upcoming.map((ev) => {
          const c = getCat(ev.cat);
          const d = parseDate(ev.date);
          const isToday = ev.date === todayLocalIso;
          return (
            <div key={ev.id} onClick={() => onClickEvent(ev)} style={{
              display:"flex",gap:8,alignItems:"center",padding:"6px 8px",borderRadius:7,cursor:"pointer",
              background:"rgba(0,0,0,0.03)",transition:"background 0.1s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.07)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}>
              <div style={{width:3,height:28,borderRadius:2,background:c.color,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,color:"#1A1714",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.title}</div>
                <div style={{fontSize:10,color:"#b0ada8"}}>{isToday ? "Today" : d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}{ev.time && ` · ${fmtTime(ev.time)}`}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CATEGORIES DROPDOWN ──────────────────────────────────────────────────────
function WebCategoriesDropdown() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{borderTop:"1px solid #E5E2DD",paddingTop:12}}>
      <div onClick={() => setOpen((o) => !o)} style={{
        display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",marginBottom:open?8:0,
      }}>
        <span style={{fontSize:10,fontWeight:600,color:"#b0ada8",letterSpacing:".08em"}}>CATEGORIES</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{transform:open?"rotate(180deg)":"none",transition:"transform 0.2s"}}>
          <path d="M2 3.5l3 3 3-3" stroke="#b0ada8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {open && (
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {CATS.map((c) => (
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"3px 0"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:c.color,flexShrink:0}}/>
              <span style={{fontSize:12,color:"#4a4744"}}>{c.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AGENDA RIGHT PANEL ───────────────────────────────────────────────────────
function WebAgendaPanel({ open, events, onClickEvent, accent }: {
  open: boolean; events: DesignEvent[]; onClickEvent: (ev: DesignEvent) => void; accent: string;
}) {
  const upcoming = [...events]
    .filter((e) => e.date >= todayLocalIso)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  const grouped: Record<string, DesignEvent[]> = {};
  upcoming.forEach((e) => { (grouped[e.date] ||= []).push(e); });

  return (
    <div style={{
      width: open ? 300 : 0, flexShrink:0, overflow:"hidden",
      transition:"width 0.3s cubic-bezier(0.4,0,0.2,1)",
      borderLeft: open ? "1px solid #E5E2DD" : "none",
      background:"#FAF8F5", display:"flex", flexDirection:"column",
    }}>
      <div style={{width:300,height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"16px 18px 12px",flexShrink:0,borderBottom:"1px solid #E5E2DD"}}>
          <span style={{fontWeight:700,fontSize:15,color:"#1A1714",letterSpacing:"-0.02em"}}>Upcoming</span>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"8px 14px 18px"}}>
          {upcoming.length === 0 && <div style={{padding:"30px 0",textAlign:"center",color:"#b0ada8",fontSize:13}}>Nothing upcoming</div>}
          {Object.entries(grouped).map(([date, evs]) => {
            const d = parseDate(date);
            const isToday = date === todayLocalIso;
            return (
              <div key={date} style={{marginTop:14}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
                  <span style={{fontSize:11,fontWeight:700,color:isToday?accent:"#8a8580",whiteSpace:"nowrap"}}>
                    {isToday ? "Today" : d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
                  </span>
                  {isToday && <span style={{fontSize:9,background:accent+"22",color:accent,borderRadius:99,padding:"1px 6px",fontWeight:700,letterSpacing:".04em"}}>TODAY</span>}
                  <div style={{flex:1,height:1,background:"#E5E2DD"}}/>
                </div>
                {evs.map((ev) => {
                  const c = getCat(ev.cat);
                  return (
                    <div key={ev.id} onClick={() => onClickEvent(ev)} style={{
                      display:"flex",gap:9,alignItems:"flex-start",padding:"8px 10px",borderRadius:8,marginBottom:5,cursor:"pointer",
                      background:"#fff",border:"1px solid #EAE6E1",transition:"border-color 0.15s",
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = accent + "66")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#EAE6E1")}>
                      <div style={{width:3,alignSelf:"stretch",borderRadius:2,background:c.color,flexShrink:0,minHeight:22}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:"#1A1714",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.title}</div>
                        {ev.time && <div style={{fontSize:10,color:"#8a8580",marginTop:1}}>{fmtTime(ev.time)}{ev.end ? " – " + fmtTime(ev.end) : ""}</div>}
                        {ev.desc && <div style={{fontSize:10,color:"#b0ada8",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.desc}</div>}
                      </div>
                      <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                        <span style={{fontSize:9,background:c.color+"18",color:c.color,borderRadius:4,padding:"2px 5px",fontWeight:600}}>{c.label}</span>
                        {ev.isTask && <span style={{fontSize:9,color:"#c8c4be"}}>task</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── CREATE / EDIT PANEL ──────────────────────────────────────────────────────
function WebCreatePanel({ accent, defaultDate, open, editEv, onClose, onSave, onDelete }: {
  accent: string; defaultDate: string; open: boolean; editEv: DesignEvent | null;
  onClose: () => void; onSave: (ev: DesignEvent) => void; onDelete: (id: string) => void;
}) {
  const isEdit = !!editEv?.id;

  const [tab, setTab] = useState<"task" | "event">("task");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [cat, setCat] = useState<CategoryId>("work");
  const [recur, setRecur] = useState<RecurLabel>("");
  const [taskTitle, setTaskTitle] = useState("");
  const [dueDate, setDueDate] = useState(defaultDate);
  const [remind, setRemind] = useState<RemindKey>("1-day");
  const [priority, setPriority] = useState<Priority>("medium");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (open && editEv?.id) {
      const t: "task" | "event" = editEv.isTask ? "task" : "event";
      setTab(t);
      if (t === "event") {
        setTitle(editEv.title || "");
        setDate(editEv.date || defaultDate);
        setTime(editEv.time || "09:00");
        setEnd(editEv.end || "10:00");
        setCat(editEv.cat || "work");
        setRecur(editEv.recur || "");
        setDesc(editEv.desc || "");
      } else {
        setTaskTitle(editEv.title?.replace(" ✓", "") || "");
        setDueDate(editEv.date || defaultDate);
        setRemind(editEv.remind || "1-day");
        setPriority(editEv.priority || "medium");
        setDesc(editEv.desc || "");
      }
    } else if (open && !editEv?.id) {
      setTitle(""); setTaskTitle(""); setTab("task"); setDesc("");
      setDate(defaultDate); setDueDate(defaultDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editEv?.id]);

  const inputSt: CSSProperties = {width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid #E5E2DD",fontSize:13,color:"#1A1714",outline:"none",background:"#F3F0EC"};
  const labelSt: CSSProperties = {fontSize:10,fontWeight:600,color:"#8a8580",letterSpacing:".06em",display:"block",marginBottom:5};

  const handleSave = () => {
    if (tab === "event") {
      if (!title.trim()) return;
      onSave({ id: editEv?.id || "", title: title.trim(), date, time, end, cat, recur, isTask: false, desc });
    } else {
      const t = taskTitle.replace(" ✓", "").trim();
      if (!t) return;
      onSave({ id: editEv?.id || "", title: t + " ✓", date: dueDate, time: "", end: "", cat: "personal", recur: "", isTask: true, desc, remind, priority });
    }
  };

  return (
    <div style={{
      width: open ? 300 : 0, flexShrink:0, overflow:"hidden",
      transition:"width 0.3s cubic-bezier(0.4,0,0.2,1)",
      borderLeft: open ? "1px solid #E5E2DD" : "none",
      background:"#FAF8F5", display:"flex", flexDirection:"column", position:"relative",
    }}>
      <div style={{width:300,height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"16px 18px 0",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <span style={{fontWeight:700,fontSize:15,color:"#1A1714",letterSpacing:"-0.02em"}}>
              {isEdit ? (tab === "task" ? "Edit Task" : "Edit Event") : (tab === "task" ? "New Task" : "New Event")}
            </span>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#b0ada8",lineHeight:1,padding:2}}>×</button>
          </div>
          <div style={{display:"flex",background:"#F0EDE9",borderRadius:8,padding:3,gap:2,marginBottom:16}}>
            {(["task","event"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex:1,padding:"5px 0",borderRadius:6,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",
                background:tab===t?"#fff":"transparent",
                color:tab===t?accent:"#8a8580",
                boxShadow:tab===t?"0 1px 3px rgba(0,0,0,0.1)":"none",
                transition:"all 0.15s",textTransform:"capitalize",
              }}>{t === "task" ? "Task" : "Event"}</button>
            ))}
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"0 18px 18px"}}>
          {tab === "event" && (
            <div style={{display:"flex",flexDirection:"column",gap:13}}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event name…"
                style={{...inputSt,fontSize:14,fontWeight:500}} autoFocus/>
              <div><label style={labelSt}>DATE</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputSt}/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div><label style={labelSt}>START</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputSt}/></div>
                <div><label style={labelSt}>END</label><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={inputSt}/></div>
              </div>
              <div><label style={labelSt}>CATEGORY</label>
                <select value={cat} onChange={(e) => setCat(e.target.value as CategoryId)} style={{...inputSt,cursor:"pointer"}}>
                  {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div><label style={labelSt}>REPEAT</label>
                <select value={recur} onChange={(e) => setRecur(e.target.value as RecurLabel)} style={{...inputSt,cursor:"pointer"}}>
                  {(["","Daily","Weekly","Monthly","Yearly"] as const).map((r) => <option key={r} value={r}>{r || "Does not repeat"}</option>)}
                </select>
              </div>
              <div style={{display:"flex",gap:5,marginTop:2}}>
                {CATS.map((c) => (
                  <div key={c.id} onClick={() => setCat(c.id)} style={{
                    flex:1,height:5,borderRadius:99,background:c.color,opacity:cat===c.id?1:0.2,cursor:"pointer",transition:"opacity 0.15s",
                  }}/>
                ))}
              </div>
              <div>
                <label style={labelSt}>NOTES</label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Add a description…"
                  style={{...inputSt,resize:"none",height:68,lineHeight:"1.5"}}/>
              </div>
            </div>
          )}
          {tab === "task" && (
            <div style={{display:"flex",flexDirection:"column",gap:13}}>
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task name…"
                style={{...inputSt,fontSize:14,fontWeight:500}} autoFocus/>
              <div><label style={labelSt}>DUE DATE</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputSt}/></div>
              <div>
                <label style={labelSt}>REMIND ME</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                  {([
                    {v:"at-time" as const, l:"At due time"},
                    {v:"30-min" as const,  l:"30 min before"},
                    {v:"1-day" as const,   l:"1 day before"},
                    {v:"1-week" as const,  l:"1 week before"},
                    {v:"2-weeks" as const, l:"2 weeks before"},
                    {v:"custom" as const,  l:"Custom…"},
                  ]).map((r) => (
                    <div key={r.v} onClick={() => setRemind(r.v)} style={{
                      padding:"7px 6px",borderRadius:7,cursor:"pointer",fontSize:11,fontWeight:500,textAlign:"center",
                      background:remind===r.v?accent:"#F3F0EC",
                      color:remind===r.v?"#fff":"#4a4744",
                      border:`1px solid ${remind===r.v?accent:"#E5E2DD"}`,
                      transition:"all 0.15s",
                    }}>{r.l}</div>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelSt}>PRIORITY</label>
                <div style={{display:"flex",gap:6}}>
                  {([
                    {v:"low" as const,    l:"Low",    c:"#2DA87E"},
                    {v:"medium" as const, l:"Medium", c:"#D97706"},
                    {v:"high" as const,   l:"High",   c:"#E85D3A"},
                  ]).map((p) => (
                    <div key={p.v} onClick={() => setPriority(p.v)} style={{
                      flex:1,padding:"8px 0",textAlign:"center",borderRadius:7,cursor:"pointer",
                      fontSize:11,fontWeight:600,
                      background:priority===p.v?p.c:"transparent",
                      color:priority===p.v?"#fff":p.c,
                      border:`1px solid ${p.c}55`,
                      transition:"all 0.15s",
                    }}>{p.l}</div>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelSt}>NOTES</label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Add a note…"
                  style={{...inputSt,resize:"none",height:68,lineHeight:"1.5"}}/>
              </div>
            </div>
          )}
        </div>

        <div style={{padding:"12px 18px 16px",borderTop:"1px solid #E5E2DD",display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose}
              style={{flex:1,padding:"9px 0",borderRadius:8,border:"1px solid #E5E2DD",background:"transparent",color:"#4a4744",fontSize:13,fontWeight:500,cursor:"pointer"}}>
              Cancel
            </button>
            <HoverButton onClick={handleSave} accent={accent}
              style={{flex:2,padding:"9px 0",borderRadius:8,border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>
              {isEdit ? "Save Changes" : (tab === "task" ? "Add Task" : "Create Event")}
            </HoverButton>
          </div>
          {isEdit && editEv && (
            <button onClick={() => onDelete(editEv.id)}
              style={{width:"100%",padding:"8px 0",borderRadius:8,border:"1px solid #fecaca",background:"#fff5f5",color:"#E85D3A",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              Delete {tab === "task" ? "Task" : "Event"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MINI CALENDAR ────────────────────────────────────────────────────────────
function WebMiniCal({ year, month, selDate, onNav, onSelect, events, accent }: {
  year: number; month: number; selDate: string | null;
  onNav: (d: number) => void; onSelect: (ds: string) => void;
  events: DesignEvent[]; accent: string;
}) {
  const first = firstDow(year, month);
  const days = daysInMonth(year, month);
  const dotMap: Record<string, "task" | "event"> = {};
  events.forEach((e) => {
    if (!dotMap[e.date]) dotMap[e.date] = e.isTask ? "task" : "event";
    else if (!e.isTask) dotMap[e.date] = "event";
  });
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({length:days}, (_, i) => i + 1)];

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <button onClick={() => onNav(-1)} style={{background:"none",border:"none",cursor:"pointer",fontSize:15,color:"#8a8580",lineHeight:1,padding:"2px 5px"}}>‹</button>
        <span style={{fontSize:11,fontWeight:600,color:"#1A1714",letterSpacing:".04em"}}>{monthName(month).slice(0,3).toUpperCase()} {year}</span>
        <button onClick={() => onNav(1)} style={{background:"none",border:"none",cursor:"pointer",fontSize:15,color:"#8a8580",lineHeight:1,padding:"2px 5px"}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,textAlign:"center"}}>
        {DAYS3.map((d) => <div key={d} style={{fontSize:9,color:"#b0ada8",fontWeight:600,padding:"2px 0"}}>{d[0]}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i}/>;
          const ds = `${year}-${p2(month+1)}-${p2(d)}`;
          const isSel = ds === selDate, isToday = ds === todayLocalIso, dotType = dotMap[ds];
          const dotColor = dotType === "event" ? "#E85D3A" : dotType === "task" ? "#F0A896" : null;
          return (
            <div key={i} onClick={() => onSelect(ds)} style={{
              position:"relative",width:22,height:22,lineHeight:"22px",margin:"0 auto",borderRadius:"50%",
              fontSize:10,cursor:"pointer",fontWeight:isSel||isToday?600:400,
              background:isSel?accent:isToday?accent+"22":"transparent",
              color:isSel?"#fff":isToday?accent:"#1A1714",
            }}>
              {d}
              {dotColor && !isSel && <div style={{position:"absolute",bottom:1,left:"50%",transform:"translateX(-50%)",width:3,height:3,borderRadius:"50%",background:dotColor}}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MONTH VIEW ───────────────────────────────────────────────────────────────
function WebMonthView({ year, month, events, selDate, onSelect, onDeselect, onDoubleClickDay, onClickEvent, accent }: {
  year: number; month: number; events: DesignEvent[]; selDate: string | null;
  onSelect: (d: string) => void; onDeselect?: () => void;
  onDoubleClickDay?: (d: string) => void; onClickEvent: (ev: DesignEvent) => void; accent: string;
}) {
  const first = firstDow(year, month);
  const days  = daysInMonth(year, month);
  const prevDays = daysInMonth(year, month === 0 ? 11 : month - 1);
  type Cell = { d: number; mo: "prev" | "cur" | "next" };
  const cells: Cell[] = [];
  for (let i = 0; i < first; i++) cells.push({ d: prevDays - first + i + 1, mo: "prev" });
  for (let d = 1; d <= days; d++) cells.push({ d, mo: "cur" });
  while (cells.length % 7 !== 0) cells.push({ d: cells.length - days - first + 1, mo: "next" });
  const rows = cells.length / 7;

  const prevY = month === 0 ? year - 1 : year, prevM = month === 0 ? 11 : month - 1;
  const nextY = month === 11 ? year + 1 : year, nextM = month === 11 ? 0 : month + 1;

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",flexShrink:0,borderBottom:"1px solid #E5E2DD"}}>
        {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d) => (
          <div key={d} style={{padding:"8px 12px",fontSize:10,fontWeight:600,color:"#b0ada8",letterSpacing:".05em"}}>{d.toUpperCase()}</div>
        ))}
      </div>
      <div onClick={(e) => { if (e.target === e.currentTarget) onDeselect?.(); }}
        style={{flex:1,display:"grid",gridTemplateColumns:"repeat(7,1fr)",gridTemplateRows:`repeat(${rows},1fr)`,overflow:"auto"}}>
        {cells.map((cell, i) => {
          const isCur = cell.mo === "cur";
          const y2 = cell.mo === "prev" ? prevY : cell.mo === "next" ? nextY : year;
          const m2 = cell.mo === "prev" ? prevM : cell.mo === "next" ? nextM : month;
          const ds = `${y2}-${p2(m2+1)}-${p2(cell.d)}`;
          const dayEvs = isCur ? events.filter((e) => e.date === ds) : [];
          const isToday = ds === todayLocalIso, isSel = ds === selDate;
          return (
            <div key={i} data-cal-cell="1"
              onClick={() => isCur && onSelect(ds)}
              onDoubleClick={() => isCur && onDoubleClickDay?.(ds)}
              style={{
                borderRight:"1px solid #F0EDE9",borderBottom:"1px solid #F0EDE9",
                padding:"7px 8px",cursor:isCur?"pointer":"default",
                background:isSel?"#FDF9F7":isCur?"#FEFCFA":"#F5F3F0",
                transition:"background 0.1s",
                outline: isSel ? "1px solid #E8DDD9" : "none",
                outlineOffset: "-1px",
              }}>
              <div style={{
                width:24,height:24,lineHeight:"24px",textAlign:"center",borderRadius:"50%",
                fontSize:12,fontWeight:isToday?700:400,marginBottom:4,
                background:isToday?accent+"22":"transparent",
                color:isToday?accent:isCur?"#1A1714":"#C8C4BE",
              }}>{cell.d}</div>
              {dayEvs.slice(0, 3).map((ev) => {
                const c = getCat(ev.cat);
                return (
                  <div key={ev.id} onClick={(e) => { e.stopPropagation(); onClickEvent(ev); }} style={{
                    fontSize:10,borderRadius:"0 3px 3px 0",padding:"2px 5px",marginBottom:2,
                    borderLeft:`2px solid ${c.color}`,background:c.color+"15",color:c.color,
                    fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",cursor:"pointer",
                  }}>
                    {ev.time && <span style={{opacity:.7,marginRight:3}}>{fmtTime(ev.time).replace(" AM","").replace(" PM","")}</span>}
                    {ev.title}
                  </div>
                );
              })}
              {dayEvs.length > 3 && <div style={{fontSize:9,color:"#b0ada8"}}>+{dayEvs.length - 3} more</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── WEEK VIEW ────────────────────────────────────────────────────────────────
function WebWeekView({ selDate, events, onClickEvent, accent }: {
  selDate: string | null; events: DesignEvent[]; onClickEvent: (ev: DesignEvent) => void; accent: string;
}) {
  const base = selDate ? parseDate(selDate) : new Date();
  const dow = base.getDay();
  const wk = Array.from({length:7}, (_, i) => { const d = new Date(base); d.setDate(base.getDate() - dow + i); return d; });
  const SLOT = 52;
  const hours = Array.from({length:17}, (_, i) => i + 7);

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:"52px repeat(7,1fr)",flexShrink:0,borderBottom:"1px solid #E5E2DD",background:"#FAF8F6"}}>
        <div/>
        {wk.map((d) => {
          const ds = fmtDate(d); const isToday = ds === todayLocalIso;
          return (
            <div key={ds} style={{textAlign:"center",padding:"8px 4px",borderLeft:"1px solid #F0EDE9"}}>
              <div style={{fontSize:10,fontWeight:600,color:"#b0ada8",letterSpacing:".04em"}}>{dayShort(d.getDay()).toUpperCase()}</div>
              <div style={{width:28,height:28,lineHeight:"28px",borderRadius:"50%",margin:"3px auto 0",fontSize:13,fontWeight:isToday?700:400,background:isToday?accent:"transparent",color:isToday?"#fff":"#1A1714"}}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      <div style={{flex:1,overflow:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"52px repeat(7,1fr)",minHeight:hours.length*SLOT}}>
          <div>
            {hours.map((h) => (
              <div key={h} style={{height:SLOT,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingRight:8,paddingTop:4}}>
                <span style={{fontSize:10,color:"#b0ada8",whiteSpace:"nowrap"}}>{h===12?"12 PM":h>12?`${h-12} PM`:`${h} AM`}</span>
              </div>
            ))}
          </div>
          {wk.map((d) => {
            const ds = fmtDate(d);
            const dayEvs = events.filter((e) => e.date === ds && e.time);
            return (
              <div key={ds} style={{borderLeft:"1px solid #F0EDE9",position:"relative"}}>
                {hours.map((h) => <div key={h} style={{height:SLOT,borderBottom:"1px solid #F9F7F5"}}/>)}
                {dayEvs.map((ev) => {
                  const [sh, sm] = ev.time.split(":").map(Number) as [number, number];
                  const [eh, em] = (ev.end || `${sh+1}:00`).split(":").map(Number) as [number, number];
                  const topFrac = (sh - 7) + sm / 60;
                  const durFrac = (eh + em / 60) - (sh + sm / 60);
                  const c = getCat(ev.cat);
                  return (
                    <div key={ev.id} onClick={() => onClickEvent(ev)} style={{
                      position:"absolute",top:topFrac*SLOT+1,left:2,right:2,
                      height:Math.max(durFrac*SLOT-2,20),zIndex:1,
                      background:c.color,color:"#fff",borderRadius:5,
                      padding:"3px 6px",fontSize:10,fontWeight:500,
                      cursor:"pointer",overflow:"hidden",
                      boxShadow:`0 1px 4px ${c.color}55`,
                    }}>
                      <div style={{fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.title}</div>
                      <div style={{opacity:.8,fontSize:9}}>{fmtTime(ev.time)}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── AGENDA-ONLY VIEW (full main area) ────────────────────────────────────────
function WebAgendaView({ events, onClickEvent, accent }: {
  events: DesignEvent[]; onClickEvent: (ev: DesignEvent) => void; accent: string;
}) {
  const upcoming = [...events].filter((e) => e.date >= todayLocalIso).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const grouped: Record<string, DesignEvent[]> = {};
  upcoming.forEach((e) => { (grouped[e.date] ||= []).push(e); });

  return (
    <div style={{flex:1,overflowY:"auto",padding:"8px 28px 28px"}}>
      {Object.keys(grouped).length === 0 && <div style={{padding:40,textAlign:"center",color:"#b0ada8",fontSize:14}}>No upcoming events</div>}
      {Object.entries(grouped).map(([date, evs]) => {
        const d = parseDate(date);
        const isToday = date === todayLocalIso;
        const label = isToday ? "Today" : d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
        return (
          <div key={date} style={{marginTop:24}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:13,fontWeight:700,color:isToday?accent:"#1A1714"}}>{label}</span>
              {isToday && <span style={{fontSize:10,background:accent+"22",color:accent,borderRadius:999,padding:"2px 8px",fontWeight:600,letterSpacing:".04em"}}>TODAY</span>}
              <div style={{flex:1,height:1,background:"#E5E2DD"}}/>
            </div>
            {evs.map((ev) => {
              const c = getCat(ev.cat);
              return (
                <div key={ev.id} onClick={() => onClickEvent(ev)} style={{
                  display:"flex",gap:14,alignItems:"flex-start",padding:"12px 16px",
                  borderRadius:10,marginBottom:6,cursor:"pointer",
                  background:"#FBF9F7",border:"1px solid #EAE6E1",transition:"border-color 0.15s",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = accent + "55")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#F0EDE9")}>
                  <div style={{width:3,alignSelf:"stretch",borderRadius:3,background:c.color,flexShrink:0,minHeight:30}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:14,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.title}</div>
                    <div style={{fontSize:12,color:"#8a8580"}}>
                      {ev.time && `${fmtTime(ev.time)}${ev.end ? ` – ${fmtTime(ev.end)}` : ""}`}
                      {ev.recur && <span style={{marginLeft:8,color:c.color,fontSize:11}}>↻ {ev.recur}</span>}
                    </div>
                    {ev.desc && <div style={{fontSize:11,color:"#b0ada8",marginTop:4}}>{ev.desc}</div>}
                  </div>
                  <span style={{fontSize:11,background:c.color+"18",color:c.color,borderRadius:6,padding:"3px 9px",fontWeight:500,flexShrink:0}}>{c.label}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
