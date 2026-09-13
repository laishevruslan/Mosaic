export interface ScimToken {
  id: string;
  orgId: string;
  name: string;
  tokenHash: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface ScimUser {
  id: string;
  orgId: string;
  userId: string | null;
  externalId: string;
  userName: string;
  displayName: string;
  active: boolean;
  emails: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ScimGroup {
  id: string;
  orgId: string;
  externalId: string;
  displayName: string;
  members: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ScimListQuery {
  startIndex: number;
  count: number;
  filter?: string | null;
}
