import { motion } from "motion/react";
import { Check, Lock } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { EXAMPLES, groupInput, parseInput, type Currency } from "../currency";
import { makeCard, type Card, type CardType } from "../data";
import { BRAND_LABEL, cvvLength, detectBrand, expiryValid, formatExpiry, formatNumber, luhnValid, numberLength, type CardSecrets, type Sealed } from "../vault";
import { CardBack, CardFace } from "./Card";
import { CurrencyPicker, MoneyInput, Segmented, softSpring } from "./ui";

export interface CardDraft {
  type: CardType;
  currency: Currency;
  issuer: string;
  nickname: string;
  holder: string;
  /** Digits only. */
  number: string;
  expiry: string;
  cvv: string;
  balance: string;
  limit: string;
}

export const EMPTY_DRAFT: CardDraft = { type: "debit", currency: "UZS", issuer: "", nickname: "", holder: "", number: "", expiry: "", cvv: "", balance: "", limit: "" };

const num = (s: string) => Number(s.replace(/[^0-9.]/g, "")) || 0;

export function detailsErrors(d: Pick<CardDraft, "holder" | "number" | "expiry" | "cvv">) {
  const brand = detectBrand(d.number);
  return {
    holder: d.holder.trim().length < 2,
    number: d.number.length !== numberLength(brand) || !luhnValid(d.number),
    expiry: !expiryValid(d.expiry),
    cvv: d.cvv.length !== cvvLength(brand),
  };
}

export function draftIsValid(d: CardDraft) {
  const e = detailsErrors(d);
  return d.issuer.trim().length > 0 && !e.holder && !e.number && !e.expiry && !e.cvv && (d.type === "debit" || num(d.limit) > 0);
}

export const draftSecrets = (d: CardDraft): CardSecrets => ({ number: d.number, cvv: d.cvv });

/** Turns the form into a card. For credit, "balance" is what's been spent so far. */
export function draftToCard(d: CardDraft, index: number, secret: Sealed | null): Card {
  const limit = num(d.limit);
  return makeCard(
    {
      issuer: d.issuer,
      nickname: d.nickname,
      type: d.type,
      currency: d.currency,
      last4: d.number.slice(-4) || "0000",
      holder: d.holder,
      expiry: d.expiry,
      brand: detectBrand(d.number),
      secret,
      balance: d.type === "credit" ? Math.max(0, limit - num(d.balance)) : num(d.balance),
      limit: d.type === "credit" ? limit : undefined,
    },
    index,
  );
}

