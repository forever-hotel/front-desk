/**
 * First keyboard navigation stop in the application shell.
 * Visually hidden until focused; native anchor also works without JS.
 */
export function SkipLink() {
  return (
    <nav aria-label="Skip navigation">
      <a className="fds-skip-link" href="#fds-main-content">
        Skip to main content
      </a>
    </nav>
  );
}
