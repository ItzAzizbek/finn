import type { Currency } from "./currency";
import type { Brand, Sealed } from "./vault";

// ─── Types ──────────────────────────────────────────────────────────────

export type Ink = "light" | "dark";
export type Pattern = "none" | "grid" | "dots" | "stripes" | "waves" | "rings";
export type Finish = "matte" | "gloss" | "holo";
export type CardType = "debit" | "credit";
export type CardFont = "sans" | "serif" | "mono" | "wide";
export type LogoId = "spark" | "orbit" | "sun" | "pulse" | "peak" | "kite" | "dot" | "none";
export type StickerId =
  | "star" | "sparkle" | "bolt" | "heart" | "flame" | "smiley" | "flower" | "moon"
  | "cherry" | "crown" | "planet" | "rainbow" | "butterfly" | "ghost" | "eye";

export interface Skin {
  id: string;
  name: string;
  bg: string;
  ink: Ink;
}

export interface CardDesign {
  skinId: string;
  /** A solid color overrides the skin when set. */
  color: string | null;
  pattern: Pattern;
  /** PNG data URL of the user's drawing, layered over the base. */
  drawing: string | null;
  sticker: StickerId | null;
  finish: Finish;
  font: CardFont;
  /** null = pick black or white automatically from the background. */
  textColor: string | null;
  showChip: boolean;
  showBalance: boolean;
}

export interface Card {
  id: string;
  /** Every piece of text on the card is user-editable. */
  issuer: string;
  nickname: string;
  label: string;
  tagline: string;
  logo: LogoId;
  type: CardType;
  /** Money on this card is held in this currency; set once when the card is added. */
  currency: Currency;
  last4: string;
  /** Printed on the card, so stored as-is. */
  holder: string;
  /** "MM/YY" */
  expiry: string;
  brand: Brand;
  /** Full number + CVV, encrypted with the vault key. Null for cards added before details were required. */
  secret: Sealed | null;
  balance: number;
  limit?: number;
  design: CardDesign;
  frozen: boolean;
}

export type CategoryId =
  | "food"
  | "groceries"
  | "transport"
  | "shopping"
  | "fun"
  | "subs"
  | "health"
  | "income";

export interface Category {
  id: CategoryId;
  label: string;
  color: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  /** Day of the month it renews (1–31). */
  day: number;
  cardId: string | null;
  currency: Currency;
}

export interface Txn {
  id: string;
  cardId: string;
  /** Always the card's currency at the time it was logged. */
  currency: Currency;
  merchant: string;
  category: CategoryId;
  /** Negative = money out, positive = money in. */
  amount: number;
  date: string;
}

// ─── Catalogs ───────────────────────────────────────────────────────────

export const SKINS: Skin[] = [
  {
    id: "acid",
    name: "Acid",
    ink: "dark",
    bg: "radial-gradient(120% 140% at 0% 0%, #f4ff7a 0%, transparent 55%), radial-gradient(120% 120% at 100% 100%, #5dff9e 0%, transparent 60%), #c8ff2e",
  },
  {
    id: "ultraviolet",
    name: "Ultraviolet",
    ink: "light",
    bg: "radial-gradient(90% 120% at 100% 0%, #ff4fa3 0%, transparent 55%), radial-gradient(120% 120% at 0% 100%, #2d1cff 0%, transparent 60%), #6b3cff",
  },
  {
    id: "sunset",
    name: "Sunset Club",
    ink: "light",
    bg: "radial-gradient(110% 130% at 0% 100%, #ffcf3d 0%, transparent 55%), radial-gradient(100% 120% at 100% 0%, #ff2e7e 0%, transparent 60%), #ff6a1a",
  },
  {
    id: "midnight",
    name: "Midnight",
    ink: "light",
    bg: "radial-gradient(80% 100% at 100% 0%, #2a2a35 0%, transparent 60%), linear-gradient(160deg, #18181d 0%, #050507 100%)",
  },
  {
    id: "holo",
    name: "Holo",
    ink: "dark",
    bg: "linear-gradient(125deg, #ffd1f5 0%, #c9e8ff 25%, #d8ffe6 50%, #fff4c2 75%, #f0d4ff 100%)",
  },
  {
    id: "ocean",
    name: "Deep End",
    ink: "light",
    bg: "radial-gradient(120% 120% at 0% 0%, #2ee6ff 0%, transparent 50%), radial-gradient(120% 140% at 100% 100%, #0b1a6b 0%, transparent 60%), #1557ff",
  },
  {
    id: "bubblegum",
    name: "Bubblegum",
    ink: "dark",
    bg: "radial-gradient(100% 120% at 100% 100%, #ffb3d9 0%, transparent 55%), radial-gradient(100% 120% at 0% 0%, #fff0f7 0%, transparent 60%), #ff8cc6",
  },
  {
    id: "matcha",
    name: "Matcha",
    ink: "light",
    bg: "radial-gradient(110% 120% at 100% 0%, #9be36b 0%, transparent 55%), linear-gradient(160deg, #2f6b3a 0%, #0f2a17 100%)",
  },
  {
    id: "chrome",
    name: "Chrome",
    ink: "dark",
    bg: "linear-gradient(135deg, #f4f4f6 0%, #a9abb3 22%, #ffffff 40%, #8a8c94 62%, #e8e9ee 80%, #b5b7bf 100%)",
  },
  {
    id: "ember",
    name: "Ember",
    ink: "light",
    bg: "radial-gradient(100% 140% at 50% 120%, #ff3d00 0%, transparent 60%), linear-gradient(180deg, #1a0703 0%, #3d0b04 100%)",
  },
  {
    id: "lavender",
    name: "Lavender Haze",
    ink: "dark",
    bg: "radial-gradient(120% 120% at 0% 100%, #b8a6ff 0%, transparent 55%), radial-gradient(100% 120% at 100% 0%, #ffd6f0 0%, transparent 60%), #d9ccff",
  },
  {
    id: "noir",
    name: "Noir Lime",
    ink: "light",
    bg: "radial-gradient(70% 90% at 100% 100%, rgba(200,255,46,.45) 0%, transparent 60%), #0c0c0e",
  },
];

