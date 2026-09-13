export interface SearchDocument {
  workspaceId: string;
  docId: string;
  blockId: string;
  flavour: string;
  title: string;
  body: string;
  updatedAt: Date;
}

export interface SearchFlavourCount {
  flavour: string;
  count: number;
}

export interface DailyAnalytics {
  day: string;
  workspaceStorageBytes: number;
  blobStorageBytes: number;
  copilotConversations: number;
  syncActiveUsers: number;
}

export interface ShareViewStats {
  workspaceId: string;
  docId: string;
  views: number;
  uniqueViews: number;
  guestViews: number;
  lastAccessedAt: Date | null;
}
