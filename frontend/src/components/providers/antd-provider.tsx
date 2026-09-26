"use client";

import type { ReactNode } from "react";
import { ConfigProvider } from "antd";
import antdTheme from "@/theme/antd-theme";

type AntdProviderProps = {
  children: ReactNode;
};

export default function AntdProvider({ children }: AntdProviderProps) {
  return <ConfigProvider theme={antdTheme}>{children}</ConfigProvider>;
}
