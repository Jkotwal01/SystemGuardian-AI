export default function OverviewPage() {
  return (
    <div className="p-6 flex flex-col gap-6">
      <div
        className="glass-card p-6 flex items-start gap-4 animate-fade-in"
        style={{ borderColor: "hsl(220 80% 50% / 0.2)" }}
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
          style={{
            background: "hsl(220 80% 50% / 0.15)",
            border: "1px solid hsl(220 80% 50% / 0.3)",
          }}
        >
          🚀
        </div>
        <div className="flex flex-col gap-1">
          <p
            className="font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Phase 4 Complete — Tauri Shell Ready
          </p>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
            }}
          >
            The Next.js App Router structure is in place, the sidebar navigates to all routes, and the Tauri frameless window with custom controls is fully operational.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Overall Health", value: "--", unit: "" },
          { label: "CPU Usage", value: "--%", unit: "" },
          { label: "RAM Usage", value: "--%", unit: "" },
        ].map(({ label, value }, i) => (
          <div key={label} className={`glass-card p-5 flex flex-col gap-3 stagger-${i + 1} animate-fade-in`}>
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
            <p className="metric-value" style={{ color: "var(--color-text-primary)" }}>
              {value}
            </p>
            <div className="ai-thinking rounded-full" style={{ height: "2px", borderRadius: "1px" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
