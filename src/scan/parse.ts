// ─── Reading a card from OCR text ───────────────────────────────────────
// OCR on a photographed card is noisy: digits come back as letters, groups
// split or merge, and the "valid from" date sits next to the expiry. These
// helpers pull out what a card form needs and only trust a number that
// checks out (known network + Luhn, or a HUMO/UZCARD prefix and length).

import { detectBrand, expiryValid, isLocalScheme, luhnValid } from "../vault";

export interface CardRead {
  number?: string;
  expiry?: string;
  holder?: string;
  issuer?: string;
}

/** Letters OCR commonly returns in place of digits on embossed or printed card numbers. */
const AS_DIGIT: Record<string, string> = {
  O: "0", o: "0", D: "0", Q: "0", U: "0",
  I: "1", l: "1", i: "1", L: "1", "|": "1", "!": "1",
  Z: "2", z: "2",
  S: "5", s: "5",
  G: "6", b: "6",
  T: "7",
  B: "8",
  g: "9", q: "9",
  A: "4",
};

/** A token that's mostly digits, with look-alike letters fixed; null if it isn't a digit group. */
function digitToken(raw: string): string | null {
  const t = raw.replace(/[^0-9A-Za-z|!]/g, "");
  if (!t) return null;
  const digits = (t.match(/\d/g) ?? []).length;
  if (digits * 2 < t.length) return null;
  let out = "";
  for (const ch of t) {
    if (/\d/.test(ch)) out += ch;
    else if (AS_DIGIT[ch]) out += AS_DIGIT[ch];
    else return null;
  }
  return out;
}

/** True when these digits are a real-looking card number. */
export function plausibleNumber(d: string) {
  const brand = detectBrand(d);
  if (isLocalScheme(brand)) return d.length === 16;
  if (brand === "amex") return d.length === 15 && luhnValid(d);
  if (brand === "card") return false;
  return d.length === 16 && luhnValid(d);
}

export function findNumber(text: string): string | undefined {
  for (const line of text.split(/\n/)) {
    // Join consecutive digit groups on the line: "4417 1234 5678 9010" → one run.
    const runs: string[] = [];
    let run = "";
    for (const tok of line.split(/\s+/)) {
      const d = digitToken(tok);
      if (d) run += d;
      else if (run) {
        runs.push(run);
        run = "";
      }
    }
    if (run) runs.push(run);

    for (const r of runs) {
      if (r.length < 15) continue;
      if (plausibleNumber(r)) return r;
      // Stray digits stuck on either end — slide a window over the run.
      for (const len of [16, 15]) {
        for (let i = 0; i + len <= r.length; i++) {
          const c = r.slice(i, i + len);
          if (plausibleNumber(c)) return c;
        }
      }
    }
  }
  return undefined;
}

export function findExpiry(text: string, now = new Date()): string | undefined {
  const fix = (s: string) => s.replace(/[OoDQ]/g, "0").replace(/[Il|i]/g, "1").replace(/[Ss]/g, "5").replace(/B/g, "8");
  const re = /(?<![0-9])([0-9OoDQIl|iSB]{2})\s?[/\\|-]\s?([0-9OoDQIl|iSsB]{2}(?:[0-9OoDQIl|iSsB]{2})?)(?![0-9])/g;
  let best: { mm: number; yy: number } | undefined;
  for (const m of text.matchAll(re)) {
    const mm = Number(fix(m[1]));
    const yRaw = fix(m[2]);
    const yy = Number(yRaw.length === 4 ? yRaw.slice(2) : yRaw);
    if (!(mm >= 1 && mm <= 12) || Number.isNaN(yy)) continue;
    const exp = `${String(mm).padStart(2, "0")}/${String(yy).padStart(2, "0")}`;
    if (!expiryValid(exp, now)) continue; // skips "valid from" dates in the past
    // Cards can print both "valid from" and "valid thru" — the expiry is the later one.
    if (!best || yy > best.yy || (yy === best.yy && mm > best.mm)) best = { mm, yy };
  }
  return best && `${String(best.mm).padStart(2, "0")}/${String(best.yy).padStart(2, "0")}`;
}

/** Words printed on cards that are never the holder's name. */
const NOT_A_NAME = new Set(
  (
    "VISA MASTERCARD MASTER CARD MAESTRO AMEX AMERICAN EXPRESS DISCOVER HUMO UZCARD MIR UNIONPAY " +
    "DEBIT CREDIT PREPAID VALID THRU FROM GOOD UNTIL MONTH YEAR EXPIRES EXP DATE MEMBER SINCE " +
    "CLASSIC GOLD PLATINUM INFINITE SIGNATURE WORLD ELITE BUSINESS CORPORATE ELECTRON STANDARD BLACK " +
    "PREMIUM SELECT REWARDS VIRTUAL CONTACTLESS INTERNATIONAL ELECTRONIC USE ONLY BANK CARDHOLDER " +
    "AUTHORIZED SIGNATURE NOT VALID UNLESS SIGNED CUSTOMER SERVICE"
  ).split(" "),
);

