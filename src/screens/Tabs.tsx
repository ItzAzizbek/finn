import { motion } from "motion/react";
import { ChevronRight, EyeOff, HardDrive, KeyRound, Lock, PiggyBank, Plus, RotateCcw, Snowflake, Trash2 } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { CardFace } from "../components/Card";
import { CurrencyPicker, softSpring, Toggle } from "../components/ui";
import { Icon } from "../components/icons";
import { GOALS } from "../data";
import { CURRENCIES, DEFAULT_RATES, formatMoney0, type Currency } from "../currency";
import { haptic, initials, spentInMonth } from "../lib";
import { useMoney, useStore, type Prefs } from "../store";

// ─── Cards ──────────────────────────────────────────────────────────────

export function CardsTab() {
  const { state, open } = useStore();
  return (
    <div className="page cards-tab">
      <header className="page-title">
        <h1>Cards</h1>
        <span className="count-pill">{state.cards.length}</span>
      </header>
      <div className="cards-list">
        {state.cards.map((c, i) => (
          <motion.div key={c.id} className="cards-item" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...softSpring, delay: i * 0.06 }}>
            <motion.button type="button" className="cards-item-card" whileTap={{ scale: 0.97 }} onClick={() => { haptic(); open({ kind: "card", id: c.id }); }}>
              <motion.div layoutId={`card-${c.id}`} transition={softSpring}>
                <CardFace card={c} stealth={state.prefs.stealth} />
              </motion.div>
            </motion.button>
            <div className="cards-item-meta">
              <div>
                <b>{c.nickname}</b>
                <small className="dim">
                  {c.issuer} {c.type} ·{" "}
                  {c.frozen ? (
                    <span className="frozen-tag">
                      <Snowflake size={12} strokeWidth={2.6} /> Frozen
                    </span>
                  ) : (
                    "Active"
                  )}
                </small>
              </div>
              <button type="button" className="chip-btn" onClick={() => open({ kind: "studio", id: c.id })}>
                Design
              </button>
            </div>
          </motion.div>
        ))}
        <motion.button type="button" className="wallet-empty add-tile" whileTap={{ scale: 0.97 }} onClick={() => open({ kind: "addCard" })}>
          <Plus size={26} strokeWidth={2.6} />
          Add another card
        </motion.button>
      </div>
    </div>
  );
}

// ─── Me ─────────────────────────────────────────────────────────────────

function Row({ icon, label, children, onClick, danger }: { icon: ReactNode; label: string; children?: ReactNode; onClick?: () => void; danger?: boolean }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={`row ${danger ? "is-danger" : ""}`} onClick={onClick}>
      <span className="row-icon">{icon}</span>
      <span className="row-label">{label}</span>
      {children ?? (onClick && <ChevronRight size={18} className="dim" />)}
    </Tag>
  );
}

