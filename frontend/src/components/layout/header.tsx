"use client";

import { useEffect, useState, type Ref } from "react";
import Link from "next/link";
import { Diamond, Menu } from "lucide-react";

import { useEscalationSummary } from "@/features/escalations/hooks/use-escalation-summary";
import styles from "./escalation-indicators.module.css";

type HeaderProps = {
  onMenuToggle: () => void;
  menuButtonRef?: Ref<HTMLButtonElement>;
  expanded?: boolean;
};

export default function Header({
  onMenuToggle,
  menuButtonRef,
  expanded = false,
}: HeaderProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const { count, state } = useEscalationSummary();

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());
    const initialTimer = window.setTimeout(updateTime, 0);
    const intervalTimer = window.setInterval(updateTime, 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, []);

  const formatDateTime = (date: Date) => {
    const weekday = date
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase();
    const day = String(date.getDate()).padStart(2, "0");
    const month = date
      .toLocaleDateString("en-US", { month: "short" })
      .toUpperCase();
    const year = date.getFullYear();
    const time = date.toLocaleTimeString("en-GB", { hour12: false });
    return `${weekday} ${day} ${month} ${year} ${time}`;
  };

  const escalationLabel =
    state === "loading"
      ? "CHECKING ESCALATIONS"
      : state === "unavailable"
        ? "ESCALATIONS UNAVAILABLE"
        : `${count} RECENT ESCALATIONS`;

  return (
    <header className="fds-header">
      <div className="fds-header-left">
        <button
          type="button"
          className="fds-menu-button"
          onClick={onMenuToggle}
          ref={menuButtonRef}
          aria-controls="fds-primary-navigation"
          aria-expanded={expanded}
          aria-label="Toggle navigation"
        >
          <Menu size={21} />
        </button>

        <div className="fds-brand">
          <Diamond size={15} className="fds-brand-mark" fill="currentColor" />
          <span className="fds-brand-forever">FOREVER</span>
          <span className="fds-brand-hotel">HOTEL</span>
          <span className="fds-brand-separator">—</span>
          <span className="fds-brand-area">FRONT DESK</span>
        </div>
      </div>

      <div className="fds-header-right">
        <div className="fds-date-pill">
          {currentTime ? formatDateTime(currentTime) : "—"}
        </div>

        {/* Existing placeholder staff presentation; real Auth UI is separate work. */}
        <div className="fds-user">
          <div className="fds-user-avatar">RC</div>
          <div className="fds-user-details">
            <span className="fds-user-name">R. Chandra</span>
            <span className="fds-user-role">Receptionist</span>
          </div>
        </div>

        <Link
          href="/escalations"
          className={`fds-escalated-pill ${styles.headerLink}`}
          aria-label={
            state === "ready"
              ? `View ${count} recent escalations`
              : `View escalations: ${state}`
          }
        >
          <span className="fds-escalated-dot" aria-hidden="true" />
          <span aria-live="polite">{escalationLabel}</span>
        </Link>
      </div>
    </header>
  );
}
