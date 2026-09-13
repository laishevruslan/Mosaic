export type ByokProvider = 'openai' | 'anthropic' | 'fal' | 'gemini';

export interface ByokProfile {
  profileId: string;
  workspaceId: string;
  provider: ByokProvider;
  name: string;
  description: string | null;
  enabled: boolean;
  sortOrder: number;
  revision: number;
  credentialCipher: string;
  definition: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ByokLease {
  leaseId: string;
  workspaceId: string;
  expiresAt: Date;
}

export interface ByokUsagePoint {
  date: Date;
  featureKind: string;
  totalTokens: number;
}
