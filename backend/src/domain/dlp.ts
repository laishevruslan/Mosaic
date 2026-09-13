export type DlpMode = 'off' | 'redact' | 'block';

export interface DlpFinding {
  kind: 'email' | 'pan' | 'secret';
  count: number;
}

export interface DlpVerdict {
  blocked: boolean;
  redacted: boolean;
  findings: DlpFinding[];
}

export interface ContentClassifier {
  inspect(text: string): DlpVerdict;
  redact(text: string): { text: string; verdict: DlpVerdict };
}
