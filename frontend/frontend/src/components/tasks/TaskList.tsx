import React from 'react';
import { 
  Layers, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  FileCheck2, 
  Calendar, 
  Plus 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BureaucraticTask } from '../../types';

interface TaskListProps {
  onSelectTask: (task: BureaucraticTask) => void;
  onNewProcedure: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  onSelectTask,
  onNewProcedure,
}) => {
  const { tasks } = useApp();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-400" />
            Tracked Applications & Procedures
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time compliance checkpoints monitored by the bureaucracy agent.
          </p>
        </div>

        <button
          onClick={onNewProcedure}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/25 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Start New Procedure
        </button>
      </div>

      {/* Task Cards */}
      {tasks.length > 0 ? (
        <div className="space-y-4">
          {tasks.map((task) => {
            const availableCount = task.checklist_state.filter(
              (i) => i.status === 'AVAILABLE'
            ).length;
            const totalCount = task.checklist_state.length;
            const isReady = task.status === 'READY_TO_SUBMIT' || (totalCount > 0 && availableCount === totalCount);
            const percent = totalCount > 0 ? Math.round((availableCount / totalCount) * 100) : 0;

            return (
              <div
                key={task.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      {task.target_country && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-400 border border-brand-500/20">
                          {task.target_country}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                          isReady
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isReady ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-white">
                      {task.task_name}
                    </h3>
                  </div>

                  {/* Readiness Progress Bar */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-200">
                        {availableCount} of {totalCount} Ready
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {percent}% Prerequisite match
                      </p>
                    </div>

                    <button
                      onClick={() => onSelectTask(task)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-brand-600 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 hover:border-brand-500 transition-all shadow-sm shrink-0"
                    >
                      <span>Resume in Agent</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Checklist Preview Pills */}
                {task.checklist_state.length > 0 && (
                  <div className="pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Required Documents Status
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {task.checklist_state.map((item, idx) => {
                        const isAvail = item.status === 'AVAILABLE';
                        const isExp = item.status === 'EXPIRING_SOON';
                        const isExpd = item.status === 'EXPIRED';

                        return (
                          <span
                            key={idx}
                            className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 font-medium ${
                              isAvail
                                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                                : isExp
                                ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                                : isExpd
                                ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                                : 'bg-slate-950/50 border-slate-800 text-slate-400'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {item.doc_type.replace(/_/g, ' ')}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">No active applications tracked yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Ask the AI Navigator to evaluate your procedure (e.g. Visa, Passport, Tax) to automatically generate tracked checklists.
          </p>
          <button
            onClick={onNewProcedure}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md"
          >
            Start Inquiry with AI
          </button>
        </div>
      )}
    </div>
  );
};
