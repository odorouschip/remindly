import { useEffect } from "react";
import { Button } from "@/components/ui/controls";
import styles from "./ScopeDialog.module.css";

export type Scope = "this" | "following" | "all";

type ScopeDialogProps = {
  /** What's being done, or null when closed. */
  action: "save" | "delete" | null;
  /** Hides "This and following" on the first occurrence, where it would mean all of them. */
  isFirst: boolean;
  onChoose: (scope: Scope) => void;
  onCancel: () => void;
};

/** "This event / All events" when saving or deleting one occurrence of a repeating event. */
export function ScopeDialog({ action, isFirst, onChoose, onCancel }: ScopeDialogProps) {
  useEffect(() => {
    if (!action) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [action, onCancel]);

  if (!action) return null;
  const deleting = action === "delete";

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="scope-title" aria-describedby="scope-message">
        <h2 id="scope-title" className={styles.title}>{deleting ? "Delete repeating event" : "Save repeating event"}</h2>
        <p id="scope-message" className={styles.message}>
          {deleting ? "Delete only this occurrence, or more of the series?" : "Apply your changes to this occurrence only, or to every one?"}
        </p>
        <div className={styles.choices}>
          <Button variant={deleting ? "secondary" : "primary"} autoFocus onClick={() => onChoose("this")}>
            {deleting ? "Delete this event" : "This event"}
          </Button>
          {deleting && !isFirst && (
            <Button onClick={() => onChoose("following")}>This and following events</Button>
          )}
          <Button variant={deleting ? "danger" : "secondary"} onClick={() => onChoose("all")}>
            {deleting ? "Delete all events" : "All events"}
          </Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
