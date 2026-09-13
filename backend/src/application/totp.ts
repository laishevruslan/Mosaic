import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): string {
  return toBase32(randomBytes(20));
}

export function toBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32[(value << (5 - bits)) & 31];
  }
  return output;
}

export function fromBase32(secret: string): Buffer {
  const cleaned = secret.replace(/=+$/g, '').toUpperCase().replaceAll(' ', '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32.indexOf(char);
    if (idx < 0) {
      throw new Error('invalid_base32');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotp(
  secret: string,
  at = Date.now(),
  digits = 6,
  step = 30
): string {
  const key = fromBase32(secret);
  const counter = Math.floor(at / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    (hmac[offset + 1]! << 16) |
    (hmac[offset + 2]! << 8) |
    hmac[offset + 3]!;
  const otp = binary % 10 ** digits;
  return String(otp).padStart(digits, '0');
}

export function verifyTotp(
  secret: string,
  code: string,
  at = Date.now(),
  window = 1
): boolean {
  const expected = code.replaceAll(/\s/g, '');
  if (!/^\d{6}$/.test(expected)) {
    return false;
  }
  const want = Buffer.from(expected);
  for (let drift = -window; drift <= window; drift += 1) {
    const candidate = Buffer.from(generateTotp(secret, at + drift * 30_000));
    if (candidate.length === want.length && timingSafeEqual(candidate, want)) {
      return true;
    }
  }
  return false;
}

export function otpauthUrl(input: {
  email: string;
  secret: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${input.issuer}:${input.email}`);
  const issuer = encodeURIComponent(input.issuer);
  return `otpauth://totp/${label}?secret=${input.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}
