export type DocumentCategory = 'IDENTITY' | 'TAXATION' | 'TRAVEL' | 'EDUCATION' | 'CIVIL' | 'OTHER';

export type DocumentStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'PENDING_VERIFICATION';

export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'WAITING_DOCUMENTS' | 'READY_TO_SUBMIT' | 'COMPLETED' | 'FAILED';

export interface DocumentItem {
  id: string;
  title: string;
  doc_type: string;
  category: DocumentCategory;
  issuing_country?: string | null;
  document_number?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  status: DocumentStatus;
  file_mime_type: string;
  file_size_bytes: number;
}

export interface ChecklistItem {
  doc_type: string;
  status: 'AVAILABLE' | 'MISSING' | 'EXPIRING_SOON' | 'EXPIRED';
  doc_id?: string | null;
  title?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
}

export interface BureaucraticTask {
  id: string;
  task_name: string;
  target_country?: string | null;
  status: TaskStatus;
  checklist_state: ChecklistItem[];
  deadline?: string | null;
}

export type AgentNode = 'idle' | 'parse_intent' | 'retrieve_rules' | 'audit_vault' | 'synthesize_guidance';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  activeNode?: AgentNode;
  detectedProcedure?: {
    topic?: string;
    country?: string;
  };
  requiredDocs?: string[];
  checklist?: ChecklistItem[];
  isStreaming?: boolean;
}

export interface AppSettings {
  apiBaseUrl: string;
  geminiApiKey?: string;
  demoMode: boolean;
}
