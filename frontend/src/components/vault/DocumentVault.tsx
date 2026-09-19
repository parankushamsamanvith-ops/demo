import React, { useState } from 'react';
import { 
  FolderLock, 
  Search, 
  Trash2, 
  Lock, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  FileText, 
  UploadCloud, 
  Plus, 
  ShieldCheck 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DocumentCategory, DocumentItem } from '../../types';

interface DocumentVaultProps {
  onOpenUpload: () => void;
}

const CATEGORIES: { id: DocumentCategory | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'All Documents' },
  { id: 'IDENTITY', label: 'Identity' },
  { id: 'TRAVEL', label: 'Travel & Visa' },
  { id: 'TAXATION', label: 'Tax & Finance' },
  { id: 'EDUCATION', label: 'Education' },
  { id: 'CIVIL', label: 'Civil Registry' },
];

export const DocumentVault: React.FC<DocumentVaultProps> = ({ onOpenUpload }) => {
  const { documents, deleteDocument } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredDocs = documents.filter((doc) => {
    const matchesCategory = selectedCategory === 'ALL' || doc.category === selectedCategory;
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.doc_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.issuing_country && doc.issuing_country.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to permanently delete this document from your encrypted vault?')) {
      setDeletingId(id);
      try {
        await deleteDocument(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderLock className="w-5 h-5 text-brand-400" />
            Encrypted Document Vault
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Zero-knowledge, AES-256 client/server protected repository used by the agent during audits.
          </p>
        </div>

        <button
          onClick={onOpenUpload}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/25 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Secure New Document
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Documents Grid */}
      {filteredDocs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            const isExpiring = doc.status === 'EXPIRING_SOON';
            const isExpired = doc.status === 'EXPIRED';

            return (
              <div
                key={doc.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                      {doc.doc_type}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {doc.issuing_country && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                          {doc.issuing_country}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isExpired
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : isExpiring
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {isExpired ? (
                          <AlertTriangle className="w-2.5 h-2.5" />
                        ) : isExpiring ? (
                          <Clock className="w-2.5 h-2.5" />
                        ) : (
                          <CheckCircle2 className="w-2.5 h-2.5" />
                        )}
                        {doc.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-white mb-1 truncate">
                    {doc.title}
                  </h3>

                  {/* Document Number with Privacy Redaction */}
                  {doc.document_number && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                      <Lock className="w-3 h-3 text-brand-400 shrink-0" />
                      <span className="font-mono text-slate-300 text-[11px] truncate">
                        {doc.document_number}
                      </span>
                    </div>
                  )}

                  {/* Expiration Details */}
                  <div className="text-[11px] text-slate-400 space-y-1 mb-3">
                    {doc.issue_date && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>Issued: {doc.issue_date}</span>
                      </div>
                    )}
                    {doc.expiry_date && (
                      <div
                        className={`flex items-center gap-1.5 ${
                          isExpired ? 'text-rose-400 font-semibold' : isExpiring ? 'text-amber-400' : ''
                        }`}
                      >
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>Expires: {doc.expiry_date}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 font-mono text-[10px]">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    AES-256 GCM
                  </span>

                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all opacity-80 group-hover:opacity-100"
                    title="Delete document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">No documents found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Upload your passport, identity proof, academic degrees, or tax forms to enable automated audit matching.
          </p>
          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md"
          >
            <UploadCloud className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      )}
    </div>
  );
};
