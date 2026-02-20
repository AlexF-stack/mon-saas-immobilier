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
      defaultTheme="system"
      enableSystem={true}
      disableTransitionOnChange={true}
    >
      {children}
    </ThemeProvider>
  );
}
