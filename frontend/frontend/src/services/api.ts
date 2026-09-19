import { DocumentItem, BureaucraticTask, AgentNode, ChecklistItem } from '../types';
import { INITIAL_MOCK_DOCUMENTS, INITIAL_MOCK_TASKS } from './mockData';

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export class ApiService {
  private baseUrl: string = DEFAULT_BASE_URL;
  private demoMode: boolean = false;

  constructor() {
    const savedUrl = localStorage.getItem('civix_api_url');
    if (savedUrl) this.baseUrl = savedUrl;

    const savedDemo = localStorage.getItem('civix_demo_mode');
    if (savedDemo !== null) this.demoMode = savedDemo === 'true';
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
    localStorage.setItem('civix_api_url', this.baseUrl);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setDemoMode(enabled: boolean) {
    this.demoMode = enabled;
    localStorage.setItem('civix_demo_mode', String(enabled));
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }

  async checkHealth(): Promise<{ online: boolean; version?: string }> {
    if (this.demoMode) {
      return { online: true, version: '1.0.0 (Demo)' };
    }
    try {
      const rootUrl = this.baseUrl.replace('/api/v1', '');
      const res = await fetch(`${rootUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error('Health check failed');
      const data = await res.json();
      return { online: true, version: data.version };
    } catch {
      return { online: false };
    }
  }

  async getDocuments(): Promise<DocumentItem[]> {
    if (this.demoMode) {
      const stored = localStorage.getItem('civix_mock_docs');
      return stored ? JSON.parse(stored) : INITIAL_MOCK_DOCUMENTS;
    }

    try {
      const res = await fetch(`${this.baseUrl}/documents`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch documents`);
      return await res.json();
    } catch (err) {
      console.warn('Backend unavailable, falling back to local vault data', err);
      return INITIAL_MOCK_DOCUMENTS;
    }
  }

  async uploadDocument(file: File): Promise<DocumentItem> {
    if (this.demoMode) {
      await new Promise(r => setTimeout(r, 1200));
      const newDoc: DocumentItem = {
        id: `mock-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        doc_type: file.name.toLowerCase().includes('pass') ? 'PASSPORT' :
                  file.name.toLowerCase().includes('tax') ? 'TAX_RETURN' :
                  file.name.toLowerCase().includes('insur') ? 'HEALTH_INSURANCE' : 'NATIONAL_ID',
        category: 'IDENTITY',
        issuing_country: 'GLOBAL',
        document_number: `DOC-${Math.floor(100000 + Math.random() * 900000)}`,
        issue_date: new Date().toISOString().split('T')[0],
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'ACTIVE',
        file_mime_type: file.type || 'application/pdf',
        file_size_bytes: file.size,
      };
      const existing = await this.getDocuments();
      const updated = [newDoc, ...existing];
      localStorage.setItem('civix_mock_docs', JSON.stringify(updated));
      return newDoc;
    }

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${this.baseUrl}/documents/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }

    return await res.json();
  }

  async deleteDocument(id: string): Promise<void> {
    if (this.demoMode) {
      const existing = await this.getDocuments();
      const updated = existing.filter(d => d.id !== id);
      localStorage.setItem('civix_mock_docs', JSON.stringify(updated));
      return;
    }

    const res = await fetch(`${this.baseUrl}/documents/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete document: ${res.statusText}`);
    }
  }

  async getTasks(): Promise<BureaucraticTask[]> {
    if (this.demoMode) {
      const stored = localStorage.getItem('civix_mock_tasks');
      return stored ? JSON.parse(stored) : INITIAL_MOCK_TASKS;
    }

    try {
      const res = await fetch(`${this.baseUrl}/agent/tasks`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch tasks`);
      return await res.json();
    } catch (err) {
      console.warn('Backend unavailable, falling back to local task state', err);
      return INITIAL_MOCK_TASKS;
    }
  }

  /**
   * Real-time Server-Sent Events (SSE) streaming consumer for /agent/chat
   */
  async streamChat(
    message: string,
    taskId: string | null,
    callbacks: {
      onNodeUpdate: (node: AgentNode, data: any) => void;
      onTaskCreated?: (taskId: string) => void;
      onComplete: (fullAnswer: string) => void;
      onError: (err: string) => void;
    }
  ): Promise<void> {
    if (this.demoMode) {
      await this.simulateAgentStream(message, taskId, callbacks);
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          task_id: taskId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported in response.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedAnswer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.replace(/^data:\s*/, '').trim();

          if (dataStr === '[DONE]') {
            callbacks.onComplete(accumulatedAnswer);
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.event === 'node_update') {
              const node = parsed.node as AgentNode;
              if (parsed.data?.answer) {
                accumulatedAnswer = parsed.data.answer;
              }
              callbacks.onNodeUpdate(node, parsed.data);
            } else if (parsed.event === 'task_created' && callbacks.onTaskCreated) {
              callbacks.onTaskCreated(parsed.task_id);
            }
          } catch (jsonErr) {
            console.warn('Could not parse SSE JSON payload:', dataStr, jsonErr);
          }
        }
      }

      callbacks.onComplete(accumulatedAnswer);
    } catch (err: any) {
      console.error('Agent chat streaming error:', err);
      // Fallback to simulation if server connection refused
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        console.info('Switching to local simulation stream due to unreachable backend...');
        await this.simulateAgentStream(message, taskId, callbacks);
      } else {
        callbacks.onError(err.message || 'Stream connection interrupted');
      }
    }
  }

  /**
   * Realistic high-fidelity simulator for demonstration & offline preview
   */
  private async simulateAgentStream(
    message: string,
    _taskId: string | null,
    callbacks: {
      onNodeUpdate: (node: AgentNode, data: any) => void;
      onTaskCreated?: (taskId: string) => void;
      onComplete: (fullAnswer: string) => void;
      onError: (err: string) => void;
    }
  ): Promise<void> {
    const isGermanVisa = message.toLowerCase().includes('germany') || message.toLowerCase().includes('student') || message.toLowerCase().includes('visa');
    const isPassport = message.toLowerCase().includes('passport') || message.toLowerCase().includes('renewal') || message.toLowerCase().includes('india');

    // 1. Intent Parsing Node
    await new Promise(r => setTimeout(r, 600));
    const country = isGermanVisa ? 'DEU' : isPassport ? 'IND' : 'GLOBAL';
    const topic = isGermanVisa
      ? 'German National Student Visa (Section 16b)'
      : isPassport
      ? 'Passport Renewal Procedure'
      : 'Administrative Procedural Inquiry';

    callbacks.onNodeUpdate('parse_intent', {
      procedure_topic: topic,
      target_country: country,
    });

    // 2. RAG Retrieval Node
    await new Promise(r => setTimeout(r, 800));
    const requiredDocs = isGermanVisa
      ? ['PASSPORT', 'DEGREE', 'ADMISSION_LETTER', 'BLOCKED_ACCOUNT_PROOF', 'HEALTH_INSURANCE']
      : isPassport
      ? ['PASSPORT', 'NATIONAL_ID', 'PROOF_OF_ADDRESS']
      : ['PASSPORT', 'NATIONAL_ID'];

    callbacks.onNodeUpdate('retrieve_rules', { required_docs: requiredDocs });

    // 3. Vault Audit Node
    await new Promise(r => setTimeout(r, 900));
    const checklist: ChecklistItem[] = isGermanVisa
      ? [
          { doc_type: 'PASSPORT', status: 'AVAILABLE', title: 'International Passport', expiry_date: '2031-04-12', notes: 'Valid' },
          { doc_type: 'DEGREE', status: 'AVAILABLE', title: 'B.Tech Degree', expiry_date: null, notes: 'Recognized' },
          { doc_type: 'HEALTH_INSURANCE', status: 'EXPIRING_SOON', title: 'Travel Health Insurance', expiry_date: '2026-10-30', notes: 'Renewal suggested' },
          { doc_type: 'BLOCKED_ACCOUNT_PROOF', status: 'MISSING', notes: 'Missing minimum threshold proof' },
          { doc_type: 'ADMISSION_LETTER', status: 'MISSING', notes: 'University acceptance letter needed' },
        ]
      : [
          { doc_type: 'PASSPORT', status: 'AVAILABLE', title: 'Old Passport Booklet', expiry_date: '2031-04-12', notes: 'Ready' },
          { doc_type: 'NATIONAL_ID', status: 'AVAILABLE', title: 'Aadhaar [Redacted]', expiry_date: null, notes: 'Zero-knowledge masked' },
          { doc_type: 'PROOF_OF_ADDRESS', status: 'AVAILABLE', title: 'Utility/Address Slip', expiry_date: null, notes: 'Verified' },
        ];

    const missingDocs = checklist.filter(c => c.status === 'MISSING' || c.status === 'EXPIRED').map(c => c.doc_type);

    callbacks.onNodeUpdate('audit_vault', {
      checklist,
      missing_docs: missingDocs,
      is_complete: missingDocs.length === 0,
    });

    // 4. Synthesis Node
    await new Promise(r => setTimeout(r, 1000));
    let guidance = '';
    if (isGermanVisa) {
      guidance = `### Application Strategy: German Student Visa (§16b AufenthG)

I have audited your secure document vault against the **German Federal Foreign Office** regulatory directive:

#### 1. Document Audit Summary
- **Verified in Vault**: Passport (valid through 2031), B.Tech Degree Certificate.
- **Attention Needed**: Health Insurance is set to expire on **2026-10-30** (consider policy renewal).
- **Critical Missing Requirements**:
  1. **Blocked Account Confirmation**: Requires minimum annual balance (€11,208).
  2. **Official Admission Letter**: Must be an unconditional offer from a recognized German university.

#### 2. Immediate Next Steps
1. Open and deposit funds into a certified blocked account (e.g., Fintiba, Expatrio).
2. Upload the issued PDF confirmation into your Civix Document Vault.
3. Schedule your VFS / Embassy biometric appointment once all checklist items show green.`;
    } else {
      guidance = `### Verification Passed: Passport Renewal Procedure

All required baseline verification records were matched from your encrypted vault:
- **Current Passport Booklet**: Verified and valid.
- **National Identity**: Aadhaar record attached (Privacy Guardrail active: identifier is protected).
- **Address Verification**: Confirmed.

You are **Ready to Submit**! You can proceed with appointment booking on the consular portal with 100% prerequisite certainty.`;
    }

    callbacks.onNodeUpdate('synthesize_guidance', { answer: guidance });
    callbacks.onComplete(guidance);
  }
}

export const apiService = new ApiService();
