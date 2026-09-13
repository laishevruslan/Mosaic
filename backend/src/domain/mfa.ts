export interface TotpCredential {
  userId: string;
  secret: string;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface WebAuthnCredential {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceName: string | null;
  createdAt: Date;
}

export interface RecoveryCode {
  userId: string;
  codeHash: string;
  usedAt: Date | null;
}

export interface MfaChallenge {
  id: string;
  userId: string;
  tokenHash: string;
  purpose: 'login' | 'register' | 'webauthn';
  payload: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
}

export type MfaMethod = 'totp' | 'passkey' | 'recovery';
