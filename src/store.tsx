import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { convert, CURRENCIES, DEFAULT_RATES, formatCompact, formatMoney, formatMoney0, formatSigned, roundFor, roundToStep, type Currency, type Rates } from "./currency";
import type { Card, Subscription, Txn } from "./data";
import type { Sealed, Vault } from "./vault";

// ─── App data ───────────────────────────────────────────────────────────
// Everything lives in this one object, persisted to localStorage. Nothing
// is generated or fetched — every number on screen comes from the user.

export interface Prefs {
  stealth: boolean;
}

export interface State {
  onboarded: boolean;
  createdAt: string;
  name: string;
  goals: string[];
  /** Monthly budget, in the display currency. */
  budget: number;
  /** Totals, budget and insights are shown in this currency. */
  currency: Currency;
  /** Units per 1 USD — set by the user, never fetched. */
  rates: Rates;
  cards: Card[];
  txns: Txn[];
  subscriptions: Subscription[];
  /** Passcode-derived encryption metadata. The key itself only ever lives in memory. */
  vault: Vault | null;
  prefs: Prefs;
}

const initialState = (): State => ({
  onboarded: false,
  createdAt: new Date().toISOString(),
  name: "",
  goals: [],
  budget: CURRENCIES.UZS.scale.defaultBudget,
  currency: "UZS",
  rates: DEFAULT_RATES,
  cards: [],
  txns: [],
  subscriptions: [],
  vault: null,
  prefs: { stealth: false },
});

type Action =
  | { type: "onboard"; name: string; goals: string[]; budget: number; currency: Currency; cards: Card[]; vault: Vault | null }
  | { type: "currency"; currency: Currency }
  | { type: "rates"; rates: Rates }
  | { type: "setVault"; vault: Vault }
  | { type: "rekey"; vault: Vault; secrets: Record<string, Sealed> }
  | { type: "eraseSecrets" }
  | { type: "addCards"; cards: Card[] }
  | { type: "updateCard"; card: Card }
  | { type: "deleteCard"; id: string }
  | { type: "freeze"; id: string }
  | { type: "addTxn"; txn: Txn }
  | { type: "updateTxn"; txn: Txn }
  | { type: "deleteTxn"; id: string }
  | { type: "saveSub"; sub: Subscription }
  | { type: "deleteSub"; id: string }
  | { type: "budget"; budget: number }
  | { type: "name"; name: string }
  | { type: "pref"; key: keyof Prefs; value: boolean }
  | { type: "replayOnboarding" }
  | { type: "reset" };

const byDateDesc = (a: Txn, b: Txn) => (a.date < b.date ? 1 : -1);

