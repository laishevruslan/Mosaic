export interface CopilotSessionRecord {
  id: string;
  workspaceId: string;
  userId: string;
  docId: string | null;
  promptName: string;
  title: string | null;
  pinned: boolean;
  parentSessionId: string | null;
  action: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CopilotStreamObject {
  type: string;
  textDelta?: string;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
}

export interface CopilotMessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments: string[] | null;
  streamObjects: CopilotStreamObject[] | null;
  createdAt: Date;
}

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
}

export interface ChatCompletionResult {
  content: string;
}

export interface CopilotTranscriptTask {
  id: string;
  workspaceId: string;
  userId: string;
  blobId: string | null;
  status: 'pending' | 'running' | 'finished' | 'failed' | 'claimed';
  title: string | null;
  summary: string | null;
  transcript: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CopilotPromptRoute =
  | 'chat'
  | 'tools'
  | 'embed'
  | 'vision'
  | 'transcript'
  | 'json';

export function routeForPrompt(promptName: string): CopilotPromptRoute {
  const name = promptName.toLowerCase();
  if (name.includes('embed') || name.includes('index')) {
    return 'embed';
  }
  if (name.includes('transcript') || name.includes('audio')) {
    return 'transcript';
  }
  if (name.includes('vision') || name.includes('image')) {
    return 'vision';
  }
  if (
    name.includes('kanban') ||
    name.includes('chart') ||
    name.includes('json') ||
    name.includes('structured')
  ) {
    return 'json';
  }
  if (name.includes('tool') || name.includes('search')) {
    return 'tools';
  }
  return 'chat';
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
