import { createContext, useContext, type CSSProperties } from "react";
import type { Category, CategoryColor } from "@/lib/calendar/types";

/** The user's categories, available to every calendar component. */
export const CategoriesContext = createContext<readonly Category[]>([]);

export function useCategories(): readonly Category[] {
  return useContext(CategoriesContext);
}

/** Looks up a category by id; uncategorized (or deleted) comes back undefined. */
export function useCategoryLookup(): (id: string | null) => Category | undefined {
  const categories = useCategories();
  return (id) => (id ? categories.find((c) => c.id === id) : undefined);
}

/** Exposes a category color as `--c` so CSS can tint with color-mix(). Gray when uncategorized. */
export function catStyle(color: CategoryColor | undefined): CSSProperties {
  return { "--c": `var(--cat-${color ?? "gray"})` } as CSSProperties;
}
