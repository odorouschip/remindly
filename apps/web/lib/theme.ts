export type ThemePref = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "remindly:theme";

/** Runs in <head> before first paint so an explicit light/dark choice never flashes. */
export const themeInitScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function readThemePref(): ThemePref {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
  return "system";
}

/** "system" removes the attribute so the prefers-color-scheme media query decides. */
export function applyThemePref(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") delete root.dataset.theme;
  else root.dataset.theme = pref;
  try {
    if (pref === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Non-fatal: the choice just won't persist.
  }
}
