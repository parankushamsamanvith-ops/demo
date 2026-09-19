import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DocumentItem, BureaucraticTask, AppSettings } from '../types';
import { apiService } from '../services/api';

interface AppContextType {
  documents: DocumentItem[];
  tasks: BureaucraticTask[];
  activeTaskId: string | null;
  backendStatus: 'online' | 'offline' | 'checking';
  backendVersion?: string;
  demoMode: boolean;
  settings: AppSettings;
  isUploading: boolean;
  refreshDocuments: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  uploadDocument: (file: File) => Promise<DocumentItem>;
  deleteDocument: (id: string) => Promise<void>;
  setActiveTaskId: (id: string | null) => void;
  setDemoMode: (enabled: boolean) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  checkConnection: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [tasks, setTasks] = useState<BureaucraticTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [backendVersion, setBackendVersion] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [demoMode, setDemoModeState] = useState<boolean>(apiService.isDemoMode());

  const [settings, setSettings] = useState<AppSettings>({
    apiBaseUrl: apiService.getBaseUrl(),
    geminiApiKey: localStorage.getItem('civix_gemini_key') || '',
    demoMode: apiService.isDemoMode(),
  });

  const checkConnection = useCallback(async () => {
    setBackendStatus('checking');
    const health = await apiService.checkHealth();
    if (health.online) {
      setBackendStatus('online');
      setBackendVersion(health.version);
    } else {
      setBackendStatus('offline');
    }
  }, []);

  const refreshDocuments = useCallback(async () => {
    try {
      const docs = await apiService.getDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }, []);

  const refreshTasks = useCallback(async () => {
    try {
      const t = await apiService.getTasks();
      setTasks(t);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }, []);

  useEffect(() => {
    checkConnection();
    refreshDocuments();
    refreshTasks();

    const interval = setInterval(() => {
      checkConnection();
    }, 15000);
    return () => clearInterval(interval);
  }, [checkConnection, refreshDocuments, refreshTasks]);

  const uploadDocument = async (file: File): Promise<DocumentItem> => {
    setIsUploading(true);
    try {
      const doc = await apiService.uploadDocument(file);
      await refreshDocuments();
      return doc;
    } finally {
      setIsUploading(false);
    }
  };

  const deleteDocument = async (id: string): Promise<void> => {
    await apiService.deleteDocument(id);
    await refreshDocuments();
  };

  const setDemoMode = (enabled: boolean) => {
    apiService.setDemoMode(enabled);
    setDemoModeState(enabled);
    setSettings(prev => ({ ...prev, demoMode: enabled }));
    refreshDocuments();
    refreshTasks();
    checkConnection();
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    if (newSettings.apiBaseUrl) {
      apiService.setBaseUrl(newSettings.apiBaseUrl);
    }
    if (newSettings.geminiApiKey !== undefined) {
      localStorage.setItem('civix_gemini_key', newSettings.geminiApiKey);
    }
    if (newSettings.demoMode !== undefined) {
      setDemoMode(newSettings.demoMode);
    }
    setSettings(prev => ({ ...prev, ...newSettings }));
    checkConnection();
  };

  return (
    <AppContext.Provider
      value={{
        documents,
        tasks,
        activeTaskId,
        backendStatus,
        backendVersion,
        demoMode,
        settings,
        isUploading,
        refreshDocuments,
        refreshTasks,
        uploadDocument,
        deleteDocument,
        setActiveTaskId,
        setDemoMode,
        updateSettings,
        checkConnection,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
