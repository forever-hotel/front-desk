type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="fds-shell">
      <main className="fds-main">
        <div className="fds-content">{children}</div>
      </main>
    </div>
  );
}