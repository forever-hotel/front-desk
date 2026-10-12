/**
 * Plan 19.6: conservative source-only WCAG remediation.
 * - Keeps all application business logic and Plan 19.4/19.5 code.
 * - Preflight transforms all files before writing any.
 * - Idempotent: safe to rerun after a successful application.
 * - No third-party dependencies.
 * Execute at repository root: node scripts/apply-plan19-6.cjs
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const paths = {
  shell: "frontend/src/components/layout/app-shell.tsx",
  header: "frontend/src/components/layout/header.tsx",
  sidebar: "frontend/src/components/layout/sidebar.tsx",
  css: "frontend/src/app/globals.css",
  checkin: "frontend/src/features/check-ins/components/check-in-screen.tsx",
  checkout: "frontend/src/features/check-outs/components/check-out-screen.tsx",
};
const alertFiles = [
  "frontend/src/features/check-ins/components/check-in-screen.tsx",
  "frontend/src/features/check-outs/components/check-out-screen.tsx",
  "frontend/src/features/dashboard/components/dashboard-screen.tsx",
  "frontend/src/features/folios/components/guest-folio-screen.tsx",
  "frontend/src/features/reservations/components/booking-search-screen.tsx",
  "frontend/src/features/rooms/components/room-status-screen.tsx",
  "frontend/src/features/rooms/components/room-change-modal.tsx",
  "frontend/src/features/service-requests/components/service-requests-screen.tsx",
  "frontend/src/features/audit-logs/components/audit-log-screen.tsx",
];
const allPaths = [...new Set([...Object.values(paths), ...alertFiles])];

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Missing required anchor: ${label}`);
  if (source.indexOf(before) !== source.lastIndexOf(before)) {
    throw new Error(`Ambiguous anchor: ${label}`);
  }
  return source.replace(before, after);
}

function applyShell(source) {
  if (source.includes('import { SkipLink } from "@/components/a11y/skip-link";')) {
    return source;
  }
  source = replaceOnce(source, 'import { useState } from "react";',
    'import { useEffect, useRef, useState } from "react";\nimport { SkipLink } from "@/components/a11y/skip-link";', 'AppShell imports');
  source = replaceOnce(source,
    '  const [sidebarOpen, setSidebarOpen] = useState(false);',
    `  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    document.querySelector<HTMLAnchorElement>("#fds-primary-navigation a")?.focus();

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [sidebarOpen]);

  const handleNavigate = () => {
    setSidebarOpen(false);
    mainContentRef.current?.focus();
  };`, 'AppShell state');
  source = replaceOnce(source,
    '    <div className="fds-shell">\n      <Sidebar isOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />',
    '    <div className="fds-shell">\n      <SkipLink />\n      <Sidebar isOpen={sidebarOpen} onNavigate={handleNavigate} />', 'AppShell skip link and nav');
  source = replaceOnce(source,
    '<Header onMenuToggle={() => setSidebarOpen((current) => !current)} />',
    `<Header
          onMenuToggle={() => setSidebarOpen((current) => !current)}
          menuButtonRef={menuButtonRef}
          expanded={sidebarOpen}
        />`, 'Header toggle props');
  source = replaceOnce(source, '<main className="fds-main">',
    '<main id="fds-main-content" ref={mainContentRef} tabIndex={-1} className="fds-main">', 'main landmark');
  source = replaceOnce(source,
    '          onClick={() => setSidebarOpen(false)}',
    '          onClick={() => { setSidebarOpen(false); menuButtonRef.current?.focus(); }}', 'mobile overlay focus restore');
  return source;
}

function applyHeader(source) {
  if (source.includes('aria-controls="fds-primary-navigation"')) return source;
  source = replaceOnce(source, 'import { useEffect, useState } from "react";',
    'import { useEffect, useState, type Ref } from "react";', 'Header Ref type');
  source = replaceOnce(source,
    'type HeaderProps = {\n  onMenuToggle: () => void;\n};',
    'type HeaderProps = {\n  onMenuToggle: () => void;\n  menuButtonRef?: Ref<HTMLButtonElement>;\n  expanded?: boolean;\n};', 'Header props type');
  source = replaceOnce(source,
    'export default function Header({ onMenuToggle }: HeaderProps) {',
    'export default function Header({ onMenuToggle, menuButtonRef, expanded = false }: HeaderProps) {', 'Header function signature');
  source = replaceOnce(source,
    '          onClick={onMenuToggle}\n          aria-label="Toggle navigation"',
    '          onClick={onMenuToggle}\n          ref={menuButtonRef}\n          aria-controls="fds-primary-navigation"\n          aria-expanded={expanded}\n          aria-label="Toggle navigation"', 'menu aria-expanded');
  return source;
}

function applySidebar(source) {
  return replaceOnce(source, '    <aside\n      className={`fds-sidebar',
    '    <aside\n      id="fds-primary-navigation"\n      className={`fds-sidebar', 'Sidebar navigation target');
}

const A11Y_CSS = `
/* Plan 19.6 — WCAG keyboard support */
.fds-skip-link {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 100;
  padding: 12px 16px;
  transform: translateY(-160%);
  border: 2px solid var(--gold);
  border-radius: 5px;
  background: #ffffff;
  color: #12263a;
  font-weight: 700;
  text-decoration: underline;
}
.fds-skip-link:focus-visible { transform: translateY(0); }
.fds-nav-section-label, .fds-session-active, .fds-session-time, .fds-user-role {
  color: #b8c7d6;
}
:where(a, button, input, textarea, select, [role="button"]):focus-visible {
  outline: 3px solid var(--gold);
  outline-offset: 3px;
}
.fds-visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}
@media (max-width: 900px) {
  .fds-sidebar {
    visibility: hidden;
    transition: transform 180ms ease, visibility 0s linear 180ms;
  }
  .fds-sidebar.is-open {
    visibility: visible;
    transition: transform 180ms ease;
  }
}
@media (prefers-reduced-motion: reduce) {
  .fds-sidebar, .fds-sidebar.is-open,
  .fds-skip-link { transition: none !important; }
}
`;
function applyCss(source) {
  if (source.includes("/* Plan 19.6 — WCAG keyboard support */")) return source;
  return source.trimEnd() + "\n" + A11Y_CSS;
}

function addTableCaptions(source, descriptors) {
  for (const [tableClass, caption] of descriptors) {
    const before = `<table className={styles.${tableClass}}>`;
    const after = `${before}\n              <caption className="fds-visually-hidden">${caption}</caption>`;
    source = replaceOnce(source, before, after, `${tableClass} table caption`);
  }
  return source.replaceAll("<th />", '<th scope="col"><span className="fds-visually-hidden">Actions</span></th>')
    .replaceAll("<th>", '<th scope="col">');
}

function updateAntd6(source) {
  // Only rewrite Alert attributes, preserving all values, messages, and conditionals.
  source = source.replace(/<Alert\b[\s\S]*?\/>/g, (alert) => alert.replace(/\bmessage=/g, "title="));
  // Ant Design 6 removed `maskClosable` in favour of mask.closable.
  source = source.replace(/\bmaskClosable=\{([^{}]+)\}/g, 'mask={{ closable: $1 }}');
  return source;
}

try {
  const original = new Map();
  const modified = new Map();
  for (const file of allPaths) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) throw new Error(`Required existing file missing: ${file}`);
    const source = fs.readFileSync(full, "utf8");
    original.set(file, source);
    modified.set(file, source);
  }
  const change = (file, fn) => modified.set(file, fn(modified.get(file)));
  change(paths.shell, applyShell);
  change(paths.header, applyHeader);
  change(paths.sidebar, applySidebar);
  change(paths.css, applyCss);
  change(paths.checkin, s => addTableCaptions(s, [["table", "Confirmed bookings for check-in"]]));
  change(paths.checkout, s => addTableCaptions(s, [
    ["guestTable", "Checked-in bookings for check-out"],
    ["folioTable", "Itemised guest folio charges"],
  ]));
  for (const file of alertFiles) change(file, updateAntd6);
  // All replacements have succeeded before we write even one file.
  for (const [file, content] of modified) {
    if (content !== original.get(file)) {
      fs.writeFileSync(path.join(root, file), content);
      console.log(`Updated: ${file}`);
    }
  }
  console.log("Plan 19.6 applied. Run Prettier, lint, TypeScript, Jest, coverage and build.");
} catch (error) {
  console.error(`Plan 19.6 not applied: ${error.message}`);
  process.exitCode = 1;
}
