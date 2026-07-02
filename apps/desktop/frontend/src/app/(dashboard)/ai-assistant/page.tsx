"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, User, AlertCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { ChatMessageRead } from "@/lib/types";

// Create a stable session ID per page load
const SESSION_ID = "session-" + Math.random().toString(36).substring(2, 10);

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessageRead[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Initial load - fetch history (if we were persisting session IDs, but here it's fresh)
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await api.chat.getHistory(SESSION_ID);
        if (history.length > 0) {
          setMessages(history);
        } else {
          // Add a welcome message
          setMessages([
            {
              id: "welcome",
              session_id: SESSION_ID,
              role: "assistant",
              content: "Hello! I am System Guardian AI. I am monitoring your PC's events, health, and incidents in real-time. How can I help you today?",
              timestamp: new Date().toISOString(),
            }
          ]);
        }
      } catch (err) {
        console.error("Failed to fetch history", err);
      }
    };
    fetchHistory();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);

    // Add user message to UI immediately
    const userMsgObj: ChatMessageRead = {
      id: "temp-" + Date.now(),
      session_id: SESSION_ID,
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMsgObj]);
    
    // Add empty assistant message that will be filled
    const assistantMsgId = "temp-asst-" + Date.now();
    setMessages(prev => [
      ...prev, 
      {
        id: assistantMsgId,
        session_id: SESSION_ID,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      }
    ]);

    setIsStreaming(true);

    try {
      const response = await fetch("http://127.0.0.1:8765/api/v1/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: SESSION_ID,
          message: userMessage,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to AI assistant.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Parse JSON lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.chunk) {
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMsgId 
                  ? { ...msg, content: msg.content + data.chunk }
                  : msg
              ));
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
            console.error("Failed to parse JSON chunk", line, e);
          }
        }
      }
      
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-950)] p-4 md:p-6 lg:flex-row gap-4 lg:gap-6 animate-fade-in">
      
      {/* Left Column: Chat Area */}
      <div className="flex-1 flex flex-col glass-card overflow-hidden border-[var(--color-surface-700)] rounded-lg bg-[var(--color-surface-900)] h-[calc(100vh-140px)] min-h-[500px]">
        
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-[var(--color-surface-700)] bg-[var(--color-surface-800)]/50">
          <div className="w-8 h-8 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center border border-[var(--color-surface-600)] shadow-sm text-indigo-400">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-[13px] font-medium text-[var(--color-text-primary)] leading-tight">System Guardian AI</h2>
            <p className="text-[11px] text-[var(--color-brand-400)] font-medium">Ready and listening</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
            >
              <div className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center border shadow-sm mt-1 ${
                msg.role === "user" 
                  ? "bg-[var(--color-surface-800)] border-[var(--color-surface-600)] text-[var(--color-text-secondary)]" 
                  : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
              }`}>
                {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              
              <div className={`p-3.5 rounded-lg text-[13px] leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] ${
                msg.role === "user" 
                  ? "bg-[var(--color-surface-800)] border border-[var(--color-surface-600)] text-[var(--color-text-primary)]" 
                  : "bg-[var(--color-surface-900)] border border-[var(--color-surface-700)] text-[var(--color-text-secondary)]"
              }`}>
                {/* For simplicity, we just use whitespace-pre-wrap for formatting */}
                {msg.role === "assistant" && !msg.content && isStreaming && msg.id.startsWith("temp-asst") ? (
                   <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
                     <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...
                   </span>
                ) : (
                  <div className="whitespace-pre-wrap font-sans">
                    {msg.content}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mb-2 p-2 rounded-md bg-[hsl(0_84%_60%_/_0.1)] border border-[hsl(0_84%_60%_/_0.2)] text-[var(--color-severity-critical)] flex items-center gap-2 text-[11px] font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 bg-[var(--color-surface-800)]/30 border-t border-[var(--color-surface-700)]">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your system's performance, recent security events, or hardware health..."
              className="w-full bg-[var(--color-surface-900)] border border-[var(--color-surface-600)] rounded-full py-3 pl-4 pr-12 text-[13px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-surface-500)] focus:ring-1 focus:ring-[var(--color-surface-500)] transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="absolute right-2 p-2 rounded-full bg-[var(--color-brand-600)] text-white hover:bg-[var(--color-brand-500)] disabled:opacity-50 disabled:hover:bg-[var(--color-brand-600)] transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="text-center mt-2">
            <span className="text-[10px] text-[var(--color-text-muted)]">
              AI answers are generated based on your local system data.
            </span>
          </div>
        </div>
      </div>
      
      {/* Right Column: Context Preview */}
      <div className="hidden lg:flex w-1/3 flex-col gap-3 h-[calc(100vh-140px)] min-h-[500px]">
         <div className="flex items-center justify-between pl-1 pr-2">
           <h3 className="text-[11px] font-medium tracking-widest uppercase text-[var(--color-text-secondary)]">
             Active AI Context
           </h3>
         </div>
         <div className="flex-1 glass-card p-5 border-[var(--color-surface-700)] rounded-lg bg-[var(--color-surface-900)] flex flex-col gap-6">
            <div className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
              When you ask a question, the assistant automatically pulls relevant data from your system database to answer accurately.
            </div>

            <div className="flex flex-col gap-4">
              <div className="p-3 rounded-md border border-[var(--color-surface-700)] bg-[var(--color-surface-800)]">
                <h4 className="text-[11px] uppercase tracking-widest text-[var(--color-brand-400)] font-medium mb-1.5">Hardware & Network</h4>
                <p className="text-[12px] text-[var(--color-text-muted)]">Live CPU, RAM, disk, and bandwidth usage statistics.</p>
              </div>

              <div className="p-3 rounded-md border border-[var(--color-surface-700)] bg-[var(--color-surface-800)]">
                <h4 className="text-[11px] uppercase tracking-widest text-[var(--color-severity-critical)] font-medium mb-1.5">Security & Incidents</h4>
                <p className="text-[12px] text-[var(--color-text-muted)]">Failed logins, audit alerts, and active high-severity incidents.</p>
              </div>

              <div className="p-3 rounded-md border border-[var(--color-surface-700)] bg-[var(--color-surface-800)]">
                <h4 className="text-[11px] uppercase tracking-widest text-[var(--color-severity-high)] font-medium mb-1.5">Performance Events</h4>
                <p className="text-[12px] text-[var(--color-text-muted)]">Process crashes, high memory usage, and thermal throttling events.</p>
              </div>
            </div>
         </div>
      </div>

    </div>
  );
}
