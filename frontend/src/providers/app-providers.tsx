"use client";

import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";

import { AntdProvider } from "./antd-provider";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AntdRegistry>
      <AntdProvider>{children}</AntdProvider>
    </AntdRegistry>
  );
}
