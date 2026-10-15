import { Check, LogOut, Search, Settings, X } from "lucide-react";
import type { RefObject } from "react";
import { IconButton } from "@/components/ui/controls";
import { CATEGORIES, type CategoryId } from "@/lib/calendar/types";
import { catStyle } from "./catStyle";
import { MiniCalendar } from "./MiniCalendar";
import styles from "./Sidebar.module.css";

export type Account = { email: string | null; demo: boolean };

type SidebarProps = {
  search: string;
  onSearch: (value: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  year: number;
  month: number;
  selDate: string | null;
  onNavMonth: (delta: number) => void;
  onSelectDate: (date: string) => void;
  hiddenCats: ReadonlySet<CategoryId>;
  onToggleCat: (id: CategoryId) => void;
  account: Account;
  onOpenSettings: () => void;
  onSignOut: () => void;
};

export function Sidebar(props: SidebarProps) {
  const { search, onSearch, searchRef, hiddenCats, onToggleCat, account } = props;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.logo} aria-hidden>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M1 6h12M4 1v3M10 1v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <span className={styles.brandName}>Remindly</span>
        <IconButton label="Settings" onClick={props.onOpenSettings}>
          <Settings size={15} strokeWidth={1.75} />
        </IconButton>
      </div>

      <label className={styles.search}>
        <Search size={14} strokeWidth={1.75} className={styles.searchIcon} />
        <input ref={searchRef} value={search} placeholder="Search"
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") { onSearch(""); e.currentTarget.blur(); } }} />
        {search
          ? <IconButton label="Clear search" size={20} onClick={() => onSearch("")}><X size={12} strokeWidth={2} /></IconButton>
          : <kbd className={styles.kbd}>/</kbd>}
      </label>

      <MiniCalendar year={props.year} month={props.month} selDate={props.selDate}
        onNav={props.onNavMonth} onSelect={props.onSelectDate} />

      <section>
        <h3 className={styles.sectionTitle}>Categories</h3>
        {CATEGORIES.map((c) => {
          const visible = !hiddenCats.has(c.id);
          return (
            <button key={c.id} type="button" className={styles.catRow} aria-pressed={visible}
              onClick={() => onToggleCat(c.id)}>
              <span className={styles.catBox} style={catStyle(c.id)} data-on={visible || undefined}>
                {visible && <Check size={10} strokeWidth={3} />}
              </span>
              {c.label}
            </button>
          );
        })}
      </section>

      <div className={styles.account}>
        <div className={styles.avatar} aria-hidden>{(account.email?.[0] ?? "R").toUpperCase()}</div>
        <span className={styles.accountName}>{account.demo ? "Demo mode" : account.email ?? "Signed in"}</span>
        {!account.demo && (
          <IconButton label="Sign out" onClick={props.onSignOut}>
            <LogOut size={14} strokeWidth={1.75} />
          </IconButton>
        )}
      </div>
    </aside>
  );
}
