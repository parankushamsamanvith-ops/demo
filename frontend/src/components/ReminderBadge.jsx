import React from "react";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

export default function ReminderBadge({ status }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle className="w-3 h-3" /> Valid
      </span>
    );
  }
  if (status === "EXPIRING_SOON") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <AlertTriangle className="w-3 h-3" /> Expiring Soon
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
      <XCircle className="w-3 h-3" /> Expired
    </span>
  );
}