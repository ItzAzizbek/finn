import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Delete, Lock, Paintbrush, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { convert, CURRENCIES, EXAMPLES, formatMoney, groupInput, roundFor, type Currency } from "../currency";
import { CardBack, CardFace } from "../components/Card";
import { CardForm, DetailsFields, detailsErrors, draftIsValid, draftSecrets, draftToCard, EMPTY_DRAFT, type CardDraft } from "../components/CardForm";
import { CategoryIcon, Icon } from "../components/icons";
import { StudioEditor } from "../components/Studio";
import { Button, CurrencyPicker, MoneyInput, ScreenHeader, Segmented, Sheet, spring, TxnList } from "../components/ui";
import { CATEGORIES, SPEND_CATEGORIES, uid, type Card, type CategoryId } from "../data";
import { haptic } from "../lib";
import { useStore } from "../store";
import { detectBrand, seal, unseal, type CardSecrets } from "../vault";

// ─── Card Studio ────────────────────────────────────────────────────────

export function StudioScreen({ id }: { id: string }) {
  const { state, dispatch, close, toast } = useStore();
  const original = state.cards.find((c) => c.id === id);
  const [card, setCard] = useState<Card | undefined>(original);
  if (!card) return null;
  const others = state.cards.filter((c) => c.id !== id);

  return (
    <motion.div className="overlay screen studio-screen" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 340, damping: 38 }}>
      <div className="overlay-scroll">
        <ScreenHeader
          onBack={close}
          title="Card Studio"
          right={
            <button
              type="button"
              className="save-btn"
              onClick={() => {
                haptic(12);
                // Keep live data (balance, frozen) from the store; take everything designable from the draft.
                dispatch({ type: "updateCard", card: { ...card, balance: original?.balance ?? card.balance, frozen: original?.frozen ?? card.frozen } });
                toast("Fresh look saved");
                close();
              }}
            >
              Save
            </button>
          }
        />
        <StudioEditor card={card} onChange={setCard} />
        {others.length > 0 && (
          <div className="studio-copy">
            <span className="dim">Copy this look to</span>
            <div className="copy-row">
              {others.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="copy-card"
                  onClick={() => {
                    dispatch({ type: "updateCard", card: { ...c, design: card.design } });
                    toast(`Look copied to ${c.nickname || c.issuer}`);
                  }}
                >
                  <CardFace card={c} showBalance={false} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Log / edit a transaction ───────────────────────────────────────────

/** Soʻm has no coins in use, so its keypad swaps the decimal point for a fast "000". */
const keysFor = (cur: Currency) => ["1", "2", "3", "4", "5", "6", "7", "8", "9", CURRENCIES[cur].decimals ? "." : "000", "0", "del"];

/** yyyy-mm-dd in local time, for <input type="date">. */
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function amountToRaw(n: number) {
  const abs = Math.abs(n);
  return Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/0$/, "");
}

export function TxnSheet({ cardId, txnId }: { cardId?: string; txnId?: string }) {
  const { state, dispatch, close, open, toast } = useStore();
  const existing = txnId ? state.txns.find((t) => t.id === txnId) : undefined;
  const today = dateKey(new Date());
  const yesterday = dateKey(new Date(Date.now() - 86_400_000));

  const [raw, setRaw] = useState(existing ? amountToRaw(existing.amount) : "0");
  const [dirn, setDirn] = useState<"out" | "in">(existing && existing.amount > 0 ? "in" : "out");
  const [cat, setCat] = useState<CategoryId>(existing && existing.category !== "income" ? existing.category : "food");
  const [merchant, setMerchant] = useState(existing?.merchant ?? "");
  const [card, setCard] = useState(existing?.cardId ?? cardId ?? state.cards[0]?.id);
  const [day, setDay] = useState(existing ? dateKey(new Date(existing.date)) : today);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const amount = Number(raw) || 0;
  const cur: Currency = state.cards.find((c) => c.id === card)?.currency ?? state.currency;
  const spec = CURRENCIES[cur];

  // Moving the transaction to a soʻm card drops any cents typed for a dollar/ruble card.
  useEffect(() => {
    if (!spec.decimals) setRaw((r) => r.split(".")[0] || "0");
  }, [spec.decimals]);

  // Quick-pick the places you actually spend at.
  const recent = useMemo(() => {
    const seen = new Map<string, CategoryId>();
    for (const t of state.txns) {
      if (t.amount < 0 && !seen.has(t.merchant)) seen.set(t.merchant, t.category);
      if (seen.size >= 8) break;
    }
    return [...seen.entries()];
  }, [state.txns]);

  if (!state.cards.length) {
    return (
      <Sheet onClose={close} title="Log a transaction">
        <div className="empty">
          <div className="empty-icon">
            <Icon name="receipt" size={34} />
          </div>
          Add a card first
          <p>Every transaction belongs to a card.</p>
          <button
            type="button"
            className="chip-btn"
            onClick={() => {
              close();
              open({ kind: "addCard" });
            }}
          >
            Add a card
          </button>
        </div>
      </Sheet>
    );
  }

  const press = (k: string) => {
    haptic(5);
    setRaw((r) => {
      if (k === "del") return r.length > 1 ? r.slice(0, -1) : "0";
      if (k === ".") return r.includes(".") ? r : r + ".";
      const [, dec] = r.split(".");
      if (dec !== undefined && dec.length >= spec.decimals) return r;
      if (r === "0" && k === "000") return r;
      const next = r === "0" ? k : r + k;
      return next.split(".")[0].length > spec.scale.maxDigits ? r : next;
    });
  };

  const display = groupInput(raw, cur);
  const sizeClass = display.length > 11 ? "is-xlong" : display.length > 7 ? "is-long" : "";

  const save = () => {
    if (!card || !amount) return;
    const category: CategoryId = dirn === "in" ? "income" : cat;
    let date: string;
    if (existing && day === dateKey(new Date(existing.date))) date = existing.date;
    else if (day === today) date = new Date().toISOString();
    else date = new Date(`${day}T12:00:00`).toISOString();
    const txn = {
      id: existing?.id ?? uid(),
      cardId: card,
      currency: cur,
      merchant: merchant.trim() || CATEGORIES[category].label,
      category,
      amount: dirn === "in" ? amount : -amount,
      date,
    };
    dispatch(existing ? { type: "updateTxn", txn } : { type: "addTxn", txn });
    toast(existing ? "Transaction updated" : `Logged ${formatMoney(amount, cur)} · ${CATEGORIES[category].label}`);
    close();
  };

  return (
    <Sheet onClose={close} className="add-sheet">
      <div className="add-top">
        <Segmented
          id="dir"
          value={dirn}
          onChange={setDirn}
          options={[
            { id: "out", label: "Money out" },
            { id: "in", label: "Money in" },
          ]}
        />
      </div>
      <div className={`amount ${sizeClass} ${dirn === "in" ? "is-in" : ""}`}>
        {spec.position === "prefix" && <span className="amount-sign">{spec.symbol}</span>}
        <AnimatePresence mode="popLayout" initial={false}>
          {display.split("").map((ch, i) => (
            <motion.span key={`${i}-${ch}`} initial={{ y: 24, opacity: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -18, opacity: 0 }} transition={spring}>
              {ch}
            </motion.span>
          ))}
        </AnimatePresence>
        {spec.position === "suffix" && <span className="amount-sign is-suffix">{spec.symbol}</span>}
      </div>
      <input className="merchant-input" placeholder={dirn === "in" ? "Who paid you?" : "What was it?"} value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={28} />
      {dirn === "out" && !merchant && recent.length > 0 && (
        <div className="recent-chips">
          {recent.map(([m, c]) => (
            <button
              key={m}
              type="button"
              className="recent-chip"
              onClick={() => {
                setMerchant(m);
                setCat(c);
              }}
            >
              {m}
            </button>
          ))}
        </div>
      )}
      {dirn === "out" && (
        <div className="cat-chips">
          {SPEND_CATEGORIES.map((id) => (
            <button key={id} type="button" className={`cat-chip ${cat === id ? "is-on" : ""}`} style={{ ["--c" as string]: CATEGORIES[id].color }} onClick={() => setCat(id)}>
              <CategoryIcon id={id} size={17} />
              {CATEGORIES[id].label}
            </button>
          ))}
        </div>
      )}
      <div className="date-row">
        <button type="button" className={`chip-btn ${day === today ? "is-active" : ""}`} onClick={() => setDay(today)}>
          Today
        </button>
        <button type="button" className={`chip-btn ${day === yesterday ? "is-active" : ""}`} onClick={() => setDay(yesterday)}>
          Yesterday
        </button>
        <label className={`chip-btn date-pick ${day !== today && day !== yesterday ? "is-active" : ""}`}>
          <CalendarDays size={14} strokeWidth={2.6} />
          {day !== today && day !== yesterday ? new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Pick date"}
          <input type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Transaction date" />
        </label>
      </div>
      <div className="card-picker">
        {state.cards.map((c) => (
          <button key={c.id} type="button" className={`pick-card ${card === c.id ? "is-on" : ""}`} onClick={() => setCard(c.id)} aria-label={`${c.nickname || c.issuer} ${c.last4}`}>
            <CardFace card={c} showBalance={false} />
          </button>
        ))}
      </div>
      <div className="keypad">
        {keysFor(cur).map((k) => (
          <motion.button key={k} type="button" whileTap={{ scale: 0.86, backgroundColor: "rgba(255,255,255,.14)" }} onClick={() => press(k)} aria-label={k === "del" ? "Delete" : k}>
            {k === "del" ? <Delete size={24} strokeWidth={2.2} /> : k}
          </motion.button>
        ))}
      </div>
      <Button onClick={save} disabled={!amount || !card}>
        {!amount ? "Enter an amount" : existing ? "Save changes" : `Log ${formatMoney(amount, cur)}`}
      </Button>
      {existing && (
        <button
          type="button"
          className="danger-link"
          onClick={() => {
            haptic(15);
            if (!confirmDelete) return setConfirmDelete(true);
            dispatch({ type: "deleteTxn", id: existing.id });
            toast("Transaction deleted");
            close();
          }}
        >
          <Trash2 size={16} strokeWidth={2.4} />
          {confirmDelete ? "Tap again to delete" : "Delete transaction"}
        </button>
      )}
    </Sheet>
  );
}

// ─── Edit a card's numbers ──────────────────────────────────────────────

const num = (s: string) => Number(s) || 0;

export function EditCardSheet({ id }: { id: string }) {
  const { state, dispatch, close, open, toast } = useStore();
  const card = state.cards.find((c) => c.id === id);
  const credit = card?.type === "credit";
  const [balance, setBalance] = useState(card ? String(credit ? Math.max(0, (card.limit ?? 0) - card.balance) : card.balance) : "");
  const [limit, setLimit] = useState(card?.limit !== undefined ? String(card.limit) : "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!card) return null;

  const valid = !credit || num(limit) > 0;
  const save = () => {
    const lim = num(limit);
    dispatch({
      type: "updateCard",
      card: { ...card, limit: credit ? lim : undefined, balance: roundFor(credit ? lim - num(balance) : num(balance), card.currency) },
    });
    toast("Card updated");
    close();
  };

  return (
    <Sheet onClose={close} title="Edit card">
      <div className="edit-card-preview">
        <CardFace card={card} />
      </div>
      <div className="fields">
        {credit && (
          <label className="field">
            <span className="field-label">Credit limit</span>
            <MoneyInput currency={card.currency} value={limit} onChange={setLimit} />
          </label>
        )}
        <label className="field">
          <span className="field-label">{credit ? "Currently owed" : "Current balance"}</span>
          <MoneyInput currency={card.currency} value={balance} onChange={setBalance} />
        </label>
      </div>
      <p className="sheet-note">
        Amounts in {CURRENCIES[card.currency].name.toLowerCase()}. Use this to match your bank app — it corrects the balance without adding a transaction.
      </p>
      <div className="sheet-actions">
        <Button disabled={!valid} onClick={save}>
          Save
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            close();
            open({ kind: "studio", id });
          }}
        >
          <Paintbrush size={18} strokeWidth={2.4} /> Change design & text
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            close();
            open({ kind: "cardDetails", id });
          }}
        >
          <Lock size={18} strokeWidth={2.4} /> {card.secret ? "Update card number & CVV" : "Add card number & CVV"}
        </Button>
      </div>
      <button
        type="button"
        className="danger-link"
        onClick={() => {
          haptic(15);
          if (!confirmDelete) return setConfirmDelete(true);
          dispatch({ type: "deleteCard", id });
          toast("Card removed");
          close(); // this sheet
          close(); // the card screen underneath
        }}
      >
        <Trash2 size={16} strokeWidth={2.4} />
        {confirmDelete ? "Tap again — removes its transactions too" : "Remove card"}
      </button>
    </Sheet>
  );
}

