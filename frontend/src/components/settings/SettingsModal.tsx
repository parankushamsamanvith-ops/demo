import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Key, 
  Server, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Sparkles, 
  Database,
  ExternalLink 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { 
    settings, 
    updateSettings, 
    backendStatus, 
    backendVersion, 
    checkConnection, 
    demoMode, 
    setDemoMode 
  } = useApp();

  const [apiUrl, setApiUrl] = useState(settings.apiBaseUrl);
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKey || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    updateSettings({
      apiBaseUrl: apiUrl,
      geminiApiKey: geminiKey,
    });
    onClose();
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await checkConnection();
      if (backendStatus === 'online' || !demoMode) {
        setTestResult({
          success: true,
          message: `Connection successful! FastAPI ${backendVersion || 'v1.0.0'} online.`,
        });
      } else {
        setTestResult({
          success: false,
          message: 'Backend server at this URL did not respond.',
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Failed to connect to backend.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-800 text-brand-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                API Configuration & Keys
              </h3>
              <p className="text-xs text-slate-400">
                Backend connectivity & Gemini LLM settings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="py-5 space-y-5">
          {/* Demo Mode Toggle */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Interactive Simulation / Demo Mode
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Experience full streaming UI even when FastAPI or Postgres are offline.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={demoMode}
                onChange={(e) => setDemoMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
            </label>
          </div>

          {/* Backend API Base URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-brand-400" />
              FastAPI Endpoint URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8000/api/v1"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 font-mono"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center gap-1.5"
              >
                {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Ping'}
              </button>
            </div>
            {testResult && (
              <p className={`text-[11px] flex items-center gap-1 mt-1 ${testResult.success ? 'text-emerald-400' : 'text-amber-400'}`}>
                {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {testResult.message}
              </p>
            )}
          </div>

          {/* Google Gemini API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-brand-400" />
                Google Gemini API Key
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-brand-400 hover:underline flex items-center gap-1"
              >
                Get API Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 font-mono"
            />
            <p className="text-[11px] text-slate-500">
              Saved securely to your backend environment file (<code className="text-slate-400">backend/.env</code>).
            </p>
          </div>

          {/* Backend Info Alert */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3.5 text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1">
              <Database className="w-3.5 h-3.5 text-brand-400" />
              Backend Location
            </div>
            <p className="font-mono text-[11px] text-slate-400 break-all">
              C:\Users\rehan\OneDrive\Documents\project\demo\backend
            </p>
            <p className="text-[10px] text-slate-500 pt-1">
              To launch backend: <code className="text-brand-300 bg-slate-900 px-1 py-0.5 rounded">uvicorn app.main:app --reload</code>
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/25 transition-all"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
