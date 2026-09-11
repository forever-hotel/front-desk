"use client";

import { useState } from "react";
import Header from "./header";
import Sidebar from "./sidebar";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({
  children,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="fds-shell">
      <Sidebar
        isOpen={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
      />

      <div className="fds-main-area">
        <Header
          onMenuToggle={() =>
            setSidebarOpen((current) => !current)
          }
        />

        <main className="fds-main">
          <div className="fds-content">
            {children}
          </div>
        </main>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          className="fds-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}