// ─── Subscriptions ──────────────────────────────────────────────────────

export function SubSheet({ id }: { id?: string }) {
  const { state, dispatch, close, toast } = useStore();
  const existing = id ? state.subscriptions.find((x) => x.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [day, setDay] = useState(existing ? String(existing.day) : String(new Date().getDate()));
  const [cardId, setCardId] = useState<string | null>(existing ? existing.cardId : (state.cards[0]?.id ?? null));
  const cardCurrency = (cid: string | null) => state.cards.find((c) => c.id === cid)?.currency;
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? cardCurrency(cardId) ?? state.currency);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dayNum = Math.min(31, Math.max(1, Number(day) || 1));
  const valid = name.trim().length > 0 && num(amount) > 0;

  const sub = { id: existing?.id ?? uid(), name: name.trim(), amount: num(amount), day: dayNum, cardId, currency };

  return (
    <Sheet onClose={close} title={existing ? "Edit subscription" : "Add subscription"}>
      <div className="fields">
        <label className="field">
          <span className="field-label">Name</span>
          <input value={name} maxLength={24} placeholder="e.g. Music streaming" onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </label>
        <label className="field">
          <span className="field-label">Monthly price</span>
          <MoneyInput currency={currency} value={amount} placeholder={groupInput(String(EXAMPLES[currency].sub), currency)} onChange={setAmount} />
        </label>
        <label className="field">
          <span className="field-label">Renews on day of month</span>
          <input value={day} inputMode="numeric" maxLength={2} onChange={(e) => setDay(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>
      {state.cards.length > 0 && (
        <div className="tool-block">
          <div className="tool-label">Charged to</div>
          <div className="date-row">
            {state.cards.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip-btn ${cardId === c.id ? "is-active" : ""}`}
                onClick={() => {
                  setCardId(c.id);
                  setCurrency(c.currency); // a subscription is billed in its card's currency by default
                }}
              >
                {c.nickname || c.issuer} · {c.last4} · {c.currency}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="tool-block">
        <div className="tool-label">Billed in</div>
        <CurrencyPicker id="sub-currency" value={currency} onChange={setCurrency} />
      </div>
      <div className="sheet-actions">
        <Button
          disabled={!valid}
          onClick={() => {
            dispatch({ type: "saveSub", sub });
            toast(existing ? "Subscription updated" : "Subscription added");
            close();
          }}
        >
          {existing ? "Save" : "Add subscription"}
        </Button>
        {existing && cardId && (
          <Button
            variant="ghost"
            onClick={() => {
              // The charge lands on the card in the card's currency.
              const cardCur = cardCurrency(cardId) ?? currency;
              const charge = roundFor(convert(sub.amount, currency, cardCur, state.rates), cardCur);
              dispatch({
                type: "addTxn",
                txn: { id: uid(), cardId, currency: cardCur, merchant: sub.name, category: "subs", amount: -charge, date: new Date().toISOString() },
              });
              toast(`Logged ${formatMoney(charge, cardCur)} for ${sub.name}`);
              close();
            }}
          >
            Log this month's charge
          </Button>
        )}
      </div>
      {existing && (
        <button
          type="button"
          className="danger-link"
          onClick={() => {
            haptic(15);
            if (!confirmDelete) return setConfirmDelete(true);
            dispatch({ type: "deleteSub", id: existing.id });
            toast("Subscription removed");
            close();
          }}
        >
          <Trash2 size={16} strokeWidth={2.4} />
          {confirmDelete ? "Tap again to remove" : "Remove subscription"}
        </button>
      )}
    </Sheet>
  );
}

// ─── Add a card ─────────────────────────────────────────────────────────

export function AddCardSheet() {
  const { state, dispatch, close, open, toast, withKey } = useStore();
  const [draft, setDraft] = useState<CardDraft>({ ...EMPTY_DRAFT, currency: state.currency });
  const valid = draftIsValid(draft);

  // Unlock (or create) the vault first, then encrypt the number + CVV before anything is saved.
  const add = (design: boolean) =>
    withKey(async (key) => {
      const card = draftToCard(draft, state.cards.length, await seal(key, draftSecrets(draft)));
      dispatch({ type: "addCards", cards: [card] });
      toast("Card added to your wallet");
      close();
      if (design) open({ kind: "studio", id: card.id });
    });

  return (
    <Sheet onClose={close} title="Add a card" className="add-card-sheet">
      <CardForm draft={draft} onChange={setDraft} index={state.cards.length} />
      <div className="sheet-actions">
        <Button disabled={!valid} onClick={() => add(true)}>
          Add & design it
        </Button>
        <Button variant="ghost" disabled={!valid} onClick={() => add(false)}>
          Just add it
        </Button>
      </div>
    </Sheet>
  );
}

// ─── All activity ───────────────────────────────────────────────────────

export function Activity() {
  const { state, close } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategoryId | "all">("all");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.txns.filter((t) => (cat === "all" || t.category === cat) && (!needle || t.merchant.toLowerCase().includes(needle)));
  }, [state.txns, q, cat]);

  return (
    <motion.div className="overlay screen" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 40 }}>
      <div className="overlay-scroll">
        <ScreenHeader onBack={close} title="All activity" />
        <label className="search">
          <Search size={18} strokeWidth={2.4} />
          <input placeholder="Search merchants" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="cat-chips">
          <button type="button" className={`cat-chip ${cat === "all" ? "is-on" : ""}`} style={{ ["--c" as string]: "#f5f5f7" }} onClick={() => setCat("all")}>
            All
          </button>
          {(Object.keys(CATEGORIES) as CategoryId[]).map((id) => (
            <button key={id} type="button" className={`cat-chip ${cat === id ? "is-on" : ""}`} style={{ ["--c" as string]: CATEGORIES[id].color }} onClick={() => setCat(id)}>
              <CategoryIcon id={id} size={17} />
              {CATEGORIES[id].label}
            </button>
          ))}
        </div>
        <TxnList txns={list} limit={150} />
      </div>
    </motion.div>
  );
}

// ─── Card number & CVV ──────────────────────────────────────────────────

export function CardDetailsSheet({ id }: { id: string }) {
  const { state, dispatch, close, toast, withKey } = useStore();
  const card = state.cards.find((c) => c.id === id);
  const [draft, setDraft] = useState<CardDraft>({ ...EMPTY_DRAFT, holder: card?.holder ?? "", expiry: card?.expiry ?? "" });
  const [loaded, setLoaded] = useState(!card?.secret);
  const asked = useRef(false);
  const secret = card?.secret ?? null;

  const unlock = () =>
    secret &&
    withKey(async (key) => {
      const secrets = await unseal<CardSecrets>(key, secret);
      setDraft((d) => ({ ...d, number: secrets.number, cvv: secrets.cvv }));
      setLoaded(true);
    });

  // Existing details are encrypted: ask for the passcode once on open, then prefill.
  useEffect(() => {
    if (asked.current || loaded) return;
    asked.current = true; // StrictMode runs effects twice; only prompt once
    unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!card) return null;
  const e = detailsErrors(draft);
  const valid = loaded && !e.holder && !e.number && !e.expiry && !e.cvv;

  return (
    <Sheet onClose={close} title={card.secret ? "Card details" : "Add card details"}>
      <div className="edit-card-preview">
        <CardBack card={{ ...card, holder: draft.holder, expiry: draft.expiry, brand: detectBrand(draft.number), last4: draft.number.slice(-4) || card.last4 }} secrets={loaded ? draftSecrets(draft) : null} />
      </div>
      {loaded ? (
        <DetailsFields draft={draft} set={(p) => setDraft((d) => ({ ...d, ...p }))} />
      ) : (
        <div className="empty">
          Locked
          <p>Enter your passcode to see or change this card's number.</p>
          <button type="button" className="chip-btn" onClick={unlock}>
            Unlock
          </button>
        </div>
      )}
      <div className="sheet-actions">
        <Button
          disabled={!valid}
          onClick={() =>
            withKey(async (key) => {
              dispatch({
                type: "updateCard",
                card: {
                  ...card,
                  holder: draft.holder.trim(),
                  expiry: draft.expiry,
                  brand: detectBrand(draft.number),
                  last4: draft.number.slice(-4),
                  secret: await seal(key, draftSecrets(draft)),
                },
              });
              toast("Card details saved");
              close();
            })
          }
        >
          Save details
        </Button>
      </div>
    </Sheet>
  );
}