export function Field({ label, children, error, hint }: { label: string; children: ReactNode; error?: boolean; hint?: ReactNode }) {
  return (
    <label className={`field ${error ? "is-error" : ""}`}>
      <span className="field-label">
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** Holder, number, expiry and CVV — shared by "add card" and "update card details". */
export function DetailsFields({ draft, set, onCvvFocus }: { draft: CardDraft; set: (p: Partial<CardDraft>) => void; onCvvFocus?: (focused: boolean) => void }) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const brand = detectBrand(draft.number);
  const errors = detailsErrors(draft);
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const numberDone = !errors.number;

  return (
    <div className="fields">
      <Field label="Name on card" error={touched.holder && errors.holder}>
        <input value={draft.holder} maxLength={26} placeholder="As printed on the card" autoComplete="cc-name" onBlur={touch("holder")} onChange={(e) => set({ holder: e.target.value })} />
      </Field>
      <Field
        label="Card number"
        error={touched.number && errors.number}
        hint={
          draft.number.length > 0 && (
            <span className={`brand-tag ${numberDone ? "is-ok" : ""}`}>
              {numberDone && <Check size={11} strokeWidth={3.4} />}
              {BRAND_LABEL[brand]}
            </span>
          )
        }
      >
        <input
          value={formatNumber(draft.number)}
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="1234 5678 9012 3456"
          onBlur={touch("number")}
          onChange={(e) => set({ number: e.target.value.replace(/\D/g, "").slice(0, numberLength(detectBrand(e.target.value.replace(/\D/g, "")))) })}
        />
      </Field>
      <div className="field-pair">
        <Field label="Expires" error={touched.expiry && errors.expiry}>
          <input value={draft.expiry} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" onBlur={touch("expiry")} onChange={(e) => set({ expiry: formatExpiry(e.target.value) })} />
        </Field>
        <Field label={brand === "amex" ? "CID" : "CVV"} error={touched.cvv && errors.cvv}>
          <input
            value={draft.cvv}
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder={brand === "amex" ? "4 digits" : "3 digits"}
            onFocus={() => onCvvFocus?.(true)}
            onBlur={() => {
              touch("cvv")();
              onCvvFocus?.(false);
            }}
            onChange={(e) => set({ cvv: e.target.value.replace(/\D/g, "").slice(0, cvvLength(brand)) })}
          />
        </Field>
      </div>
    </div>
  );
}

export function CardForm({ draft, onChange, index = 0 }: { draft: CardDraft; onChange: (d: CardDraft) => void; index?: number }) {
  const set = (patch: Partial<CardDraft>) => onChange({ ...draft, ...patch });
  const [flipped, setFlipped] = useState(false);

  // Live preview: a stable id keeps the skin steady while typing.
  const preview = useMemo(() => {
    const c = draftToCard({ ...draft, issuer: draft.issuer || "Your bank" }, index, null);
    return { ...c, id: "preview", last4: draft.number.length >= 4 ? draft.number.slice(-4) : "••••" };
  }, [draft, index]);

  const cur = draft.currency;
  // Switching currency keeps the digits you typed, trimmed to what the new currency allows.
  const setCurrency = (currency: Currency) =>
    set({ currency, balance: parseInput(groupInput(draft.balance || "0", cur), currency).replace(/^0$/, ""), limit: parseInput(groupInput(draft.limit || "0", cur), currency).replace(/^0$/, "") });

  return (
    <div className="card-form">
      <motion.div className="form-preview" initial={{ rotateX: 30, y: 30, opacity: 0 }} animate={{ rotateX: 6, y: 0, opacity: 1 }} transition={softSpring}>
        <motion.div className="flipper" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: "spring", stiffness: 170, damping: 20 }}>
          <div className="face front">
            <CardFace card={preview} />
          </div>
          <div className="face back">
            <CardBack card={preview} secrets={draftSecrets(draft)} />
          </div>
        </motion.div>
      </motion.div>

      <div className="form-type">
        <Segmented
          id="card-type"
          value={draft.type}
          onChange={(type) => set({ type })}
          options={[
            { id: "debit", label: "Debit" },
            { id: "credit", label: "Credit" },
          ]}
        />
        <CurrencyPicker id="card-currency" value={cur} onChange={setCurrency} />
      </div>

      <div className="form-section-label">Card details</div>
      <DetailsFields draft={draft} set={set} onCvvFocus={setFlipped} />

      <div className="form-section-label">In Finn</div>
      <div className="fields">
        <Field label="Bank or issuer">
          <input value={draft.issuer} maxLength={18} placeholder="e.g. My Bank" onChange={(e) => set({ issuer: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Card name">
          <input value={draft.nickname} maxLength={22} placeholder={draft.type === "credit" ? "Rewards" : "Everyday"} onChange={(e) => set({ nickname: e.target.value })} autoComplete="off" />
        </Field>
        {draft.type === "credit" && (
          <Field label="Credit limit">
            <MoneyInput currency={cur} value={draft.limit} placeholder={groupInput(String(EXAMPLES[cur].limit), cur)} onChange={(limit) => set({ limit })} />
          </Field>
        )}
        <Field label={draft.type === "credit" ? "Spent so far" : "Current balance"}>
          <MoneyInput currency={cur} value={draft.balance} placeholder="0" onChange={(balance) => set({ balance })} />
        </Field>
      </div>

      <div className="secure-note">
        <Lock size={14} strokeWidth={2.6} /> Number and CVV are encrypted on this device with your passcode. They're never uploaded.
      </div>
    </div>
  );
}
