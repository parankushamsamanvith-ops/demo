import React from 'react';
import { 
  ShieldCheck, 
  FolderLock, 
  Sparkles, 
  Settings, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Upload,
  Layers,
  FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface HeaderProps {
  activeTab: 'agent' | 'vault' | 'tasks' | 'security';
  setActiveTab: (tab: 'agent' | 'vault' | 'tasks' | 'security') => void;
  onOpenUpload: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenUpload,
  onOpenSettings,
}) => {
  const { backendStatus, backendVersion, demoMode, documents, tasks } = useApp();

  const expiringCount = documents.filter(d => d.status === 'EXPIRING_SOON').length;
  const expiredCount = documents.filter(d => d.status === 'EXPIRED').length;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-400 p-[1px] shadow-lg shadow-brand-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-brand-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  Civix<span className="text-brand-400">AI</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  Agentic OS
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Bureaucratic Intelligence & Encrypted Vault
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('agent')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'agent'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Navigator
            </button>

            <button
              onClick={() => setActiveTab('vault')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'vault'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FolderLock className="w-3.5 h-3.5" />
              Document Vault
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                {documents.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'tasks'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Applications
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                {tasks.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'security'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Security
            </button>
          </nav>

          {/* Right Action Items & Status */}
          <div className="flex items-center gap-3">
            {/* Status Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  demoMode
                    ? 'bg-amber-400 animate-pulse'
                    : backendStatus === 'online'
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-rose-400'
                }`}
              />
              <span className="text-slate-300 font-medium text-[11px]">
                {demoMode
                  ? 'Demo Mode'
                  : backendStatus === 'online'
                  ? `FastAPI v${backendVersion || '1.0'}`
                  : 'Offline (Fallback)'}
              </span>
            </div>

            {/* Expiring documents alert badge if any */}
            {(expiringCount > 0 || expiredCount > 0) && (
              <div 
                onClick={() => setActiveTab('vault')}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs cursor-pointer hover:bg-amber-500/20 transition-all"
                title={`${expiredCount} expired, ${expiringCount} expiring soon`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>{expiringCount + expiredCount} Alert</span>
              </div>
            )}

            {/* Quick Upload Button */}
            <button
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-all shadow-sm"
            >
              <Upload className="w-3.5 h-3.5 text-brand-400" />
              <span className="hidden sm:inline">Upload Doc</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all"
              title="API Keys & Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex border-t border-slate-800/80 bg-slate-900/60 px-2 py-1.5 justify-around">
        <button
          onClick={() => setActiveTab('agent')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[11px] ${
            activeTab === 'agent' ? 'text-brand-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Agent
        </button>
        <button
          onClick={() => setActiveTab('vault')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[11px] ${
            activeTab === 'vault' ? 'text-brand-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <FolderLock className="w-4 h-4" />
          Vault ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[11px] ${
            activeTab === 'tasks' ? 'text-brand-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Layers className="w-4 h-4" />
          Tasks ({tasks.length})
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[11px] ${
            activeTab === 'security' ? 'text-brand-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Security
        </button>
      </div>
    </header>
  );
};