/** Applies (sign = 1) or reverses (sign = -1) a transaction's effect on its card's balance. */
function applyToCards(cards: Card[], t: Txn, sign: 1 | -1, rates: Rates): Card[] {
  return cards.map((c) => {
    if (c.id !== t.cardId) return c;
    // Transactions are logged in the card's currency; convert defensively in case they differ.
    const amount = convert(t.amount, t.currency, c.currency, rates);
    let balance = roundFor(c.balance + sign * amount, c.currency);
    // Paying off a credit card can't push available credit past the limit.
    if (c.type === "credit" && c.limit !== undefined) balance = Math.min(balance, c.limit);
    return { ...c, balance };
  });
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "onboard":
      return { ...s, onboarded: true, name: a.name, goals: a.goals, budget: a.budget, currency: a.currency, cards: a.cards, vault: a.vault ?? s.vault };
    case "currency":
      // Keep the budget meaning the same amount of money, rounded to a sensible step.
      return { ...s, currency: a.currency, budget: roundToStep(convert(s.budget, s.currency, a.currency, s.rates), a.currency) };
    case "rates":
      return { ...s, rates: a.rates };
    case "setVault":
      return { ...s, vault: a.vault };
    case "rekey":
      return { ...s, vault: a.vault, cards: s.cards.map((c) => (a.secrets[c.id] ? { ...c, secret: a.secrets[c.id] } : c)) };
    case "eraseSecrets":
      return { ...s, vault: null, cards: s.cards.map((c) => ({ ...c, secret: null })) };
    case "addCards":
      return { ...s, cards: [...s.cards, ...a.cards] };
    case "updateCard":
      return { ...s, cards: s.cards.map((c) => (c.id === a.card.id ? a.card : c)) };
    case "deleteCard":
      return {
        ...s,
        cards: s.cards.filter((c) => c.id !== a.id),
        txns: s.txns.filter((t) => t.cardId !== a.id),
        subscriptions: s.subscriptions.map((x) => (x.cardId === a.id ? { ...x, cardId: null } : x)),
      };
    case "freeze":
      return { ...s, cards: s.cards.map((c) => (c.id === a.id ? { ...c, frozen: !c.frozen } : c)) };
    case "addTxn":
      return { ...s, txns: [a.txn, ...s.txns].sort(byDateDesc), cards: applyToCards(s.cards, a.txn, 1, s.rates) };
    case "updateTxn": {
      const old = s.txns.find((t) => t.id === a.txn.id);
      if (!old) return s;
      const cards = applyToCards(applyToCards(s.cards, old, -1, s.rates), a.txn, 1, s.rates);
      return { ...s, cards, txns: s.txns.map((t) => (t.id === a.txn.id ? a.txn : t)).sort(byDateDesc) };
    }
    case "deleteTxn": {
      const old = s.txns.find((t) => t.id === a.id);
      if (!old) return s;
      return { ...s, cards: applyToCards(s.cards, old, -1, s.rates), txns: s.txns.filter((t) => t.id !== a.id) };
    }
    case "saveSub": {
      const exists = s.subscriptions.some((x) => x.id === a.sub.id);
      return { ...s, subscriptions: exists ? s.subscriptions.map((x) => (x.id === a.sub.id ? a.sub : x)) : [...s.subscriptions, a.sub] };
    }
    case "deleteSub":
      return { ...s, subscriptions: s.subscriptions.filter((x) => x.id !== a.id) };
    case "budget":
      return { ...s, budget: a.budget };
    case "name":
      return { ...s, name: a.name };
    case "pref":
      return { ...s, prefs: { ...s.prefs, [a.key]: a.value } };
    case "replayOnboarding":
      return { ...s, onboarded: false };
    case "reset":
      return initialState();
  }
}

// ─── Persistence (localStorage only) ────────────────────────────────────

const KEY = "finn:v3";

/** Older saves: cards without full-detail fields, and everything before currencies was in dollars. */
function withCardDefaults(c: Card): Card {
  return { ...c, holder: c.holder ?? "", expiry: c.expiry ?? "", brand: c.brand ?? "card", secret: c.secret ?? null, currency: c.currency ?? "USD" };
}
const LEGACY_KEY = "finn:v2";

function load(): State {
  const base = initialState();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>;
      const legacyUsd = !saved.currency; // saved before multi-currency → it was all USD
      return {
        ...base,
        ...saved,
        currency: saved.currency ?? "USD",
        rates: { ...DEFAULT_RATES, ...saved.rates },
        budget: saved.budget ?? base.budget,
        cards: (saved.cards ?? []).map(withCardDefaults),
        txns: (saved.txns ?? []).map((t) => ({ ...t, currency: t.currency ?? (legacyUsd ? "USD" : saved.cards?.find((c) => c.id === t.cardId)?.currency ?? "USD") })),
        subscriptions: (saved.subscriptions ?? []).map((x) => ({ ...x, currency: x.currency ?? "USD" })),
        prefs: { ...base.prefs, ...saved.prefs },
      };
    }
    // The previous version padded the wallet with generated activity. Keep the
    // user's own setup (name, budget, the cards they added) and drop the made-up history.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as Partial<State>;
      localStorage.removeItem(LEGACY_KEY);
      return {
        ...base,
        onboarded: Boolean(old.onboarded),
        name: old.name ?? "",
        goals: old.goals ?? [],
        budget: old.budget ?? 2500,
        currency: "USD",
        cards: (old.cards ?? []).map(withCardDefaults),
        prefs: { stealth: Boolean(old.prefs?.stealth) },
      };
    }
  } catch {
    /* corrupt or blocked storage — start fresh */
  }
  return base;
}

