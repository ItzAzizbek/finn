// ─── Currencies ─────────────────────────────────────────────────────────
// Finn speaks three currencies. Each card holds money in its own currency;
// totals, budgets and insights are shown in the user's display currency,
// converted with exchange rates the user controls (no network, ever).

export type Currency = "UZS" | "USD" | "RUB";

export const CURRENCY_LIST: Currency[] = ["UZS", "USD", "RUB"];

interface CurrencySpec {
  code: Currency;
  name: string;
  symbol: string;
  /** "$12" vs "12 ₽" */
  position: "prefix" | "suffix";
  /** Max fraction digits users can enter / we show. Soʻm has no coins in use. */
  decimals: 0 | 2;
  /** Hide ",00" on whole amounts (common for ₽); USD always shows cents. */
  trimZeroCents: boolean;
  group: string;
  decimal: string;
  /** Sensible magnitudes — budgets, sliders, input lengths. */
  scale: {
    budgetMin: number;
    budgetMax: number;
    budgetStep: number;
    budgetPresets: number[];
    defaultBudget: number;
    maxDigits: number;
    /** Below this, compact formatting keeps the full number. */
    compactFrom: number;
  };
}

const NBSP = " ";

export const CURRENCIES: Record<Currency, CurrencySpec> = {
  USD: {
    code: "USD",
    name: "US dollar",
    symbol: "$",
    position: "prefix",
    decimals: 2,
    trimZeroCents: false,
    group: ",",
    decimal: ".",
    scale: { budgetMin: 300, budgetMax: 8000, budgetStep: 50, budgetPresets: [1000, 2000, 3000, 5000], defaultBudget: 2000, maxDigits: 7, compactFrom: 10_000 },
  },
  UZS: {
    code: "UZS",
    name: "Uzbek soʻm",
    symbol: "soʻm",
    position: "suffix",
    decimals: 0,
    trimZeroCents: true,
    group: NBSP,
    decimal: ",",
    scale: {
      budgetMin: 2_000_000,
      budgetMax: 60_000_000,
      budgetStep: 250_000,
      budgetPresets: [5_000_000, 10_000_000, 20_000_000, 35_000_000],
      defaultBudget: 10_000_000,
      maxDigits: 12,
      compactFrom: 1_000_000,
    },
  },
  RUB: {
    code: "RUB",
    name: "Russian ruble",
    symbol: "₽",
    position: "suffix",
    decimals: 2,
    trimZeroCents: true,
    group: NBSP,
    decimal: ",",
    scale: {
      budgetMin: 20_000,
      budgetMax: 600_000,
      budgetStep: 5_000,
      budgetPresets: [50_000, 100_000, 200_000, 350_000],
      defaultBudget: 100_000,
      maxDigits: 9,
      compactFrom: 100_000,
    },
  },
};

/** How many units of each currency one US dollar buys. User-editable in settings. */
export type Rates = Record<Currency, number>;

export const DEFAULT_RATES: Rates = { USD: 1, UZS: 12_500, RUB: 85 };

export function convert(amount: number, from: Currency, to: Currency, rates: Rates) {
  if (from === to) return amount;
  return (amount / rates[from]) * rates[to];
}

/** Rounds to what the currency can actually hold (soʻm → whole numbers). */
export function roundFor(n: number, cur: Currency) {
  const f = 10 ** CURRENCIES[cur].decimals;
  return Math.round(n * f) / f;
}

/** Nicely rounded number for budgets after converting between currencies. */
export function roundToStep(n: number, cur: Currency) {
  const { budgetStep, budgetMin, budgetMax } = CURRENCIES[cur].scale;
  return Math.min(budgetMax, Math.max(budgetMin, Math.round(n / budgetStep) * budgetStep));
}

// ─── Formatting ─────────────────────────────────────────────────────────

export interface MoneyParts {
  sign: string;
  prefix: string;
  whole: string;
  /** Includes the decimal separator, e.g. ".52" / ",50" — or "" */
  frac: string;
  suffix: string;
}

