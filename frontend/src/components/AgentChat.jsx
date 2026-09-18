import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";

export default function AgentChat({ messages, isStreaming, currentNode, onSend }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentNode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || isStreaming) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 max-w-2xl ${
              m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                m.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-800 text-indigo-400 border border-slate-700"
              }`}
            >
              {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div
              className={`p-3.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-900 border border-slate-800 text-slate-200"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {isStreaming && currentNode && (
          <div className="flex items-center gap-2 p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-indigo-300 max-w-sm">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span>
              {currentNode === "parse_intent" && "Identifying procedure & jurisdiction..."}
              {currentNode === "retrieve_rules" && "Querying official guidelines via RAG..."}
              {currentNode === "audit_vault" && "Cross-referencing your encrypted documents..."}
              {currentNode === "synthesize_guidance" && "Drafting actionable plan..."}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800 bg-slate-900/60 flex gap-2">
        <input
          type="text"
          className="flex-1 bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none"
          placeholder="Ask for procedure requirements or instruction..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !text.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors"
        >
          <Send className="w-4 h-4" /> Send
        </button>
      </form>
    </div>
  );
}