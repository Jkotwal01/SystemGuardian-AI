export default function SecurityPage() {
  return (
    <div className="p-6 flex flex-col gap-6 h-full items-center justify-center animate-fade-in text-center">
      <div className="w-16 h-16 rounded-full bg-surface-800 flex items-center justify-center border border-surface-700 shadow-md">
        🛡️
      </div>
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Security Dashboard</h2>
      <p className="text-[var(--color-text-secondary)] max-w-md">
        Real-time threat detection and security event monitoring. Coming in a future phase.
      </p>
    </div>
  );
}