function groupDigits(int: string, sep: string) {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function moneyParts(n: number, cur: Currency, opts: { decimals?: 0 | 2; signed?: boolean } = {}): MoneyParts {
  const spec = CURRENCIES[cur];
  const decimals = opts.decimals ?? spec.decimals;
  const abs = Math.abs(roundFor(n, cur));
  const fixed = abs.toFixed(decimals);
  let [int, frac = ""] = fixed.split(".");
  if (frac && spec.trimZeroCents && /^0+$/.test(frac)) frac = "";
  const sign = n < 0 && abs > 0 ? "−" : opts.signed && abs > 0 ? "+" : "";
  return {
    sign,
    prefix: spec.position === "prefix" ? spec.symbol : "",
    whole: groupDigits(int, spec.group),
    frac: frac ? spec.decimal + frac : "",
    suffix: spec.position === "suffix" ? NBSP + spec.symbol : "",
  };
}

const join = (p: MoneyParts) => `${p.sign}${p.prefix}${p.whole}${p.frac}${p.suffix}`;

/** Full amount: "$1,234.56", "1 250 000 soʻm", "1 234,50 ₽". */
export const formatMoney = (n: number, cur: Currency) => join(moneyParts(n, cur));

/** Whole units only — for budgets and round figures. */
export const formatMoney0 = (n: number, cur: Currency) => join(moneyParts(n, cur, { decimals: 0 }));

/** With an explicit + / − sign, for transaction amounts. */
export const formatSigned = (n: number, cur: Currency) => join(moneyParts(n, cur, { signed: true }));

/**
 * Short form for tight spots: "$12.4K", "1,25M soʻm", "120K ₽". Small amounts stay exact.
 * `tight` shortens 10× sooner, for small tiles ("156K soʻm" instead of "156 250 soʻm").
 */
export function formatCompact(n: number, cur: Currency, tight = false) {
  const p = compactParts(n, cur, tight);
  return p.prefix + p.value + p.suffix;
}

/** Compact amount split so the number and the currency can be styled separately. */
export function compactParts(n: number, cur: Currency, tight = false) {
  const spec = CURRENCIES[cur];
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  let value: string;
  if (abs < spec.scale.compactFrom / (tight ? 10 : 1)) {
    const p = moneyParts(n, cur, { decimals: 0 });
    value = p.whole;
  } else {
    const [div, unit] = abs >= 1e9 ? [1e9, "B"] : abs >= 1e6 ? [1e6, "M"] : [1e3, "K"];
    const v = abs / div;
    const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
    // Trim trailing zeros only after the decimal point ("1.50" → "1.5", but "150" stays).
    value = v.toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "").replace(".", spec.decimal) + unit;
  }
  return spec.position === "prefix"
    ? { prefix: sign + spec.symbol, value, suffix: "" }
    : { prefix: sign, value, suffix: NBSP + spec.symbol };
}

/** Plain grouped digits for inputs: 1250000 → "1 250 000" (soʻm) / "1,250,000" ($). */
export function groupInput(raw: string, cur: Currency) {
  const spec = CURRENCIES[cur];
  const [int, frac] = raw.split(".");
  const grouped = groupDigits(int.replace(/^0+(?=\d)/, "") || "0", spec.group);
  return frac !== undefined ? grouped + spec.decimal + frac : grouped;
}

/**
 * Normalizes typed text into a raw amount string ("1250000", "12.5"):
 * strips grouping, accepts either "." or "," as the decimal mark where the
 * currency uses a comma, and caps digits/decimals to what the currency allows.
 */
export function parseInput(text: string, cur: Currency) {
  const spec = CURRENCIES[cur];
  let t = text.split(spec.group).join("").replace(/\s/g, "");
  t = spec.decimal === "," ? t.replace(/,/g, ".") : t.replace(/,/g, "");
  t = t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
  const [int, frac] = t.split(".");
  const whole = int.slice(0, spec.scale.maxDigits);
  if (spec.decimals === 0 || frac === undefined) return whole;
  return `${whole}.${frac.slice(0, spec.decimals)}`;
}

/** Example amounts for input placeholders, in each currency's own scale. */
export const EXAMPLES: Record<Currency, { limit: number; balance: number; sub: number }> = {
  USD: { limit: 5_000, balance: 1_200, sub: 9.99 },
  UZS: { limit: 20_000_000, balance: 3_500_000, sub: 50_000 },
  RUB: { limit: 150_000, balance: 40_000, sub: 299 },
};
