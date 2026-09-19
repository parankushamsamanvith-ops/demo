import React from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileWarning, 
  UploadCloud, 
  FileText 
} from 'lucide-react';
import { ChecklistItem } from '../../types';

interface ChecklistCardProps {
  checklist: ChecklistItem[];
  onUploadMissing?: (docType: string) => void;
}

export const ChecklistCard: React.FC<ChecklistCardProps> = ({
  checklist,
  onUploadMissing,
}) => {
  if (!checklist || checklist.length === 0) return null;

  const availableCount = checklist.filter(i => i.status === 'AVAILABLE').length;
  const totalCount = checklist.length;
  const progressPercent = Math.round((availableCount / totalCount) * 100);

  return (
    <div className="w-full bg-slate-900/95 border border-slate-800 rounded-2xl p-4 my-3 shadow-lg">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Procedural Compliance Checklist
          </h4>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-brand-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-slate-300">
            {availableCount}/{totalCount}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {checklist.map((item, idx) => {
          const isAvailable = item.status === 'AVAILABLE';
          const isExpiring = item.status === 'EXPIRING_SOON';
          const isExpired = item.status === 'EXPIRED';
          const isMissing = item.status === 'MISSING';

          return (
            <div
              key={idx}
              className={`p-2.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                isAvailable
                  ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-200'
                  : isExpiring
                  ? 'bg-amber-950/20 border-amber-500/20 text-amber-200'
                  : isExpired
                  ? 'bg-rose-950/20 border-rose-500/20 text-rose-200'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-300'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">
                  {isAvailable && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {isExpiring && <Clock className="w-4 h-4 text-amber-400" />}
                  {isExpired && <FileWarning className="w-4 h-4 text-rose-400" />}
                  {isMissing && <AlertCircle className="w-4 h-4 text-slate-500" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold tracking-wide">
                      {item.doc_type.replace(/_/g, ' ')}
                    </span>
                    {item.title && (
                      <span className="text-[11px] text-slate-400 hidden sm:inline truncate max-w-[200px]">
                        ({item.title})
                      </span>
                    )}
                  </div>
                  {item.notes && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {item.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Status Badge & Action */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    isAvailable
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : isExpiring
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : isExpired
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {item.status.replace(/_/g, ' ')}
                </span>

                {(isMissing || isExpired) && onUploadMissing && (
                  <button
                    onClick={() => onUploadMissing(item.doc_type)}
                    className="flex items-center gap-1 text-[11px] font-semibold bg-brand-600 hover:bg-brand-500 text-white px-2 py-1 rounded-lg transition-all"
                  >
                    <UploadCloud className="w-3 h-3" />
                    Upload
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
