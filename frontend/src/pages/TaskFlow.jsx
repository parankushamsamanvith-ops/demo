import React from "react";
import { Sparkles, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export default function TaskFlow({ activeTask, checklist }) {
  if (!activeTask?.topic) return null;

  return (
    <div className="bg-slate-900 border-b border-slate-800 p-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
          {activeTask.topic} {activeTask.country ? `(${activeTask.country})` : ""}
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto">
        {checklist.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded text-xs border border-slate-700/60"
          >
            {item.status === "AVAILABLE" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            {item.status === "EXPIRING_SOON" && <Clock className="w-3.5 h-3.5 text-amber-400" />}
            {item.status === "MISSING" && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
            <span className="font-mono text-slate-300 text-[11px]">{item.doc_type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}