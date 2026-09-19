import React, { useState } from 'react';
import { Header } from './components/layout/Header';
import { AgentChat } from './components/agent/AgentChat';
import { DocumentVault } from './components/vault/DocumentVault';
import { TaskList } from './components/tasks/TaskList';
import { SecurityView } from './components/security/SecurityView';
import { UploadModal } from './components/vault/UploadModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { useApp } from './context/AppContext';
import { BureaucraticTask } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agent' | 'vault' | 'tasks' | 'security'>('agent');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [uploadTargetType, setUploadTargetType] = useState<string | undefined>(undefined);

  const { setActiveTaskId } = useApp();

  const handleOpenUpload = (suggestedType?: string) => {
    setUploadTargetType(suggestedType);
    setIsUploadOpen(true);
  };

  const handleSelectTask = (task: BureaucraticTask) => {
    setActiveTaskId(task.id);
    setActiveTab('agent');
  };

  const handleStartNewProcedure = () => {
    setActiveTaskId(null);
    setActiveTab('agent');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-brand-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[130px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navigation & Status Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenUpload={() => handleOpenUpload()}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Tabbed Content */}
        <main className="flex-1 flex flex-col">
          {activeTab === 'agent' && (
            <AgentChat onOpenUpload={handleOpenUpload} />
          )}

          {activeTab === 'vault' && (
            <DocumentVault onOpenUpload={() => handleOpenUpload()} />
          )}

          {activeTab === 'tasks' && (
            <TaskList
              onSelectTask={handleSelectTask}
              onNewProcedure={handleStartNewProcedure}
            />
          )}

          {activeTab === 'security' && (
            <SecurityView />
          )}
        </main>
      </div>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setUploadTargetType(undefined);
        }}
        initialDocType={uploadTargetType}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default App;
