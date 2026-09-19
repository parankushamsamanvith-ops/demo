import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  Paperclip, 
  FileCheck2, 
  ArrowRight, 
  CheckCircle2, 
  RefreshCw 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiService } from '../../services/api';
import { ChatMessage, AgentNode, ChecklistItem } from '../../types';
import { StateStepper } from './StateStepper';
import { ChecklistCard } from './ChecklistCard';

const QUICK_PROMPTS = [
  {
    label: '🇩🇪 German Student Visa (§16b)',
    prompt: 'I want to apply for a German National Student Visa under Section 16b. What are the rules and do I have the required documents?',
  },
  {
    label: '🇮🇳 Indian Passport Renewal',
    prompt: 'I need to renew my Indian passport under the normal scheme. Check my vault for necessary paperwork.',
  },
  {
    label: '🇪🇺 Schengen Tourist Visa',
    prompt: 'What documents are required for a Schengen 90-day tourist visa and what is missing in my vault?',
  },
  {
    label: '🇺🇸 US H-1B Document Check',
    prompt: 'Audit my documents for an upcoming US work visa stamping appointment.',
  },
];

interface AgentChatProps {
  onOpenUpload: (suggestedType?: string) => void;
}

export const AgentChat: React.FC<AgentChatProps> = ({ onOpenUpload }) => {
  const { activeTaskId, setActiveTaskId, refreshTasks } = useApp();
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `### Welcome to Civix AI Navigator
I am your autonomous bureaucratic assistant. I can interpret immigration rules, cross-reference your **encrypted document vault**, identify missing prerequisites, and guide you through administrative procedures.

Select a quick workflow below or describe your procedure:`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentNode, setCurrentNode] = useState<AgentNode>('idle');
  const [detectedTopic, setDetectedTopic] = useState<string | undefined>();
  const [detectedCountry, setDetectedCountry] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentNode]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isStreaming) return;

    setInputMessage('');
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;

    // Add user message
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Add initial placeholder assistant message
    const assistantPlaceholder: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantPlaceholder]);
    setIsStreaming(true);
    setCurrentNode('parse_intent');

    let currentChecklist: ChecklistItem[] = [];

    await apiService.streamChat(query, activeTaskId, {
      onNodeUpdate: (node, data) => {
        setCurrentNode(node);

        if (node === 'parse_intent') {
          if (data?.procedure_topic) setDetectedTopic(data.procedure_topic);
          if (data?.target_country) setDetectedCountry(data.target_country);
        }

        if (node === 'audit_vault' && data?.checklist) {
          currentChecklist = data.checklist;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId ? { ...m, checklist: currentChecklist } : m
            )
          );
        }

        if (node === 'synthesize_guidance' && data?.answer) {
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: data.answer, isStreaming: true }
                : m
            )
          );
        }
      },
      onTaskCreated: (newTaskId) => {
        setActiveTaskId(newTaskId);
        refreshTasks();
      },
      onComplete: (fullAnswer) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: fullAnswer || m.content,
                  isStreaming: false,
                  checklist: currentChecklist.length > 0 ? currentChecklist : m.checklist,
                }
              : m
          )
        );
        setIsStreaming(false);
        setCurrentNode('idle');
      },
      onError: (errorMsg) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: `⚠️ Encountered an issue connecting to the AI agent: ${errorMsg}. Please ensure the backend is running with a valid GEMINI_API_KEY.`,
                  isStreaming: false,
                }
              : m
          )
        );
        setIsStreaming(false);
        setCurrentNode('idle');
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-5xl mx-auto w-full px-2 sm:px-4 py-3">
      {/* State Stepper (Active during LangGraph execution) */}
      <StateStepper
        currentNode={currentNode}
        detectedTopic={detectedTopic}
        detectedCountry={detectedCountry}
      />

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 sm:pr-2 pb-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 animate-fade-in ${
                isUser ? 'justify-end' : 'justify-start'
              }`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-md shadow-brand-500/20">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-4 shadow-sm ${
                  isUser
                    ? 'bg-brand-600 text-white rounded-tr-sm'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm'
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-1">
                  <span className="text-[11px] font-bold tracking-wider uppercase opacity-70">
                    {isUser ? 'You' : 'Civix AI Navigator'}
                  </span>
                  <span className="text-[10px] opacity-50 font-mono">
                    {msg.timestamp}
                  </span>
                </div>

                {/* Message Body */}
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {msg.content}
                  {msg.isStreaming && !msg.content && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-brand-400 py-1">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Auditing regulations & encrypted vault...
                    </span>
                  )}
                </div>

                {/* Inline Checklist if present */}
                {msg.checklist && msg.checklist.length > 0 && (
                  <ChecklistCard
                    checklist={msg.checklist}
                    onUploadMissing={onOpenUpload}
                  />
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts (when idle) */}
      {!isStreaming && messages.length <= 2 && (
        <div className="py-2">
          <p className="text-[11px] uppercase font-bold text-slate-500 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-brand-400" />
            Recommended Procedures
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(qp.prompt)}
                className="text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-brand-500/40 text-slate-300 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span>{qp.label}</span>
                <ArrowRight className="w-3 h-3 text-slate-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Input Bar */}
      <div className="pt-2">
        <div className="relative rounded-2xl bg-slate-900/90 border border-slate-800 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500/50 shadow-xl backdrop-blur-md transition-all">
          <textarea
            rows={2}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about immigration rules, visa steps, or audit your document readiness..."
            disabled={isStreaming}
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 p-3 pr-24 resize-none focus:outline-none disabled:opacity-50"
          />

          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenUpload()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
              title="Upload document to vault"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isStreaming}
              className={`p-2 rounded-xl flex items-center justify-center transition-all ${
                inputMessage.trim() && !isStreaming
                  ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-center text-slate-500 mt-1.5">
          🔒 Private & Confidential • Strict AES-256 Vault Encryption • Zero-Knowledge Redactions Active
        </p>
      </div>
    </div>
  );
};
