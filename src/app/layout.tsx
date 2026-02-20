import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ImmoSaaS - Real Estate Management",
  description: "Manage your rental properties with ease",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="antialiased">
        {children}
      </body>
    </html>
  );
}
