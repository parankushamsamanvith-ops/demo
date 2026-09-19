import React from 'react';
import { 
  Compass, 
  Search, 
  ShieldAlert, 
  FileCheck2, 
  Check, 
  Loader2 
} from 'lucide-react';
import { AgentNode } from '../../types';

interface StateStepperProps {
  currentNode: AgentNode;
  detectedTopic?: string;
  detectedCountry?: string;
}

interface StepItem {
  id: AgentNode;
  label: string;
  desc: string;
  icon: React.ElementType;
}

const STEPS: StepItem[] = [
  {
    id: 'parse_intent',
    label: 'Intent & Entity',
    desc: 'Extracts goal & jurisdiction ISO',
    icon: Compass,
  },
  {
    id: 'retrieve_rules',
    label: 'RAG Knowledge',
    desc: 'Queries administrative directives',
    icon: Search,
  },
  {
    id: 'audit_vault',
    label: 'Vault Audit',
    desc: 'Checks validity & missing records',
    icon: ShieldAlert,
  },
  {
    id: 'synthesize_guidance',
    label: 'Roadmap Synthesis',
    desc: 'Generates step-by-step guidance',
    icon: FileCheck2,
  },
];

export const StateStepper: React.FC<StateStepperProps> = ({
  currentNode,
  detectedTopic,
  detectedCountry,
}) => {
  if (currentNode === 'idle') return null;

  const getStepStatus = (stepId: AgentNode) => {
    const order: AgentNode[] = ['parse_intent', 'retrieve_rules', 'audit_vault', 'synthesize_guidance'];
    const currentIndex = order.indexOf(currentNode);
    const stepIndex = order.indexOf(stepId);

    if (currentIndex === -1) return 'waiting';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'waiting';
  };

  return (
    <div className="w-full bg-slate-900/90 border border-brand-500/30 rounded-2xl p-4 mb-4 shadow-xl backdrop-blur-md animate-fade-in">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-400 animate-ping" />
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-300">
            LangGraph Agent State Machine
          </span>
        </div>
        {detectedCountry && (
          <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
            <span className="text-slate-400 font-mono text-[10px]">ISO:</span>
            <span className="font-bold text-brand-300">{detectedCountry}</span>
            {detectedTopic && (
              <span className="text-slate-400 truncate max-w-[140px] sm:max-w-xs">
                • {detectedTopic}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {STEPS.map((step) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                status === 'active'
                  ? 'bg-brand-950/60 border-brand-500/80 shadow-md shadow-brand-500/10'
                  : status === 'completed'
                  ? 'bg-slate-900/50 border-emerald-500/40 text-slate-300'
                  : 'bg-slate-950/30 border-slate-800/60 text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    status === 'active'
                      ? 'bg-brand-500/20 text-brand-300'
                      : status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>

                {status === 'active' ? (
                  <Loader2 className="w-3.5 h-3.5 text-brand-400 animate-spin" />
                ) : status === 'completed' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                )}
              </div>

              <div>
                <p className={`text-xs font-semibold ${status === 'active' ? 'text-brand-200' : ''}`}>
                  {step.label}
                </p>
                <p className="text-[10px] text-slate-400 leading-tight truncate">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
