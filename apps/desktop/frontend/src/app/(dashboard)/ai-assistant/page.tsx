export default function AiAssistantPage() {
  return (
    <div className="p-6 flex flex-col gap-6 h-full items-center justify-center animate-fade-in text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-700)] shadow-md text-2xl">
        🤖
      </div>
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">AI Assistant</h2>
      <p className="text-[var(--color-text-secondary)] max-w-md">
        Chat with your local AI about system health and incidents. Coming in a future phase.
      </p>
    </div>
  );
}
