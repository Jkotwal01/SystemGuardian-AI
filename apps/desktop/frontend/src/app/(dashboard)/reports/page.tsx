export default function ReportsPage() {
  return (
    <div className="p-6 flex flex-col gap-6 h-full items-center justify-center animate-fade-in text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-700)] shadow-md text-2xl">
        📄
      </div>
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">System Reports</h2>
      <p className="text-[var(--color-text-secondary)] max-w-md">
        Generate and export daily, weekly, and monthly AI summaries. Coming in a future phase.
      </p>
    </div>
  );
}
