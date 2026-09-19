import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  FileKey2, 
  EyeOff, 
  FileCheck2, 
  CheckCircle2, 
  Server, 
  AlertCircle 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SecurityView: React.FC = () => {
  const { documents } = useApp();

  const encryptedBytes = documents.reduce((acc, d) => acc + (d.file_size_bytes || 0), 0);
  const encryptedMb = (encryptedBytes / (1024 * 1024)).toFixed(2);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner */}
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-brand-400" />
          Zero-Trust Security & Privacy Architecture
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Government documents are protected by cryptography, sandboxed inference, and irreversible redaction policies.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Encrypted Vault Size</span>
            <Lock className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">{encryptedMb} MB</div>
          <p className="text-[11px] text-slate-500 mt-1">Across {documents.length} encrypted vault items</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Cipher Specification</span>
            <FileKey2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">AES-256-GCM</div>
          <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Hardware-accelerated Galois Counter
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>PII Redaction Guardrail</span>
            <EyeOff className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">Zero-Knowledge</div>
          <p className="text-[11px] text-slate-500 mt-1">Aadhaar, RRN & MyNumber strictly masked</p>
        </div>
      </div>

      {/* Security Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <div className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center">
              <EyeOff className="w-4 h-4" />
            </div>
            Strict Identifier Redactions
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Whenever national identity cards are uploaded (such as Indian Aadhaar, Korean Resident Registration Numbers, or Japanese MyNumber), the backend <code className="text-brand-300">sanitize_sensitive_identifiers</code> routine irreversibly redacts digits into placeholders before feeding prompts into any LLM model.
          </p>
          <div className="bg-slate-950 p-3 rounded-xl font-mono text-[11px] text-slate-400 border border-slate-800">
            Example: <span className="text-emerald-400">[Aadhaar Redacted]</span> instead of raw PII.
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            Encrypted Storage Vault
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            All uploaded document files (PDFs, scans, images) are encrypted with AES-256-GCM prior to being written into the user's isolated vault folder on disk. Files cannot be inspected or reconstructed without the master secret key.
          </p>
          <div className="bg-slate-950 p-3 rounded-xl font-mono text-[11px] text-slate-400 border border-slate-800">
            Path: <span className="text-slate-300">backend/data/encrypted_vault/[user_id]/*.enc</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
            Audit Logs & Traceability
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every document upload, deletion, or agent inspection generates an immutable audit record in the database with timestamps and resource IDs, giving users complete accountability over access.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
            Expiration & Renewal Auditor
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            An APScheduler cron service runs in the background of the FastAPI backend to continuously detect documents approaching expiration (within 90 days), alerting users before critical visa or travel dates.
          </p>
        </div>
      </div>
    </div>
  );
};
