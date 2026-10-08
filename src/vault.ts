// ─── Card vault ─────────────────────────────────────────────────────────
// Full card numbers and security codes never touch localStorage in plain
// text. They're sealed with AES-256-GCM under a key derived (PBKDF2-SHA256)
// from the user's passcode. Only the salt and a check value are stored —
// never the passcode or the key.

export interface Sealed {
  iv: string;
  ct: string;
}

export interface Vault {
  v: 1;
  salt: string;
  iterations: number;
  /** A known value sealed with the key, used to tell right passcodes from wrong ones. */
  check: Sealed;
}

export interface CardSecrets {
  number: string;
  cvv: string;
}

const ITERATIONS = 600_000;
const CHECK = "finn-vault-ok";
const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Web Crypto only exists on https:// or localhost. */
export const cryptoAvailable = () => typeof crypto !== "undefined" && !!crypto.subtle;

async function deriveKey(passcode: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey("raw", enc.encode(passcode), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value)));
  return { iv: toB64(iv), ct: toB64(ct) };
}

export async function unseal<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(sealed.iv) as BufferSource }, key, fromB64(sealed.ct) as BufferSource);
  return JSON.parse(dec.decode(pt)) as T;
}

export async function createVault(passcode: string): Promise<{ vault: Vault; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passcode, salt, ITERATIONS);
  return { vault: { v: 1, salt: toB64(salt), iterations: ITERATIONS, check: await seal(key, CHECK) }, key };
}

/** Resolves to the key if the passcode is right, null if it's wrong. */
export async function unlockVault(vault: Vault, passcode: string): Promise<CryptoKey | null> {
  const key = await deriveKey(passcode, fromB64(vault.salt), vault.iterations);
  try {
    return (await unseal<string>(key, vault.check)) === CHECK ? key : null;
  } catch {
    return null; // AES-GCM auth failure = wrong passcode
  }
}

// ─── Card number helpers ────────────────────────────────────────────────

export type Brand = "visa" | "mastercard" | "amex" | "discover" | "card";

export const BRAND_LABEL: Record<Brand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  card: "Card",
};

export function detectBrand(digits: string): Brand {
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^(6011|65|64[4-9])/.test(digits)) return "discover";
  return "card";
}

export const numberLength = (b: Brand) => (b === "amex" ? 15 : 16);
export const cvvLength = (b: Brand) => (b === "amex" ? 4 : 3);

/** "4242424242424242" → "4242 4242 4242 4242" (Amex: 4-6-5). */
export function formatNumber(digits: string) {
  const groups = detectBrand(digits) === "amex" ? [4, 6, 5] : [4, 4, 4, 4, 3];
  const out: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + g));
    i += g;
  }
  return out.join(" ");
}

export function luhnValid(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return digits.length >= 12 && sum % 10 === 0;
}

/** Accepts "MM/YY"; true if the card hasn't expired yet. */
export function expiryValid(expiry: string, now = new Date()) {
  const m = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  return new Date(year, month, 1) > now; // valid through the end of that month
}

export function formatExpiry(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (d.length === 1 && Number(d) > 1) return `0${d}/`;
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
