// Refuse passwords that appear in known data breaches (the free
// "Pwned Passwords" list, the same one Supabase's paid setting uses).
// Private by design (k-anonymity): only the first 5 characters of the
// password's SHA-1 hash are sent; the match happens here, so the password
// itself never leaves the device. If the check can't run (offline, the
// service is down) we let the password through rather than block sign-up.
//
// Same file in Talfirms web, Skillfirms and the Talfirms mobile app.

// encodeURIComponent -> %XX bytes -> one char per byte.
function utf8Bytes(str) {
  const s = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  const out = new Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Plain SHA-1 (no dependencies, so it also runs in React Native).
export function sha1Hex(str) {
  const bytes = utf8Bytes(str);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Array(80);
  const rotl = (x, n) => (x << n) | (x >>> (32 - n));
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
    }
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = (rotl(a, 5) + f + e + k + w[i]) | 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = t;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

// How many times the password appears in known breaches (0 = not found,
// or the check couldn't run).
export async function breachCount(password, fetchImpl = fetch) {
  try {
    const hash = sha1Hex(password).toUpperCase();
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, { headers: { "Add-Padding": "true" } });
    if (!res.ok) return 0;
    const text = await res.text();
    const suffix = hash.slice(5);
    for (const line of text.split("\n")) {
      const [s, n] = line.trim().split(":");
      if (s === suffix) return Number(n) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

export const LEAKED_PASSWORD_MESSAGE = "This password has appeared in a data breach, so it isn't safe to use. Please choose a different one.";

export async function assertPasswordNotLeaked(password, fetchImpl) {
  if (await breachCount(password, fetchImpl) > 0) throw new Error(LEAKED_PASSWORD_MESSAGE);
}
