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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeRegistry>
          <AppBootSplash />
          {children}
        </ThemeRegistry>
      </body>
    </html>
  );
}
