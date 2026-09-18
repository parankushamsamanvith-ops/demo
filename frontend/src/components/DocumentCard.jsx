import React from "react";
import { FileText, Trash2 } from "lucide-react";
import ReminderBadge from "./ReminderBadge";

export default function DocumentCard({ doc, onDelete }) {
  return (
    <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-lg flex flex-col gap-2 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-100 line-clamp-1">{doc.title}</span>
        </div>
        <button
          onClick={() => onDelete(doc.id)}
          className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
          title="Delete document"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded text-slate-300">
          {doc.doc_type}
        </span>
        <ReminderBadge status={doc.status} />
      </div>

      <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-700/40">
        <span>Expiry: {doc.expiry_date || "N/A"}</span>
        <span className="truncate max-w-[130px]">{doc.document_number || "Masked"}</span>
      </div>
    </div>
  );
}