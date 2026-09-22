"use client";

import { useEffect, useState } from "react";
import { Diamond, Menu } from "lucide-react";

type HeaderProps = {
  onMenuToggle: () => void;
};

export default function Header({ onMenuToggle }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date());
    };

    const initialTimer = window.setTimeout(updateTime, 0);
    const intervalTimer = window.setInterval(updateTime, 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, []);

  const formatDateTime = (date: Date) => {
    const weekday = date
      .toLocaleDateString("en-US", {
        weekday: "short",
      })
      .toUpperCase();

    const day = String(date.getDate()).padStart(2, "0");

    const month = date
      .toLocaleDateString("en-US", {
        month: "short",
      })
      .toUpperCase();

    const year = date.getFullYear();

    const time = date.toLocaleTimeString("en-GB", {
      hour12: false,
    });

    return `${weekday} ${day} ${month} ${year} ${time}`;
  };

  return (
    <header className="fds-header">
      <div className="fds-header-left">
        <button
          type="button"
          className="fds-menu-button"
          onClick={onMenuToggle}
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

        <div className="fds-user">
          <div className="fds-user-avatar">RC</div>

          <div className="fds-user-details">
            <span className="fds-user-name">R. Chandra</span>
            <span className="fds-user-role">Receptionist</span>
          </div>
        </div>

        <div className="fds-escalated-pill">
          <span className="fds-escalated-dot" />
          <span>2 ESCALATED</span>
        </div>
      </div>
    </header>
  );
}
