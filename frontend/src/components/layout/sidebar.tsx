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

type SidebarProps = {
  isOpen: boolean;
  onNavigate: () => void;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
};

type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

const navigationSections: NavigationSection[] = [
  {
    label: "OPERATIONS",
    items: [
      {
        label: "Dashboard",
        href: "/",
        icon: CircleDot,
      },
      {
        label: "Check-In",
        href: "/check-in",
        icon: LogIn,
      },
      {
        label: "Check-Out",
        href: "/check-out",
        icon: LogOut,
      },
      {
        label: "Walk-In Booking",
        href: "/walk-in",
        icon: Plus,
      },
    ],
  },
  {
    label: "MONITORING",
    items: [
      {
        label: "Room Status Board",
        href: "/rooms",
        icon: LayoutGrid,
      },
      {
        label: "Escalations",
        href: "/escalations",
        icon: TriangleAlert,
        badge: 2,
      },
    ],
  },
  {
    label: "GUEST",
    items: [
      {
        label: "Search Booking",
        href: "/bookings/search",
        icon: Search,
      },
      {
        label: "Guest Folio",
        href: "/folio",
        icon: List,
      },
      {
        label: "Service Request",
        href: "/service-requests",
        icon: Diamond,
      },
    ],
  },
  {
    label: "RECORDS",
    items: [
      {
        label: "Audit Log",
        href: "/audit-log",
        icon: CircleDot,
      },
    ],
  },
];

export default function Sidebar({
  isOpen,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`fds-sidebar ${isOpen ? "is-open" : ""}`}
      aria-label="Front Desk navigation"
    >
      <div className="fds-sidebar-content">
        {navigationSections.map((section) => (
          <section
            key={section.label}
            className="fds-nav-section"
          >
            <p className="fds-nav-section-label">
              {section.label}
            </p>

            <nav className="fds-navigation">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`fds-nav-link ${
                      active ? "active" : ""
                    }`}
                    aria-current={
                      active ? "page" : undefined
                    }
                  >
                    <span className="fds-nav-link-main">
                      <Icon
                        className="fds-nav-icon"
                        size={14}
                        strokeWidth={1.7}
                      />

                      <span>{item.label}</span>
                    </span>

                    {item.badge !== undefined && (
                      <span className="fds-nav-badge">
                        {item.badge}
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

        <span className="fds-session-time">
          SHIFT STARTED 08:00
        </span>
      </div>
    </aside>
  );
}