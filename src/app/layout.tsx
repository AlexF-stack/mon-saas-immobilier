import type { Metadata } from "next";
import ThemeRegistry from "@/components/ThemeRegistry";
import AppBootSplash from "@/components/AppBootSplash";
import "./globals.css";

export const metadata: Metadata = {
  title: "ImmoSaaS - Real Estate Management",
  description: "Manage your rental properties with ease",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/favicon.svg",
  },
};

const themeInitScript = `
(() => {
  try {
    const storageKey = 'immosaas-theme';
    const stored = localStorage.getItem(storageKey);
    const resolved =
      stored === 'light' || stored === 'dark'
        ? stored
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  } catch {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <ThemeRegistry>
          <AppBootSplash />
          {children}
        </ThemeRegistry>
      </body>
    </html>
  );
}