export function findHolder(text: string): string | undefined {
  let best: { name: string; score: number } | undefined;
  for (const line of text.split(/\n/)) {
    if (/\d/.test(line)) continue;
    const letters = line.replace(/[^A-Za-z]/g, "");
    if (letters.length < 5) continue;
    // Cards print names in capitals; OCR noise lines usually mix case.
    const upper = (letters.match(/[A-Z]/g) ?? []).length / letters.length;
    if (upper < 0.85) continue;
    const words = line
      .replace(/[^A-Za-z' -]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^[-']+|[-']+$/g, "").toUpperCase())
      .filter((w) => w.length >= 2);
    if (words.length < 2 || words.length > 4) continue;
    if (words.some((w) => NOT_A_NAME.has(w) || BANK_WORDS.has(w) || w.endsWith("BANK"))) continue;
    const name = words.join(" ");
    if (name.length > 26) continue;
    const score = (words.length === 2 ? 3 : words.length === 3 ? 2 : 1) + upper;
    if (!best || score > best.score) best = { name, score };
  }
  return best?.name;
}

/** Uzbek issuers, matched against the card text. Short codes need a whole-word hit. */
const BANKS: [RegExp, string][] = [
  [/KAPITAL ?BANK/, "Kapitalbank"],
  [/HAMKOR ?BANK/, "Hamkorbank"],
  [/AGRO ?BANK/, "Agrobank"],
  [/ASAKA ?BANK|\bASAKA\b/, "Asakabank"],
  [/IPOTEKA/, "Ipoteka Bank"],
  [/XALQ ?BANK/, "Xalq Banki"],
  [/ANOR ?BANK/, "Anorbank"],
  [/\bTBC\b/, "TBC Bank"],
  [/\bUZUM\b/, "Uzum Bank"],
  [/ALOQA ?BANK/, "Aloqabank"],
  [/TRAST ?BANK/, "Trastbank"],
  [/INFIN ?BANK/, "InfinBank"],
  [/ORIENT ?FINANS/, "Orient Finans"],
  [/DAVR ?BANK/, "Davr Bank"],
  [/OCTO ?BANK/, "Octobank"],
  [/\bKDB\b/, "KDB Bank"],
  [/MIKROKREDIT|\bMKBANK\b/, "Mikrokreditbank"],
  [/\bSQB\b|SANOATQURILISH/, "SQB"],
  [/\bNBU\b|MILLIY ?BANK/, "NBU"],
  [/TURON ?BANK/, "Turonbank"],
  [/QISHLOQ ?QURILISH/, "Qishloq Qurilish Bank"],
  [/POYTAXT ?BANK/, "Poytaxt Bank"],
  [/HAYOT ?BANK/, "Hayot Bank"],
  [/UNIVERSAL ?BANK/, "Universal Bank"],
  [/ZIRAAT/, "Ziraat Bank"],
  [/GARANT ?BANK/, "Garant Bank"],
  [/APEX ?BANK/, "Apex Bank"],
  [/TENGE ?BANK/, "Tenge Bank"],
  [/MADAD ?INVEST/, "Madad Invest Bank"],
  [/SAVDOGAR/, "Savdogar Bank"],
  [/\bAVO\b/, "AVO Bank"],
  [/SMART ?BANK/, "Smartbank"],
  [/YANGI ?BANK/, "Yangi Bank"],
];
const BANK_WORDS = new Set(["KAPITAL", "HAMKOR", "AGRO", "ASAKA", "IPOTEKA", "XALQ", "BANKI", "ANOR", "UZUM", "ALOQA", "TRAST", "INFIN", "ORIENT", "FINANS", "DAVR", "OCTO", "TURON", "POYTAXT", "HAYOT", "TENGE", "APEX", "SAVDOGAR", "ZIRAAT", "GARANT"]);

export function findIssuer(text: string): string | undefined {
  const up = text.toUpperCase();
  return BANKS.find(([re]) => re.test(up))?.[1];
}

export function parseCardText(text: string, now = new Date()): CardRead {
  return { number: findNumber(text), expiry: findExpiry(text, now), holder: findHolder(text), issuer: findIssuer(text) };
}

// ─── Agreeing across frames ─────────────────────────────────────────────
// One blurry frame can produce a Luhn-valid wrong number, so a live scan
// waits until the same number is read twice. A single photo can't vote, so
// it's taken at its word (the user checks the form anyway).

export class ScanVotes {
  private counts = { number: new Map<string, number>(), expiry: new Map<string, number>(), holder: new Map<string, number>(), issuer: new Map<string, number>() };
  frames = 0;
  /** Frames read since the number was confirmed — gives expiry/name a moment to show up. */
  private sinceNumber = 0;

  add(read: CardRead) {
    this.frames++;
    if (this.number()) this.sinceNumber++;
    for (const k of ["number", "expiry", "holder", "issuer"] as const) {
      const v = read[k];
      if (v) this.counts[k].set(v, (this.counts[k].get(v) ?? 0) + 1);
    }
  }

  private top(k: keyof CardRead, min = 1) {
    let best: string | undefined;
    let n = 0;
    for (const [v, c] of this.counts[k]) if (c > n) [best, n] = [v, c];
    return n >= min ? best : undefined;
  }

  /** The confirmed number (seen twice), if any. */
  number() {
    return this.top("number", 2);
  }

  result(single = false): CardRead {
    return { number: single ? this.top("number") : this.number(), expiry: this.top("expiry"), holder: this.top("holder"), issuer: this.top("issuer") };
  }

  /** What's been glimpsed so far, for live feedback. */
  seen() {
    return { number: this.top("number"), expiry: this.top("expiry"), holder: this.top("holder") };
  }

  /** Done once the number is confirmed and expiry is in (or we've waited a few more frames for it). */
  done() {
    if (!this.number()) return false;
    return Boolean(this.top("expiry") && this.top("holder")) || this.sinceNumber >= 3;
  }
}
