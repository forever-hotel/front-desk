"use client";

import type { ReactNode } from "react";

import { AntdRegistry } from "@ant-design/nextjs-registry";

import { AntdProvider } from "./antd-provider";
import { QueryProvider } from "./query-provider";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <AntdRegistry>
        <AntdProvider>{children}</AntdProvider>
      </AntdRegistry>
    </QueryProvider>
  );
}