export function MeTab() {
  const { state, dispatch, open, vaultKey, setVaultKey, toast } = useStore();
  const lockedCards = state.cards.filter((c) => c.secret).length;
  const [confirmReset, setConfirmReset] = useState(false);
  const pref = (key: keyof Prefs) => (v: boolean) => dispatch({ type: "pref", key, value: v });
  const { txnValue, fmt0, fmtTiny, display } = useMoney();
  const spentThisMonth = useMemo(() => spentInMonth(state.txns, txnValue), [state.txns, txnValue]);
  const { budgetMin, budgetMax, budgetStep } = CURRENCIES[display].scale;
  const logged = state.txns.length;
  // Rough size of what we keep in localStorage (UTF-16 → ~2 bytes per char), against the ~5 MB browser quota.
  const storageKb = useMemo(() => (JSON.stringify(state).length * 2) / 1024, [state]);

  return (
    <div className="page me">
      <header className="me-hero">
        <motion.div className="me-avatar" initial={{ scale: 0.6, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
          {initials(state.name)}
        </motion.div>
        <h1>{state.name || "You"}</h1>
        <p className="dim">
          On Finn since {new Date(state.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </header>

      <div className="me-stats">
        <div>
          <b>{state.cards.length}</b>
          <small>Cards</small>
        </div>
        <div>
          <b className={state.prefs.stealth ? "is-hidden" : ""}>{fmtTiny(spentThisMonth)}</b>
          <small>Spent this month</small>
        </div>
        <div>
          <b>{logged}</b>
          <small>Transactions</small>
        </div>
      </div>

      {state.goals.length > 0 && (
        <section className="me-goals">
          {GOALS.filter((g) => state.goals.includes(g.id)).map((g) => (
            <span key={g.id} className="goal is-on small">
              <span className="goal-icon">
                <Icon name={g.id} size={16} />
              </span>
              {g.label}
            </span>
          ))}
        </section>
      )}

      <section className="group">
        <div className="group-label">Budget</div>
        <div className="row row-col">
          <div className="row-line">
            <span className="row-icon">
              <PiggyBank size={18} strokeWidth={2.4} />
            </span>
            <span className="row-label">Monthly budget</span>
            <b>{fmt0(state.budget)}</b>
          </div>
          <input
            type="range"
            className="range"
            min={budgetMin}
            max={budgetMax}
            step={budgetStep}
            value={state.budget}
            aria-label="Monthly budget"
            style={{ "--p": `${((state.budget - budgetMin) / (budgetMax - budgetMin)) * 100}%` } as CSSProperties}
            onChange={(e) => dispatch({ type: "budget", budget: Number(e.target.value) })}
          />
        </div>
      </section>

      <section className="group">
        <div className="group-label">Currency</div>
        <div className="row row-col">
          <div className="row-line">
            <span className="row-label">Show totals in</span>
            <CurrencyPicker
              id="display-currency"
              value={display}
              onChange={(currency) => {
                haptic();
                dispatch({ type: "currency", currency });
              }}
            />
          </div>
          <small className="dim">Each card keeps its own currency. Totals, budget and insights convert to this one.</small>
        </div>
        <RatesEditor />
      </section>

      <section className="group">
        <div className="group-label">Preferences</div>
        <Row icon={<EyeOff size={18} strokeWidth={2.4} />} label="Stealth mode">
          <Toggle label="Stealth mode" on={state.prefs.stealth} onChange={pref("stealth")} />
        </Row>
      </section>

      <section className="group">
        <div className="group-label">Card security</div>
        {state.vault ? (
          <>
            <Row icon={<KeyRound size={18} strokeWidth={2.4} />} label="Change passcode" onClick={() => open({ kind: "passcode", mode: "change" })} />
            <Row
              icon={<Lock size={18} strokeWidth={2.4} />}
              label={vaultKey ? "Lock card details now" : "Card details locked"}
              onClick={
                vaultKey
                  ? () => {
                      setVaultKey(null);
                      toast("Locked");
                    }
                  : undefined
              }
            >
              {!vaultKey && <span className="dim small">{lockedCards} encrypted</span>}
            </Row>
          </>
        ) : (
          <Row icon={<KeyRound size={18} strokeWidth={2.4} />} label="Set up a passcode" onClick={() => open({ kind: "passcode", mode: "create" })} />
        )}
      </section>

      <section className="group">
        <div className="group-label">Your data</div>
        <div className="row row-col">
          <div className="row-line">
            <span className="row-icon">
              <HardDrive size={18} strokeWidth={2.4} />
            </span>
            <span className="row-label">Stored on this device</span>
            <b className="dim">{storageKb.toFixed(0)} KB</b>
          </div>
          <div className="meter thin">
            <div className="meter-fill" style={{ width: `${Math.max(1, Math.min(100, (storageKb / 5120) * 100))}%` }} />
          </div>
          <small className="dim">Everything stays in this browser's local storage — nothing is uploaded. Card numbers and CVVs are encrypted with your passcode. Clearing site data erases it all.</small>
        </div>
        <Row icon={<RotateCcw size={18} strokeWidth={2.4} />} label="Replay onboarding" onClick={() => dispatch({ type: "replayOnboarding" })} />
        <Row
          icon={<Trash2 size={18} strokeWidth={2.4} />}
          label={confirmReset ? "Tap again to wipe everything" : "Reset all data"}
          danger
          onClick={() => {
            haptic(20);
            if (confirmReset) dispatch({ type: "reset" });
            else {
              setConfirmReset(true);
              window.setTimeout(() => setConfirmReset(false), 3000);
            }
          }}
        />
      </section>

      <footer className="me-foot">
        finn<span>.</span> v0.1 — money, but make it fun
      </footer>
    </div>
  );
}

// ─── Exchange rates ─────────────────────────────────────────────────────

function RateRow({ cur }: { cur: Exclude<Currency, "USD"> }) {
  const { state, dispatch } = useStore();
  const [text, setText] = useState(String(state.rates[cur]));
  const spec = CURRENCIES[cur];
  const commit = (v: string) => {
    const n = Number(v.replace(",", "."));
    if (n > 0) dispatch({ type: "rates", rates: { ...state.rates, [cur]: n } });
    else setText(String(state.rates[cur]));
  };
  return (
    <label className="row rate-row">
      <span className="row-label">1 USD =</span>
      <input
        className="rate-input"
        value={text}
        inputMode="decimal"
        onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, ""))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-label={`${spec.name} per US dollar`}
      />
      <span className="rate-unit">{spec.symbol}</span>
    </label>
  );
}

function RatesEditor() {
  const { state, dispatch } = useStore();
  const changed = state.rates.UZS !== DEFAULT_RATES.UZS || state.rates.RUB !== DEFAULT_RATES.RUB;
  // Cross rate is derived, so it's always consistent with the two above.
  const rubToUzs = (1000 / state.rates.RUB) * state.rates.UZS;
  return (
    <>
      <RateRow key={`uzs-${state.rates.UZS}`} cur="UZS" />
      <RateRow key={`rub-${state.rates.RUB}`} cur="RUB" />
      <div className="row row-col rate-foot">
        <small className="dim">
          So 1 000 ₽ ≈ {formatMoney0(rubToUzs, "UZS")}. Finn never goes online — update these whenever you like.
        </small>
        {changed && (
          <button type="button" className="chip-btn" onClick={() => dispatch({ type: "rates", rates: DEFAULT_RATES })}>
            Reset to defaults
          </button>
        )}
      </div>
    </>
  );
}
