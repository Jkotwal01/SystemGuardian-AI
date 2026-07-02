"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, User, AlertCircle, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api-client";
import { ChatMessageRead } from "@/lib/types";

// Remove the global static SESSION_ID, we'll initialize it in state instead
export default function AiAssistantPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
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

  // Initialize Session ID from localStorage or create a new one
  useEffect(() => {
    const stored = localStorage.getItem("system_guardian_chat_session");
    if (stored) {
      setSessionId(stored);
    } else {
      const newId = "session-" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("system_guardian_chat_session", newId);
      setSessionId(newId);
    }
  }, []);

  // Fetch history when session ID is ready
  useEffect(() => {
    if (!sessionId) return;
    
    const fetchHistory = async () => {
      try {
        const history = await api.chat.getHistory(sessionId);
        if (history.length > 0) {
          setMessages(history);
        } else {
          // Add a welcome message
          setMessages([
            {
              id: "welcome",
              session_id: sessionId,
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
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || !sessionId) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);

    // Add user message to UI immediately
    const userMsgObj: ChatMessageRead = {
      id: "temp-" + Date.now(),
      session_id: sessionId,
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
        session_id: sessionId,
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
          session_id: sessionId,
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
    <div className="flex h-full bg-[var(--color-surface-950)] animate-fade-in">
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Header */}
        <div className="flex items-center justify-center py-4 border-b border-[var(--color-surface-800)] bg-[var(--color-surface-900)]/80 backdrop-blur-sm z-10">
          <h2 className="text-[13px] font-medium text-[var(--color-text-primary)] tracking-wide flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-400" /> System Guardian AI
          </h2>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto pb-32">
          <div className="max-w-3xl mx-auto w-full flex flex-col pt-6 px-4">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className="group flex gap-4 py-6 w-full"
              >
                <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center mt-1 border shadow-sm ${
                  msg.role === "user" 
                    ? "bg-[var(--color-surface-800)] border-[var(--color-surface-600)] text-[var(--color-text-secondary)]" 
                    : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                }`}>
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--color-text-primary)] mb-1.5 flex items-center gap-2">
                    {msg.role === "user" ? "You" : "System Guardian AI"}
                    <span className="text-[10px] text-[var(--color-text-muted)] font-normal opacity-0 group-hover:opacity-100 transition-opacity">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
                    {msg.role === "assistant" && !msg.content && isStreaming && msg.id.startsWith("temp-asst") ? (
                       <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
                         <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                       </span>
                    ) : (
                      <div className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-[var(--color-surface-900)] prose-pre:border prose-pre:border-[var(--color-surface-700)] prose-a:text-indigo-400 hover:prose-a:text-indigo-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area (Floating at bottom) */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--color-surface-950)] via-[var(--color-surface-950)] to-transparent pt-10 pb-6 px-4">
          <div className="max-w-3xl mx-auto w-full">
            
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-[hsl(0_84%_60%_/_0.1)] border border-[hsl(0_84%_60%_/_0.2)] text-[var(--color-severity-critical)] flex items-center gap-2 text-[12px] font-medium">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative flex items-end bg-[var(--color-surface-800)] border border-[var(--color-surface-600)] rounded-2xl shadow-lg focus-within:border-[var(--color-surface-500)] focus-within:ring-1 focus-within:ring-[var(--color-surface-500)] transition-all overflow-hidden">
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask about your system's performance, recent security events, or hardware health..."
                className="w-full bg-transparent border-none py-4 pl-5 pr-14 text-[14px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-0 resize-none min-h-[56px] max-h-[200px]"
                rows={1}
                disabled={isStreaming}
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="absolute right-3 bottom-3 p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 transition-colors shadow-sm flex items-center justify-center h-8 w-8"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
            <div className="text-center mt-3">
              <span className="text-[11px] text-[var(--color-text-muted)]">
                AI can make mistakes. Check important system metrics manually.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar: User Guide */}
      <div className="hidden xl:flex w-72 border-l border-[var(--color-surface-800)] bg-[var(--color-surface-900)] flex-col p-6 overflow-y-auto">
        <h3 className="text-[12px] font-semibold text-[var(--color-text-primary)] mb-6 uppercase tracking-wider">
          Capabilities & Use Cases
        </h3>
        
        <div className="flex flex-col gap-6">
          
          <div>
            <h4 className="text-[13px] font-medium text-indigo-400 mb-2 flex items-center gap-2">
              Hardware Performance
            </h4>
            <p className="text-[12px] text-[var(--color-text-muted)] mb-3 leading-relaxed">
              Ask about current CPU usage, memory consumption, battery, or thermal issues.
            </p>
            <div className="bg-[var(--color-surface-950)] border border-[var(--color-surface-800)] p-2 rounded text-[11px] text-[var(--color-text-secondary)] italic">
              "Is my CPU running too hot?"
            </div>
          </div>

          <div>
            <h4 className="text-[13px] font-medium text-[var(--color-severity-critical)] mb-2 flex items-center gap-2">
              Security & Incidents
            </h4>
            <p className="text-[12px] text-[var(--color-text-muted)] mb-3 leading-relaxed">
              Query recent failed logins, malicious activities, or review active critical alerts.
            </p>
            <div className="bg-[var(--color-surface-950)] border border-[var(--color-surface-800)] p-2 rounded text-[11px] text-[var(--color-text-secondary)] italic">
              "Were there any failed logins today?"
            </div>
          </div>

          <div>
            <h4 className="text-[13px] font-medium text-[var(--color-brand-400)] mb-2 flex items-center gap-2">
              Network & Storage
            </h4>
            <p className="text-[12px] text-[var(--color-text-muted)] mb-3 leading-relaxed">
              Check if you're running low on disk space or if something is hogging your bandwidth.
            </p>
            <div className="bg-[var(--color-surface-950)] border border-[var(--color-surface-800)] p-2 rounded text-[11px] text-[var(--color-text-secondary)] italic">
              "Why is my internet so slow?"
            </div>
          </div>
          
          <div className="mt-4 pt-6 border-t border-[var(--color-surface-800)]">
             <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
               The AI automatically fetches real-time diagnostic data from your system before answering your questions to give you highly accurate insights.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
