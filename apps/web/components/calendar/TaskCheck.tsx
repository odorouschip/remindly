import { Check } from "lucide-react";
import styles from "./TaskCheck.module.css";

/** Clickable completion circle for task rows. Colored by the row's --c. */
export function TaskCheck({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={done} aria-label={done ? "Mark as not done" : "Mark as done"}
      className={styles.check} onClick={onToggle}>
      {done && <Check size={9} strokeWidth={3.5} />}
    </button>
  );
}

/** The same circle, display-only, for places where the whole chip is a button. */
export function TaskMark({ done }: { done: boolean }) {
  return (
    <span className={styles.check} data-done={done || undefined} aria-hidden>
      {done && <Check size={9} strokeWidth={3.5} />}
    </span>
  );
}
