/**
 * Memory system types (backend-agnostic)
 */

export type MemoryBackend = 'respire' | 'markdown' | 'off';

// Memory scope: 'own' for bot-specific, 'team' for shared, or a specific bot ID
export type MemoryScope = string;

export interface MemoryEntry {
  id: string;
  content: string;
  title?: string;
  meta?: Record<string, string>;
  scope: MemoryScope;
  createdAt: string;
  updatedAt?: string;
}

export interface RecallResult {
  query: string;
  hits: Array<{
    id: string;
    title: string;
    content?: string;
    score: number;
  }>;
  related?: string[];
}

export interface RememberRequest {
  content: string;
  title?: string;
  scope?: MemoryScope;
  topic?: string;
  replace?: string; // Entry text to replace
}

export interface RememberResult {
  id?: string;
  candidates?: Array<{
    id: string;
    content: string;
  }>;
  message: string;
}
