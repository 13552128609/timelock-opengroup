"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) || null;
    const initial = stored === "light" || stored === "dark" ? stored : getSystemTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--panel)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--panel-2)]"
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
