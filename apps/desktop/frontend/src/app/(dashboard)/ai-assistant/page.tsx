import { Bot } from "lucide-react";

export default function AiAssistantPage() {
  return (
    <div className="p-6 flex flex-col gap-4 h-full items-center justify-center animate-fade-in text-center bg-[var(--color-surface-950)]">
      <div className="w-12 h-12 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-700)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <Bot className="w-5 h-5 text-[var(--color-text-muted)] opacity-70" />
      </div>
      <h2 className="text-[13px] font-medium text-[var(--color-text-primary)]">AI Assistant</h2>
      <p className="text-[11px] text-[var(--color-text-muted)] max-w-xs">
        Chat with the local AI, analyze logs, and run diagnostics. Coming in a future phase.
      </p>
    </div>
  );
}
