function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    value = (value << 8) + octet;
  }
  return value >>> 0;
}

export function normalizeClientIp(raw: string | undefined | null): string {
  if (!raw) {
    return '';
  }
  const first = raw.split(',')[0]?.trim() ?? '';
  if (first.startsWith('::ffff:')) {
    return first.slice('::ffff:'.length);
  }
  if (first === '::1') {
    return '127.0.0.1';
  }
  return first;
}

export function ipAllowed(ip: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) {
    return true;
  }
  const client = ipv4ToInt(ip);
  if (client === null) {
    return false;
  }
  for (const entry of allowlist) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    const [base, bitsRaw] = trimmed.split('/');
    const baseInt = ipv4ToInt(base ?? '');
    if (baseInt === null) {
      continue;
    }
    if (bitsRaw === undefined) {
      if (baseInt === client) {
        return true;
      }
      continue;
    }
    const bits = Number(bitsRaw);
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) {
      continue;
    }
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    if ((client & mask) === (baseInt & mask)) {
      return true;
    }
  }
  return false;
}
