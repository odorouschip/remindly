import { Monitor, Moon, Sun, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button, IconButton } from "@/components/ui/controls";
import type { Category } from "@/lib/calendar/types";
import type { ThemePref } from "@/lib/theme";
import { CategoryEditor } from "./CategoryEditor";
import type { Account } from "./Sidebar";
import styles from "./SettingsModal.module.css";

const THEME_OPTIONS: readonly { value: ThemePref; label: string; icon: ReactNode }[] = [
  { value: "light",  label: "Light",  icon: <Sun size={16} strokeWidth={1.75} /> },
  { value: "dark",   label: "Dark",   icon: <Moon size={16} strokeWidth={1.75} /> },
  { value: "system", label: "System", icon: <Monitor size={16} strokeWidth={1.75} /> },
];

type SettingsModalProps = {
  open: boolean;
  /** Section to scroll to when opening. */
  focus: "top" | "categories";
  onClose: () => void;
  themePref: ThemePref;
  onThemePref: (pref: ThemePref) => void;
  onSaveCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
  account: Account;
  onSignOut: () => void;
};

export function SettingsModal(props: SettingsModalProps) {
  const { open, focus, onClose, themePref, onThemePref, account, onSignOut } = props;
  const categoriesRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open && focus === "categories") categoriesRef.current?.scrollIntoView({ block: "start" });
  }, [open, focus]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className={styles.header}>
          <h2 id="settings-title" className={styles.title}>Settings</h2>
          <IconButton label="Close settings" onClick={onClose}><X size={16} strokeWidth={1.75} /></IconButton>
        </div>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Appearance</h3>
          <div className={styles.themeGrid}>
            {THEME_OPTIONS.map((o) => (
              <button key={o.value} type="button" className={styles.themeOption}
                aria-pressed={themePref === o.value} onClick={() => onThemePref(o.value)}>
                <span className={styles.themePreview} data-variant={o.value}>
                  <span /><span /><span />
                </span>
                <span className={styles.themeLabel}>{o.icon}{o.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section ref={categoriesRef} className={styles.section}>
          <h3 className={styles.sectionTitle}>Categories</h3>
          <CategoryEditor onSave={props.onSaveCategory} onDelete={props.onDeleteCategory} />
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Account</h3>
          <dl className={styles.rows}>
            <div><dt>Email</dt><dd>{account.demo ? "Demo mode — not signed in" : account.email ?? "—"}</dd></div>
            <div><dt>Time zone</dt><dd>{timezone}</dd></div>
          </dl>
          {!account.demo && (
            <Button size="sm" onClick={onSignOut} className={styles.signOut}>Sign out</Button>
          )}
        </section>
      </div>
    </div>
  );
}
