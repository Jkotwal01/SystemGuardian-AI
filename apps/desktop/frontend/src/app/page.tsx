/**
 * SystemGuardian AI — Phase 0 Shell Page
 *
 * This is the initial scaffold page demonstrating the design system.
 * Phase 4 will replace this with the full live dashboard.
 */
export default function Home() {
  return (
    <div
      className="flex flex-1 h-full"
      style={{ background: "var(--color-surface-900)" }}
    >
      {/* ── Sidebar shell ── */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col gap-1 px-3 py-4 border-r"
        style={{
          background: "var(--color-surface-800)",
          borderColor: "var(--color-surface-700)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-2 py-3 mb-4">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{
              background:
                "linear-gradient(135deg, hsl(220 80% 50%), hsl(185 85% 55%))",
            }}
          >
            SG
          </div>
          <span
            className="font-semibold text-sm"
            style={{ color: "var(--color-text-primary)" }}
          >
            SystemGuardian
          </span>
        </div>

        {/* Nav items (static shell) */}
        {[
          { icon: "◈", label: "Dashboard", active: true },
          { icon: "⚠", label: "Incidents" },
          { icon: "◉", label: "Performance" },
          { icon: "⬡", label: "Security" },
          { icon: "◫", label: "Storage" },
          { icon: "⬡", label: "Network" },
          { icon: "⬡", label: "Drivers" },
          { icon: "◑", label: "Power" },
        ].map(({ icon, label, active }) => (
          <div key={label} className={`nav-item${active ? " active" : ""}`}>
            <span className="text-xs w-4 text-center">{icon}</span>
            {label}
          </div>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status */}
        <div
          className="px-3 py-2 rounded-lg flex items-center gap-2"
          style={{
            background: "var(--color-surface-700)",
            color: "var(--color-text-muted)",
            fontSize: "var(--text-xs)",
          }}
        >
          <span className="pulse-live" />
          Backend: Initializing
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="h-14 flex items-center justify-between px-6 border-b flex-shrink-0"
          style={{
            background: "var(--color-surface-800)",
            borderColor: "var(--color-surface-700)",
          }}
        >
          <h1
            className="font-semibold"
            style={{
              color: "var(--color-text-primary)",
              fontSize: "var(--text-base)",
            }}
          >
            Dashboard
          </h1>
          <div className="flex items-center gap-3">
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                background: "hsl(142 65% 42% / 0.15)",
                color: "hsl(142 65% 55%)",
                border: "1px solid hsl(142 65% 42% / 0.3)",
              }}
            >
              Phase 0.2 — Tooling Ready
            </span>
          </div>
        </header>

        {/* Dashboard body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Health score + summary row */}
          <div className="grid grid-cols-4 gap-4">
            {/* Health score card */}
            <div
              className="glass-card-elevated col-span-1 p-6 flex flex-col items-center justify-center gap-2"
            >
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                System Health
              </p>
              <div
                className="metric-value health-good"
                style={{ color: "var(--health-color)", fontSize: "3rem" }}
              >
                --
              </div>
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                }}
              >
                Waiting for data
              </p>
            </div>

            {/* Metric cards */}
            {[
              { label: "CPU Usage", value: "--%", unit: "", status: "info" },
              { label: "RAM Usage", value: "--%", unit: "", status: "info" },
              { label: "Active Incidents", value: "--", unit: "", status: "info" },
            ].map(({ label, value }) => (
              <div key={label} className="glass-card p-5 flex flex-col gap-3">
                <p
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {label}
                </p>
                <p
                  className="metric-value"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {value}
                </p>
                <div
                  className="ai-thinking rounded-full"
                  style={{ height: "2px", borderRadius: "1px" }}
                />
              </div>
            ))}
          </div>

          {/* Phase status banner */}
          <div
            className="glass-card p-6 flex items-start gap-4"
            style={{ borderColor: "hsl(220 80% 50% / 0.2)" }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
              style={{
                background: "hsl(220 80% 50% / 0.15)",
                border: "1px solid hsl(220 80% 50% / 0.3)",
              }}
            >
              🏗
            </div>
            <div className="flex flex-col gap-1">
              <p
                className="font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Phase 0 Complete — Foundation Ready
              </p>
              <p
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-secondary)",
                }}
              >
                Monorepo structure, CI/CD workflows, backend skeleton (FastAPI),
                and frontend shell (Next.js + Tauri) are all initialized. Phase
                1 will wire the database, domain models, and repositories.
              </p>
            </div>
          </div>

          {/* Severity badges demo */}
          <div className="glass-card p-5 flex flex-col gap-3">
            <p
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Design System — Severity Scale
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {(
                [
                  ["CRITICAL", "severity-critical"],
                  ["HIGH", "severity-high"],
                  ["MEDIUM", "severity-medium"],
                  ["LOW", "severity-low"],
                  ["INFO", "severity-info"],
                ] as const
              ).map(([label, cls]) => (
                <span
                  key={label}
                  className={`${cls} text-xs font-semibold px-3 py-1 rounded-full`}
                  style={{ letterSpacing: "0.06em" }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
