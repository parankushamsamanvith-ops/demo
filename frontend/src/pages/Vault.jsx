import React, { useState } from "react";
import { UploadCloud, ShieldCheck } from "lucide-react";
import DocumentCard from "../components/DocumentCard";

export default function Vault({ documents, onUpload, onDelete }) {
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      await onUpload(file);
    } catch (err) {
      setErrorMsg(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 p-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" /> Vault
          </h2>
          <p className="text-[11px] text-slate-400">AES-256 Encrypted</p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 bg-slate-800 text-slate-300 rounded">
          {documents.length} Items
        </span>
      </div>

      <div className="my-3">
        <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl cursor-pointer bg-slate-800/40 transition-all">
          <UploadCloud className="w-6 h-6 text-indigo-400 mb-1" />
          <span className="text-xs text-slate-200">{uploading ? "Analyzing & Encrypting..." : "Upload Document"}</span>
          <span className="text-[10px] text-slate-400">PDF, PNG, JPG (Auto-OCR)</span>
          <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" disabled={uploading} onChange={handleUpload} />
        </label>
        {errorMsg && <p className="text-xs text-rose-400 mt-1">{errorMsg}</p>}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {documents.length === 0 ? (
          <p className="text-center py-8 text-slate-500 text-xs">No documents stored.</p>
        ) : (
          documents.map((doc) => <DocumentCard key={doc.id} doc={doc} onDelete={onDelete} />)
        )}
      </div>
    </div>
  );
}