export const SKIN_BY_ID: Record<string, Skin> = Object.fromEntries(SKINS.map((s) => [s.id, s]));

export const SWATCHES = [
  "#c8ff2e", "#ff4fa3", "#8b5cff", "#2ee6ff", "#ff7a1a", "#ffd60a",
  "#32d74b", "#ff453a", "#1557ff", "#f5f5f7", "#1b1b1f", "#b08968",
];

export const PATTERNS: { id: Pattern; label: string }[] = [
  { id: "none", label: "Clean" },
  { id: "grid", label: "Grid" },
  { id: "dots", label: "Dots" },
  { id: "stripes", label: "Stripes" },
  { id: "waves", label: "Waves" },
  { id: "rings", label: "Rings" },
];

export const FINISHES: { id: Finish; label: string; hint: string }[] = [
  { id: "matte", label: "Matte", hint: "Soft-touch, zero glare" },
  { id: "gloss", label: "Gloss", hint: "Clean light streak" },
  { id: "holo", label: "Holo", hint: "Rainbow foil shimmer" },
];

export const FONTS: { id: CardFont; label: string; family: string }[] = [
  { id: "sans", label: "Bold", family: '"Inter Tight Variable", system-ui, sans-serif' },
  { id: "serif", label: "Serif", family: '"Instrument Serif", Georgia, serif' },
  { id: "mono", label: "Mono", family: '"Space Mono", ui-monospace, monospace' },
  { id: "wide", label: "Wide", family: '"Unbounded Variable", system-ui, sans-serif' },
];

export const TEXT_COLORS = ["#ffffff", "#0a0a0b", "#c8ff2e", "#ff4fa3", "#2ee6ff", "#ffd60a", "#e8c37a"];

export const CATEGORIES: Record<CategoryId, Category> = {
  food: { id: "food", label: "Food & drinks", color: "#ff7a1a" },
  groceries: { id: "groceries", label: "Groceries", color: "#32d74b" },
  transport: { id: "transport", label: "Getting around", color: "#ffd60a" },
  shopping: { id: "shopping", label: "Shopping", color: "#ff4fa3" },
  fun: { id: "fun", label: "Going out", color: "#8b5cff" },
  subs: { id: "subs", label: "Subscriptions", color: "#2ee6ff" },
  health: { id: "health", label: "Health", color: "#ff453a" },
  income: { id: "income", label: "Money in", color: "#c8ff2e" },
};

export const SPEND_CATEGORIES = (Object.keys(CATEGORIES) as CategoryId[]).filter((c) => c !== "income");

export const GOALS = [
  { id: "save", label: "Save more" },
  { id: "overspend", label: "Stop overspending" },
  { id: "subs", label: "Track subscriptions" },
  { id: "credit", label: "Build credit" },
  { id: "travel", label: "Travel fund" },
  { id: "debt", label: "Crush debt" },
  { id: "invest", label: "Start investing" },
  { id: "chill", label: "Just vibes, less stress" },
];

// ─── Helpers ────────────────────────────────────────────────────────────

export const uid = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 12);

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Days until the next charge on `day` of the month (0 = today). Handles short months. */
export function daysUntil(day: number, from = new Date()) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const clamp = (y: number, m: number) => Math.min(day, new Date(y, m + 1, 0).getDate());
  let next = new Date(today.getFullYear(), today.getMonth(), clamp(today.getFullYear(), today.getMonth()));
  if (next < today) next = new Date(today.getFullYear(), today.getMonth() + 1, clamp(today.getFullYear(), today.getMonth() + 1));
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

const STARTER_SKINS = ["ultraviolet", "acid", "sunset", "ocean", "midnight", "holo", "bubblegum", "matcha"];

export function defaultDesign(i = 0): CardDesign {
  return {
    skinId: STARTER_SKINS[i % STARTER_SKINS.length],
    color: null,
    pattern: "none",
    drawing: null,
    sticker: null,
    finish: "gloss",
    font: "sans",
    textColor: null,
    showChip: true,
    showBalance: true,
  };
}

export interface CardInput {
  issuer: string;
  nickname: string;
  type: CardType;
  currency: Currency;
  last4: string;
  holder: string;
  expiry: string;
  brand: Brand;
  secret: Sealed | null;
  balance: number;
  limit?: number;
}

export function makeCard(input: CardInput, index = 0): Card {
  const logos: LogoId[] = ["spark", "orbit", "pulse", "sun", "peak", "kite"];
  return {
    id: uid(),
    issuer: input.issuer.trim() || "My Bank",
    nickname: input.nickname.trim() || (input.type === "credit" ? "Rewards" : "Everyday"),
    label: input.type,
    tagline: "",
    logo: logos[index % logos.length],
    type: input.type,
    last4: input.last4.padStart(4, "0"),
    holder: input.holder.trim(),
    expiry: input.expiry,
    brand: input.brand,
    secret: input.secret,
    currency: input.currency,
    balance: round2(input.balance),
    limit: input.type === "credit" ? input.limit : undefined,
    frozen: false,
    design: defaultDesign(index),
  };
}
