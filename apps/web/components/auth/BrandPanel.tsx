"use client";

import { RefreshCw, Sparkles, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./auth.module.css";

/** Minutes until the sample "Lunch with Sam" when the screen opens. */
const LEAD_MINUTES = 24;

/**
 * The right half of the sign-in screens: what Remindly is, with a small live
 * mock of today's agenda and the Lock Screen countdown. Decorative — the
 * sample data never touches the user's calendar.
 */
export function BrandPanel() {
  const [start] = useState(() => Date.now() + LEAD_MINUTES * 60_000 + 59_000);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const left = Math.max(0, Math.floor((start - now) / 1000));
  const countdown = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <aside className={styles.brand}>
      <div className={styles.brandInner}>
        <h2 className={styles.headline}>
          Know what&rsquo;s <em>next</em>,<br />at a glance.
        </h2>
        <p className={styles.lede}>
          Events and tasks in one calendar, with a countdown to the next thing on your iPhone&rsquo;s Lock Screen.
        </p>

        <div className={styles.showcase} aria-hidden>
          <div className={styles.agenda}>
            <div className={styles.agendaHead}>
              <span className={styles.agendaToday}>Today</span>
              <span className={styles.agendaDate}>{today}</span>
            </div>
            <AgendaRow task color="var(--cat-purple)" title="Pay rent" />
            <AgendaRow color="var(--cat-blue)" title="Standup" when="9:30 – 9:45 AM" />
            <AgendaRow color="var(--cat-orange)" title="Lunch with Sam" when="12:30 – 1:30 PM · Tartine" next />
            <AgendaRow color="var(--cat-green)" title="Gym" when="6:00 – 7:00 PM" />
          </div>

          <div className={styles.activity}>
            <div className={styles.activityBar} />
            <div className={styles.activityText}>
              <span className={styles.activityLabel}><span className={styles.activityDot} />Up next</span>
              <span className={styles.activityTitle}>Lunch with Sam</span>
              <span className={styles.activityWhen}>12:30 – 1:30 PM</span>
            </div>
            <span className={styles.activityCount}>{countdown}</span>
          </div>
        </div>

        <ul className={styles.features}>
          <li><Timer size={16} strokeWidth={1.75} />Countdowns on the Lock Screen and in the Dynamic Island</li>
          <li><Sparkles size={16} strokeWidth={1.75} />Type &ldquo;lunch with Sam fri at noon&rdquo; and it&rsquo;s on the calendar</li>
          <li><RefreshCw size={16} strokeWidth={1.75} />The same calendar on the web and your iPhone</li>
        </ul>
      </div>
    </aside>
  );
}

function AgendaRow({ title, when, color, task, next }: { title: string; when?: string; color: string; task?: boolean; next?: boolean }) {
  return (
    <div className={styles.agendaRow} data-next={next || undefined} style={{ "--c": color } as React.CSSProperties}>
      {task ? <span className={styles.agendaCheck} /> : <span className={styles.agendaBar} />}
      <span className={styles.agendaText}>
        <span className={styles.agendaTitle}>{title}</span>
        {when && <span className={styles.agendaWhen}>{when}</span>}
      </span>
    </div>
  );
}
