export default function NetworkPage() {
  return (
    <div className="p-6 flex flex-col gap-6 h-full items-center justify-center animate-fade-in text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-700)] shadow-md text-2xl">
        🌐
      </div>
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Network Traffic</h2>
      <p className="text-[var(--color-text-secondary)] max-w-md">
        Active connections, bandwidth usage, and network anomalies. Coming in a future phase.
      </p>
    </div>
  );
}
