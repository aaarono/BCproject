export type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "theme-mode";

function resolveSystemDarkMode() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function getStoredThemeMode(): ThemeMode {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }

  return "system";
}

export function applyThemeMode(mode: ThemeMode) {
  const shouldUseDark = mode === "dark" || (mode === "system" && resolveSystemDarkMode());
  document.documentElement.classList.toggle("dark", shouldUseDark);
}

export function setThemeMode(mode: ThemeMode) {
  window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  applyThemeMode(mode);
}

export function initializeTheme() {
  const mode = getStoredThemeMode();
  applyThemeMode(mode);
  return mode;
}

export function subscribeToSystemThemeChanges(callback: (isDark: boolean) => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = (event: MediaQueryListEvent) => callback(event.matches);

  mediaQuery.addEventListener("change", listener);
  return () => mediaQuery.removeEventListener("change", listener);
}
