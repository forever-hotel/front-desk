"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleDot,
  LogIn,
  LogOut,
  Plus,
  LayoutGrid,
  TriangleAlert,
  Search,
  List,
  Diamond,
} from "lucide-react";

import { useEscalationSummary } from "@/features/escalations/hooks/use-escalation-summary";
import styles from "./escalation-indicators.module.css";

type SidebarProps = {
  isOpen: boolean;
  onNavigate: () => void;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

const navigationSections: NavigationSection[] = [
  {
    label: "OPERATIONS",
    items: [
      { label: "Dashboard", href: "/", icon: CircleDot },
      { label: "Check-In", href: "/check-in", icon: LogIn },
      { label: "Check-Out", href: "/check-out", icon: LogOut },
      { label: "Walk-In Booking", href: "/walk-in", icon: Plus },
    ],
  },
  {
    label: "MONITORING",
    items: [
      { label: "Room Status Board", href: "/rooms", icon: LayoutGrid },
      { label: "Escalations", href: "/escalations", icon: TriangleAlert },
    ],
  },
  {
    label: "GUEST",
    items: [
      { label: "Search Booking", href: "/bookings/search", icon: Search },
      { label: "Guest Folio", href: "/folio", icon: List },
      { label: "Service Request", href: "/service-requests", icon: Diamond },
    ],
  },
  {
    label: "RECORDS",
    items: [{ label: "Audit Log", href: "/audit-log", icon: CircleDot }],
  },
];

export default function Sidebar({ isOpen, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { count, state } = useEscalationSummary();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className={`fds-sidebar ${isOpen ? "is-open" : ""}`}
      aria-label="Front Desk navigation"
    >
      <div className="fds-sidebar-content">
        {navigationSections.map((section) => (
          <section key={section.label} className="fds-nav-section">
            <p className="fds-nav-section-label">{section.label}</p>
            <nav className="fds-navigation" aria-label={section.label}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                const escalationItem = item.href === "/escalations";
                const showCount =
                  escalationItem &&
                  state === "ready" &&
                  count !== null &&
                  count > 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`fds-nav-link ${active ? "active" : ""} ${styles.sidebarLink}`}
                    aria-current={active ? "page" : undefined}
                    aria-label={
                      escalationItem && state === "ready"
                        ? `Escalations, ${count} recent`
                        : escalationItem && state === "unavailable"
                          ? "Escalations, count unavailable"
                          : undefined
                    }
                  >
                    <span className="fds-nav-link-main">
                      <Icon
                        className="fds-nav-icon"
                        size={14}
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </span>

                    {showCount && (
                      <span className="fds-nav-badge" aria-hidden="true">
                        {count}
                      </span>
                    )}
                    {escalationItem && state === "unavailable" && (
                      <span
                        className={styles.sidebarUnavailable}
                        aria-hidden="true"
                      >
                        —
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </section>
        ))}
      </div>

      <div className="fds-session-status">
        <div className="fds-session-active">
          <span className="fds-session-dot" />
          <span>SESSION ACTIVE</span>
        </div>
        <span className="fds-session-time">SHIFT STARTED 08:00</span>
      </div>
    </aside>
  );
}
