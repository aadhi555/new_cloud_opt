"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Send,
  RotateCcw,
  User,
  GripVertical,
  Cpu,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { sendChatMessage, ChatMessage } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
  warning?: string;
}

const STARTER_PROMPTS = [
  {
    label: "💰 How can we save ₹1.9L this month?",
    prompt: "How can we achieve the ₹1,94,650 potential monthly savings across our Utho fleet?",
  },
  {
    label: "🛡️ Why is payments-db peak-protected?",
    prompt: "Explain why payments-settlement-prod cannot be downsized even though daily average CPU is low.",
  },
  {
    label: "🗑️ Find unattached storage waste",
    prompt: "Which orphaned block storage volumes and idle IPs are causing cost leakage?",
  },
  {
    label: "📈 Explain our 6-month bill creep",
    prompt: "Why has our Utho cloud spend grown by +41.2% over the last 6 months?",
  },
];

export const ChatbotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      role: "model",
      content:
        "Greetings. I am **eDIth** (*Enterprise Diagnostics & Infrastructure Telemetry Hub*) for Utho Cloud 🇮🇳.\n\nI have active telemetry across your **105 cloud resources**, 6-month billing trends, and peak-safety rightsizing bounds. How can I assist your infrastructure today?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Draggable positioning state
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; posX: number; posY: number }>({
    pointerX: 0,
    pointerY: 0,
    posX: 0,
    posY: 0,
  });
  const hasMovedRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Initialize position in bottom-right corner once client mounted
  useEffect(() => {
    if (typeof window !== "undefined") {
      const defaultX = Math.max(20, window.innerWidth - 170);
      const defaultY = Math.max(20, window.innerHeight - 80);
      setPos({ x: defaultX, y: defaultY });
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  // Pointer drag handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only main button
    isDraggingRef.current = true;
    hasMovedRef.current = false;

    const currentX = pos ? pos.x : window.innerWidth - 170;
    const currentY = pos ? pos.y : window.innerHeight - 80;

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: currentX,
      posY: currentY,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.pointerX;
    const deltaY = e.clientY - dragStartRef.current.pointerY;

    if (Math.hypot(deltaX, deltaY) > 5) {
      hasMovedRef.current = true;
    }

    const nextX = dragStartRef.current.posX + deltaX;
    const nextY = dragStartRef.current.posY + deltaY;

    const btnWidth = 140;
    const btnHeight = 48;
    const maxX = Math.max(16, window.innerWidth - btnWidth - 16);
    const maxY = Math.max(16, window.innerHeight - btnHeight - 16);

    setPos({
      x: Math.max(16, Math.min(maxX, nextX)),
      y: Math.max(16, Math.min(maxY, nextY)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    // If user clicked without dragging, toggle chat
    if (!hasMovedRef.current) {
      setIsOpen((prev) => !prev);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const historyPayload: ChatMessage[] = messages
        .filter((m) => m.id !== "welcome-1")
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await sendChatMessage(query, historyPayload);

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: "model",
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        warning: res.warning,
      };

      setMessages((prev) => [...prev, botMsg]);
      if (!isOpen) {
        setUnreadCount((c) => c + 1);
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: "model",
        content: `⚠️ **eDIth Error**: ${err?.message || "Unable to connect to the optimizer API. Please ensure `optimizer-engine-server` is active on port 8002."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "model",
        content:
          "Session refreshed. All telemetry buffers active. Inquire about **Utho Cloud** fleet sizing, peak bounds, or cost containment.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  // Determine chat window placement based on current icon position
  const getChatWindowStyle = () => {
    if (!pos || typeof window === "undefined") {
      return { bottom: "80px", right: "24px" };
    }

    const windowWidth = 440;
    const windowHeight = 580;

    let left = pos.x > window.innerWidth / 2 ? pos.x + 140 - windowWidth : pos.x;
    left = Math.max(16, Math.min(window.innerWidth - windowWidth - 16, left));

    let top = pos.y > window.innerHeight / 2 ? pos.y - windowHeight - 12 : pos.y + 56;
    top = Math.max(16, Math.min(window.innerHeight - windowHeight - 16, top));

    return {
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  return (
    <>
      {/* Draggable eDIth Floating Action Icon (Jet Black, No Shield) */}
      {pos && (
        <div
          ref={buttonRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            position: "fixed",
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            zIndex: 60,
            touchAction: "none",
          }}
          className="select-none cursor-grab active:cursor-grabbing"
          title="Drag anywhere • Click to open eDIth"
        >
          <div className="group relative flex items-center gap-2 px-3.5 py-2.5 bg-black hover:bg-neutral-900 text-white rounded-full shadow-2xl transition-all duration-150 border border-neutral-800 hover:border-neutral-700">
            {/* Grip Handle for Drag Affordance */}
            <GripVertical className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white transition-colors" />

            {/* Glowing Status Dot */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-sm shadow-emerald-300"></span>
            </span>

            {/* Title */}
            <span className="font-mono font-bold text-xs tracking-wider text-white">
              eDIth
            </span>

            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Floating Chat Window (Pure Black Theme) */}
      {isOpen && (
        <div
          style={getChatWindowStyle()}
          className="fixed z-50 w-[94vw] sm:w-[440px] h-[580px] max-h-[85vh] bg-black border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-100 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-black border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white shadow-inner font-mono font-bold text-xs">
                <Cpu className="w-4 h-4 text-neutral-300" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-sm text-white tracking-wide">
                    eDIth
                  </span>
                </div>
                {/* Clean Project Acronym */}
                <span className="text-[10px] text-neutral-400 font-normal tracking-tight">
                  Enterprise Diagnostics & Infrastructure Telemetry Hub
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                title="Reset session"
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize eDIth"
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Container (Pure Black) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm bg-black scrollbar-thin scrollbar-thumb-neutral-800">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300 flex-shrink-0 mt-0.5 text-xs font-mono font-bold">
                      eD
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm text-[13px] leading-relaxed ${
                      isUser
                        ? "bg-neutral-800 text-white rounded-tr-xs border border-neutral-700"
                        : "bg-neutral-900 text-neutral-200 border border-neutral-800 rounded-tl-xs"
                    }`}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <div className="prose prose-invert prose-xs max-w-none space-y-1.5 leading-normal">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                            ul: ({ children }) => (
                              <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
                            ),
                            li: ({ children }) => <li className="text-neutral-300">{children}</li>,
                            strong: ({ children }) => (
                              <strong className="font-semibold text-white">{children}</strong>
                            ),
                            code: ({ children }) => (
                              <code className="bg-neutral-950 px-1 py-0.5 rounded text-[11px] text-neutral-200 border border-neutral-800 font-mono">
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <pre className="bg-neutral-950 p-2.5 rounded-lg text-xs overflow-x-auto border border-neutral-800 font-mono my-2 text-neutral-200">
                                {children}
                              </pre>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    <div
                      className={`text-[10px] mt-1.5 flex items-center gap-1 ${
                        isUser ? "text-neutral-400 justify-end" : "text-neutral-500 justify-start"
                      }`}
                    >
                      <span>{msg.timestamp}</span>
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300 flex-shrink-0 mt-0.5 text-xs font-mono font-bold">
                  eD
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-tl-xs px-4 py-3 flex items-center gap-2 text-neutral-300 text-xs shadow-sm">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-2 h-2 rounded-full bg-neutral-400 animate-pulse"></span>
                    <span className="w-2 h-2 rounded-full bg-neutral-500 animate-pulse delay-150"></span>
                    <span className="w-2 h-2 rounded-full bg-neutral-600 animate-pulse delay-300"></span>
                  </div>
                  <span className="text-[11px] text-neutral-400 ml-1">
                    eDIth analyzing telemetry & rules...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Chips (Black theme) */}
          {messages.length <= 2 && !loading && (
            <div className="px-3.5 py-2 bg-black border-t border-neutral-800 flex flex-col gap-1.5">
              <span className="text-[10px] font-mono font-semibold text-neutral-400 uppercase tracking-wider">
                Quick Insights
              </span>
              <div className="flex flex-wrap gap-1.5">
                {STARTER_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(item.prompt)}
                    className="text-[11px] bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white px-2.5 py-1 rounded-full border border-neutral-800 hover:border-neutral-700 transition-all text-left"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Form (Black theme) */}
          <div className="p-3 bg-black border-t border-neutral-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask eDIth about spend, peak limits, waste..."
                disabled={loading}
                className="flex-1 bg-neutral-950 border border-neutral-800 text-neutral-100 placeholder-neutral-500 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-neutral-600 transition-all"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-950 disabled:text-neutral-600 text-white p-2.5 rounded-xl transition-all shadow-md flex items-center justify-center flex-shrink-0 border border-neutral-700"
                title="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-1.5 px-1 font-mono">
              <span>Utho Cloud Telemetry Engine</span>
              <span>eDIth</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
