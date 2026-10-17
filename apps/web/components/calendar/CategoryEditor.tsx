import { Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, IconButton } from "@/components/ui/controls";
import { CATEGORY_COLORS, type Category, type CategoryColor } from "@/lib/calendar/types";
import { catStyle, useCategories } from "./categories";
import styles from "./CategoryEditor.module.css";

type CategoryEditorProps = {
  onSave: (cat: Category) => void;
  onDelete: (id: string) => void;
};

/** Rename, recolor, add and remove categories. Changes save as you go. */
export function CategoryEditor({ onSave, onDelete }: CategoryEditorProps) {
  const categories = useCategories();
  const [focusNewest, setFocusNewest] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const count = useRef(categories.length);

  // After "Add category" round-trips, put the cursor in the new row's name.
  useEffect(() => {
    if (focusNewest && categories.length > count.current) {
      const inputs = listRef.current?.querySelectorAll("input");
      const last = inputs?.[inputs.length - 1];
      last?.focus();
      last?.select();
      setFocusNewest(false);
    }
    count.current = categories.length;
  }, [categories.length, focusNewest]);

  const add = () => {
    // Pick the first color nobody is using yet, so new categories stand apart.
    const used = new Set(categories.map((c) => c.color));
    const color = CATEGORY_COLORS.find((c) => c !== "gray" && !used.has(c)) ?? "gray";
    const sortOrder = Math.max(-1, ...categories.map((c) => c.sortOrder)) + 1;
    setFocusNewest(true);
    onSave({ id: "", name: "New category", color, sortOrder });
  };

  return (
    <div>
      <ul ref={listRef} className={styles.list}>
        {categories.map((c) => <Row key={c.id} category={c} onSave={onSave} onDelete={onDelete} />)}
      </ul>
      {categories.length === 0 && <p className={styles.empty}>No categories yet.</p>}
      <Button variant="ghost" size="sm" onClick={add} className={styles.add}>
        <Plus size={14} strokeWidth={1.75} /> Add category
      </Button>
    </div>
  );
}

function Row({ category, onSave, onDelete }: { category: Category } & CategoryEditorProps) {
  const [name, setName] = useState(category.name);
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);

  useEffect(() => setName(category.name), [category.name]);

  // Close the color picker / delete confirmation when clicking elsewhere.
  useEffect(() => {
    if (!picking && !confirming) return;
    const onDown = (e: MouseEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) { setPicking(false); setConfirming(false); }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setPicking(false); setConfirming(false); }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [picking, confirming]);

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed) setName(category.name);
    else if (trimmed !== category.name) onSave({ ...category, name: trimmed.slice(0, 40) });
  };

  const pick = (color: CategoryColor) => {
    setPicking(false);
    if (color !== category.color) onSave({ ...category, color });
  };

  return (
    <li ref={rowRef} className={styles.row}>
      <button type="button" className={styles.swatch} style={catStyle(category.color)}
        aria-label={`Color: ${category.color}`} aria-expanded={picking} onClick={() => setPicking((p) => !p)} />
      {picking && (
        <div className={styles.palette} role="listbox" aria-label="Color">
          {CATEGORY_COLORS.map((color) => (
            <button key={color} type="button" role="option" aria-selected={color === category.color}
              className={styles.paletteSwatch} style={catStyle(color)} aria-label={color} title={color}
              onClick={() => pick(color)}>
              {color === category.color && <Check size={11} strokeWidth={3} />}
            </button>
          ))}
        </div>
      )}

      <input className={styles.name} value={name} maxLength={40} aria-label="Category name"
        onChange={(e) => setName(e.target.value)} onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { e.stopPropagation(); setName(category.name); e.currentTarget.blur(); }
        }} />

      {confirming ? (
        <span className={styles.confirm}>
          <span className={styles.confirmText}>Events keep, uncategorized.</span>
          <Button variant="danger" size="sm" onClick={() => onDelete(category.id)}>Delete</Button>
        </span>
      ) : (
        <IconButton label={`Delete ${category.name}`} size={26} onClick={() => setConfirming(true)}>
          <Trash2 size={14} strokeWidth={1.75} />
        </IconButton>
      )}
    </li>
  );
}
