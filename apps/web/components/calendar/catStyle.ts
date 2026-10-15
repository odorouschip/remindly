import type { CSSProperties } from "react";
import { getCategory, type CategoryId } from "@/lib/calendar/types";

/** Exposes a category color as `--c` so CSS can tint with color-mix(). */
export function catStyle(id: CategoryId): CSSProperties {
  return { "--c": getCategory(id).color } as CSSProperties;
}
