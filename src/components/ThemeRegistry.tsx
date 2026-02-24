"use client";

import { ThemeProvider } from "next-themes";
import React from "react";

interface Props {
  children: React.ReactNode;
}

export default function ThemeRegistry({ children }: Props) {
  return (
    <ThemeProvider
      attribute="class"
      storageKey="immosaas-theme"
      defaultTheme="system"
      enableSystem={true}
      disableTransitionOnChange={false}
    >
      {children}
    </ThemeProvider>
  );
}
