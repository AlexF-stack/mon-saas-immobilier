"use client";

import React from "react";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted) return (
    <button aria-hidden className="p-2 rounded-md" />
  );

  const current = theme === "system" ? systemTheme : theme;

  const toggle = () => {
    const next = current === "dark" ? "light" : "dark";
    setTheme(next);
  };

  return (
    <button
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={toggle}
      className="inline-flex items-center justify-center p-2 rounded-md transition-all duration-200 hover:bg-[rgb(var(--surface)/0.06)]"
    >
      {current === "dark" ? (
        /* Sun icon */
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary">
          <circle cx="12" cy="12" r="4" strokeWidth="2" />
          <path strokeWidth="2" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        /* Moon icon */
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary">
          <path strokeWidth="2" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}
