import type { Metadata } from "next";

import "./globals.css";
import "./forever-modern.css";
import "./screen-refinements.css";

import { AppProviders } from "@/providers/app-providers";

export const metadata: Metadata = {
  title: "Forever Hotel - Front Desk",
  description: "Forever Hotel Front Desk System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
