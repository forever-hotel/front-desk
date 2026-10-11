"use client";

import { useEffect, useRef, useState } from "react";
import { SkipLink } from "@/components/a11y/skip-link";
import Header from "./header";
import Sidebar from "./sidebar";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sidebarOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSidebarOpen(false);
      menuButtonRef.current?.focus();
    };

    // Move focus into the opened mobile navigation for keyboard users.
    document
      .querySelector<HTMLAnchorElement>("#fds-primary-navigation a")
      ?.focus();

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [sidebarOpen]);

  const handleNavigate = () => {
    setSidebarOpen(false);
    mainContentRef.current?.focus();
  };

  return (
    <div className="fds-shell">
      <SkipLink />
      <Sidebar isOpen={sidebarOpen} onNavigate={handleNavigate} />

      <div className="fds-main-area">
        <Header
          onMenuToggle={() => setSidebarOpen((current) => !current)}
          menuButtonRef={menuButtonRef}
          expanded={sidebarOpen}
        />

        <main
          id="fds-main-content"
          ref={mainContentRef}
          tabIndex={-1}
          className="fds-main"
        >
          <div className="fds-content">{children}</div>
        </main>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          className="fds-overlay"
          aria-label="Close navigation"
          onClick={() => {
            setSidebarOpen(false);
            menuButtonRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
