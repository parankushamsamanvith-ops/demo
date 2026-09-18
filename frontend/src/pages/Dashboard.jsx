import React from "react";
import Vault from "./Vault";
import TaskFlow from "./TaskFlow";
import AgentChat from "../components/AgentChat";
import { useDocuments } from "../hooks/useDocuments";
import { useAgentStream } from "../hooks/useAgentStream";

export default function Dashboard() {
  const { documents, uploadDoc, removeDoc, refresh } = useDocuments();
  const { messages, currentNode, isStreaming, checklist, activeTask, sendMessage } = useAgentStream();

  const handleSend = (text) => {
    sendMessage(text, activeTask?.id);
    refresh();
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      <div className="w-80 flex-shrink-0 h-full">
        <Vault documents={documents} onUpload={uploadDoc} onDelete={removeDoc} />
      </div>

      <div className="flex-1 flex flex-col h-full">
        <TaskFlow activeTask={activeTask} checklist={checklist} />
        <div className="flex-1 overflow-hidden">
          <AgentChat
            messages={messages}
            isStreaming={isStreaming}
            currentNode={currentNode}
            onSend={handleSend}
          />
        </div>
      </div>
    </div>
  );
}