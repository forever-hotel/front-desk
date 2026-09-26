import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";

import "./globals.css";

import AppShell from "@/components/layout/app-shell";
import AntdProvider from "@/components/providers/antd-provider";

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
        <AntdRegistry>
          <AntdProvider>
            <AppShell>{children}</AppShell>
          </AntdProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
