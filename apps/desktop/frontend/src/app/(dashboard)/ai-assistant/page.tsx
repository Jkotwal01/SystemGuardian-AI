"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, User, AlertCircle, Loader2, Cpu, ShieldAlert, Wifi, Sparkles, Activity } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api-client";
import { ChatMessageRead } from "@/lib/types";

const SUGGESTED_PROMPTS = [
  { icon: Cpu, label: "Hardware Status", prompt: "Is my CPU running too hot? What's the current temperature?", color: "text-blue-400", bg: "bg-blue-400/10" },
  { icon: ShieldAlert, label: "Security Check", prompt: "Were there any failed logins or suspicious processes today?", color: "text-rose-400", bg: "bg-rose-400/10" },
  { icon: Activity, label: "Performance", prompt: "Why is my system lagging? Is memory usage high?", color: "text-purple-400", bg: "bg-purple-400/10" },
  { icon: Wifi, label: "Network Check", prompt: "Am I using a lot of bandwidth right now?", color: "text-emerald-400", bg: "bg-emerald-400/10" }
];

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

  useEffect(() => {
    if (!sessionId) return;
    
    const fetchHistory = async () => {
      try {
        const history = await api.chat.getHistory(sessionId);
        if (history.length > 0) {
          setMessages(history);
        }
      } catch (err) {
        console.error("Failed to fetch history", err);
      }
    };
    fetchHistory();
  }, [sessionId]);

  const handleSubmit = async (e?: React.FormEvent, forcedMessage?: string) => {
    if (e) e.preventDefault();
    const userMessage = (forcedMessage || input).trim();
    if (!userMessage || isStreaming || !sessionId) return;

    if (!forcedMessage) setInput("");
    setError(null);

    const userMsgObj: ChatMessageRead = {
      id: "temp-" + Date.now(),
      session_id: sessionId,
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMsgObj]);
    
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: userMessage }),
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
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.chunk) {
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMsgId ? { ...msg, content: msg.content + data.chunk } : msg
              ));
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch (err) {
            console.error("Failed to parse chunk", line, err);
          }
        }
      }
      
    } catch (err: any) {
      setError(err.message || "An error occurred.");
      setMessages(prev => prev.filter(m => m.id !== assistantMsgId)); // Remove empty assistant bubble on error
    } finally {
      setIsStreaming(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    handleSubmit(undefined, prompt);
  };

  return (
    <div className="flex h-full bg-[var(--color-surface-950)] overflow-hidden">
      
      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col relative min-w-0">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-[var(--color-surface-800)] bg-[var(--color-surface-900)]/60 backdrop-blur-md z-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--color-text-primary)] tracking-wide">
                System Guardian AI
              </h2>
              <p className="text-[11px] text-[var(--color-text-muted)]">Real-time intelligent diagnostics</p>
            </div>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto pb-40 scroll-smooth relative">
          
          {messages.length === 0 ? (
            /* ── Empty State ── */
            <div className="h-full flex flex-col items-center justify-center px-4 animate-fade-in mt-[-40px]">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(99,102,241,0.2)]">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300 mb-3 tracking-tight text-center">
                How can I help monitor your system?
              </h1>
              <p className="text-[15px] text-[var(--color-text-muted)] max-w-lg text-center mb-10 leading-relaxed">
                I am actively analyzing your hardware telemetry, security events, and system logs. Ask me anything about your PC's health.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
                {SUGGESTED_PROMPTS.map((sp, i) => (
                  <button
                    key={i}
                    onClick={() => handlePromptClick(sp.prompt)}
                    className="flex flex-col items-start text-left p-5 rounded-2xl glass-card hover:bg-[var(--color-surface-800)] transition-all group border border-[var(--color-surface-700)] hover:border-indigo-500/30"
                  >
                    <div className={`p-2 rounded-lg ${sp.bg} ${sp.color} mb-3 group-hover:scale-110 transition-transform`}>
                      <sp.icon className="w-4 h-4" />
                    </div>
                    <span className="text-[14px] font-semibold text-[var(--color-text-primary)] mb-1">{sp.label}</span>
                    <span className="text-[12px] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors line-clamp-2">"{sp.prompt}"</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Chat Transcript ── */
            <div className="max-w-4xl mx-auto w-full flex flex-col pt-8 px-6 gap-8">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div key={msg.id} className={`flex gap-4 w-full animate-fade-in-up ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                    
                    {/* Avatar */}
                    <div className={`w-10 h-10 flex-shrink-0 rounded-2xl flex items-center justify-center mt-1 shadow-sm ${
                      isUser 
                        ? "bg-gradient-to-br from-zinc-700 to-zinc-800 border border-zinc-600 text-zinc-300" 
                        : "bg-gradient-to-br from-indigo-500/10 to-purple-600/10 border border-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                    }`}>
                      {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    
                    {/* Bubble */}
                    <div className={`flex flex-col min-w-[60px] max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
                      <div className="text-[11px] font-medium text-[var(--color-text-muted)] mb-1.5 px-1">
                        {isUser ? "You" : "System Guardian AI"} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      
                      <div className={`relative px-5 py-3.5 rounded-2xl text-[14px] leading-relaxed shadow-sm ${
                        isUser 
                          ? "bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-tr-sm" 
                          : "bg-[var(--color-surface-900)] border border-[var(--color-surface-700)] text-[var(--color-text-secondary)] rounded-tl-sm"
                      }`}>
                        
                        {msg.role === "assistant" && !msg.content && isStreaming && msg.id.startsWith("temp-asst") ? (
                           <div className="flex items-center gap-2 py-1">
                             <span className="flex gap-1">
                               <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]"></span>
                               <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]"></span>
                               <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"></span>
                             </span>
                           </div>
                        ) : (
                          <div className={`prose prose-sm max-w-none prose-p:leading-relaxed ${
                            isUser 
                              ? "text-white prose-p:text-white" 
                              : "prose-invert prose-pre:bg-[var(--color-surface-950)] prose-pre:border prose-pre:border-[var(--color-surface-700)] prose-a:text-indigo-400 hover:prose-a:text-indigo-300"
                          }`}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* ── Floating Input Area ── */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--color-surface-950)] via-[var(--color-surface-950)] to-transparent pt-12 pb-8 px-6 z-20">
          <div className="max-w-3xl mx-auto w-full relative">
            
            {error && (
              <div className="absolute -top-12 left-0 right-0 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2 text-[12px] font-medium backdrop-blur-md shadow-lg animate-fade-in-up">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative flex flex-col justify-end bg-[var(--color-surface-900)] border border-[var(--color-surface-600)] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 250)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask SystemGuardian anything..."
                className="w-full bg-transparent border-none pt-4 pb-4 pl-5 pr-14 text-[15px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-0 resize-none min-h-[56px] max-h-[250px] leading-relaxed scrollbar-thin scrollbar-thumb-[var(--color-surface-600)]"
                rows={1}
                disabled={isStreaming}
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="absolute right-2.5 bottom-2.5 p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:opacity-90 disabled:opacity-30 disabled:grayscale transition-all shadow-md active:scale-95 flex items-center justify-center h-[36px] w-[36px]"
              >
                <Send className="w-[18px] h-[18px] ml-0.5" />
              </button>
            </form>
            <div className="text-center mt-4">
              <span className="text-[11px] text-[var(--color-text-muted)] font-medium">
                AI can make mistakes. Check important system metrics manually.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Sidebar: Capabilities Showcase ── */}
      <div className="hidden xl:flex w-80 border-l border-[var(--color-surface-800)] bg-[var(--color-surface-900)]/30 flex-col p-8 overflow-y-auto">
        <h3 className="text-[11px] font-bold text-[var(--color-text-secondary)] mb-6 uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" /> Capabilities
        </h3>
        
        <div className="flex flex-col gap-5">
          
          <div className="glass-card p-4 rounded-2xl border border-[var(--color-surface-700)]">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <h4 className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5">
              Live Hardware Diagnostics
            </h4>
            <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
              Fetches up-to-the-second CPU, memory, and thermal data before answering hardware queries.
            </p>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-[var(--color-surface-700)]">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center mb-3">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <h4 className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5">
              Security Event Analysis
            </h4>
            <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
              Analyzes raw Windows Event Logs to summarize failed logins or suspicious background processes.
            </p>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-[var(--color-surface-700)]">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
              <Bot className="w-4 h-4 text-emerald-400" />
            </div>
            <h4 className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5">
              Local Privacy
            </h4>
            <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
              When using Ollama, all analysis happens entirely offline. System data never leaves your machine.
            </p>
          </div>
          
        </div>
      </div>
    </div>
  );
}
