"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const THEME_TRANSITION_CLASS = "theme-switching";

export default function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setMounted(true);
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      document.documentElement.classList.remove(THEME_TRANSITION_CLASS);
    };
  }, []);

  if (!mounted) return (
    <button aria-hidden className="h-9 w-9 rounded-md" />
  );

  const current = theme === "system" ? systemTheme : theme;
  const resolvedTheme = current === "dark" ? "dark" : "light";

  const toggle = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    root.classList.add(THEME_TRANSITION_CLASS);
    setIsAnimating(true);
    setTheme(next);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      root.classList.remove(THEME_TRANSITION_CLASS);
      setIsAnimating(false);
    }, 360);
  };

  return (
    <button
      aria-label="Toggle theme"
      title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      aria-pressed={resolvedTheme === "dark"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-card/80 text-primary transition-all [transition-duration:var(--motion-standard)] [transition-timing-function:var(--ease-standard)] hover:border-primary/40 hover:bg-surface/85",
        isAnimating && "theme-toggle-pulse"
      )}
    >
      <span className="relative h-5 w-5">
        <Sun
          className={cn(
            "absolute inset-0 h-5 w-5 transition-all [transition-duration:var(--motion-standard)] [transition-timing-function:var(--ease-standard)]",
            resolvedTheme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"
          )}
        />
        <Moon
          className={cn(
            "absolute inset-0 h-5 w-5 transition-all [transition-duration:var(--motion-standard)] [transition-timing-function:var(--ease-standard)]",
            resolvedTheme === "dark" ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"
          )}
        />
      </span>
    </button>
  );
}