// ─── Navigation ─────────────────────────────────────────────────────────

export type Tab = "home" | "insights" | "cards" | "me";

export type Overlay =
  | { kind: "card"; id: string }
  | { kind: "studio"; id: string }
  | { kind: "add"; cardId?: string }
  | { kind: "txn"; id: string }
  | { kind: "editCard"; id: string }
  | { kind: "sub"; id?: string }
  | { kind: "addCard" }
  | { kind: "cardDetails"; id: string }
  | { kind: "passcode"; mode: "unlock" | "create" | "change"; onDone?: (key: CryptoKey) => void }
  | { kind: "activity" };

interface Ctx {
  state: State;
  dispatch: (a: Action) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  overlays: Overlay[];
  open: (o: Overlay) => void;
  close: () => void;
  toast: (msg: string) => void;
  toastMsg: { id: number; msg: string } | null;
  /** Session key for the card vault; null while locked. */
  vaultKey: CryptoKey | null;
  setVaultKey: (k: CryptoKey | null) => void;
  /** Runs `fn` with the vault key, asking for the passcode first if locked (or to create one). */
  withKey: (fn: (key: CryptoKey) => void) => void;
}

const AUTO_LOCK_MS = 5 * 60_000;

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [tab, setTab] = useState<Tab>("home");
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [toastMsg, setToastMsg] = useState<{ id: number; msg: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);

  // The key never outlives the tab, and drops after a few minutes either way.
  useEffect(() => {
    if (!vaultKey) return;
    const t = window.setTimeout(() => setVaultKey(null), AUTO_LOCK_MS);
    return () => clearTimeout(t);
  }, [vaultKey]);

  // Reset / replayed onboarding without a vault → nothing to stay unlocked.
  useEffect(() => {
    if (!state.vault) setVaultKey(null);
  }, [state.vault]);

  const toast = useCallback((msg: string) => {
    window.clearTimeout(timer.current);
    setToastMsg({ id: Date.now(), msg });
    timer.current = window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Almost always the ~5 MB quota — card drawings are the heavy part.
      toast("Storage is full — clear a card drawing to keep saving");
    }
  }, [state, toast]);

  // Data changed in another tab: reload to pick it up instead of overwriting it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) window.location.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const open = useCallback((o: Overlay) => setOverlays((s) => [...s, o]), []);
  const close = useCallback(() => setOverlays((s) => s.slice(0, -1)), []);

  const hasVault = Boolean(state.vault);
  const withKey = useCallback(
    (fn: (key: CryptoKey) => void) => {
      if (vaultKey) return fn(vaultKey);
      open({ kind: "passcode", mode: hasVault ? "unlock" : "create", onDone: fn });
    },
    [vaultKey, hasVault, open],
  );

  useEffect(() => {
    if (!state.onboarded) setOverlays([]);
  }, [state.onboarded]);

  const value = useMemo(
    () => ({ state, dispatch, tab, setTab, overlays, open, close, toast, toastMsg, vaultKey, setVaultKey, withKey }),
    [state, tab, overlays, open, close, toast, toastMsg, vaultKey, withKey],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore outside provider");
  return ctx;
}

// ─── Money in context ───────────────────────────────────────────────────

/** Formatting + conversion bound to the user's display currency and rates. */
export function useMoney() {
  const { state } = useStore();
  const { currency: display, rates } = state;
  return useMemo(() => {
    const toDisplay = (amount: number, from: Currency) => convert(amount, from, display, rates);
    return {
      display,
      rates,
      toDisplay,
      /** A transaction's amount in the display currency (negative = spend). */
      txnValue: (t: Txn) => toDisplay(t.amount, t.currency),
      fmt: (n: number, cur: Currency = display) => formatMoney(n, cur),
      fmt0: (n: number, cur: Currency = display) => formatMoney0(n, cur),
      fmtSigned: (n: number, cur: Currency = display) => formatSigned(n, cur),
      fmtCompact: (n: number, cur: Currency = display) => formatCompact(n, cur),
      /** Compact, shortened sooner — for small stat tiles. */
      fmtTiny: (n: number, cur: Currency = display) => formatCompact(n, cur, true),
    };
  }, [display, rates]);
}
