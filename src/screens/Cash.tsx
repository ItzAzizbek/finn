import { motion } from "motion/react";
import { ArrowDownToLine, ArrowUpFromLine, Banknote, Minus, Plus } from "lucide-react";
import { useMemo } from "react";
import { CardFace } from "../components/Card";
import { IconButton, Money, ScreenHeader, softSpring, spring, TxnList } from "../components/ui";
import { formatMoney, type Currency } from "../currency";
import { haptic } from "../lib";
import { useMoney, useStore } from "../store";

// ─── Cash ───────────────────────────────────────────────────────────────
// Money you hold in your hand lives here, apart from the card wallet:
// how much you've got, where it's stashed, and what you did with it.

export function CashScreen() {
  const { state, open, close } = useStore();
  const { toDisplay } = useMoney();
  const stashes = useMemo(() => state.cards.filter((c) => c.kind === "cash"), [state.cards]);
  const firstCard = state.cards.find((c) => c.kind === "card");
  const main = stashes[0];

  const total = stashes.reduce((s, c) => s + toDisplay(c.balance, c.currency), 0);
  // Several currencies? Show what you physically hold in each, not just the converted total.
  const byCurrency = useMemo(() => {
    const m = new Map<Currency, number>();
    stashes.forEach((c) => m.set(c.currency, (m.get(c.currency) ?? 0) + c.balance));
    return [...m.entries()];
  }, [stashes]);
  const txns = useMemo(() => {
    const ids = new Set(stashes.map((c) => c.id));
    return state.txns.filter((t) => ids.has(t.cardId));
  }, [state.txns, stashes]);

  const needStash = () => open({ kind: "cash" });
  const actions = [
    { label: "Spend", icon: Minus, onClick: () => (main ? open({ kind: "add", cardId: main.id }) : needStash()) },
    { label: "Got cash", icon: Plus, onClick: () => (main ? open({ kind: "add", cardId: main.id, dir: "in" }) : needStash()) },
    { label: "Withdraw", icon: ArrowDownToLine, onClick: () => (main ? open({ kind: "transfer", fromId: firstCard?.id, toId: main.id }) : needStash()) },
    { label: "Deposit", icon: ArrowUpFromLine, onClick: () => (main ? open({ kind: "transfer", fromId: main.id, toId: firstCard?.id }) : needStash()) },
  ];

  return (
    <motion.div className="overlay screen" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 40 }}>
      <div className="overlay-scroll">
        <ScreenHeader
          onBack={close}
          title="Cash"
          right={
            <IconButton label="Add a cash stash" onClick={needStash}>
              <Plus size={20} strokeWidth={2.6} />
            </IconButton>
          }
        />

        <section className="cash-hero">
          <div className="eyebrow">Cash in hand</div>
          <Money value={total} className="balance-num" hidden={state.prefs.stealth} />
          {byCurrency.length > 1 && (
            <div className={`cash-split ${state.prefs.stealth ? "is-hidden" : ""}`}>
              {byCurrency.map(([cur, amt]) => (
                <span key={cur}>{formatMoney(amt, cur)}</span>
              ))}
            </div>
          )}
        </section>

        <div className="detail-actions">
          {actions.map((a, i) => (
            <motion.button
              key={a.label}
              type="button"
              className="round-action"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.1 + i * 0.04 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                haptic();
                a.onClick();
              }}
            >
              <span>
                <a.icon size={22} strokeWidth={2.4} />
              </span>
              {a.label}
            </motion.button>
          ))}
        </div>

        <section>
          <div className="section-head">
            <h2>Stashes</h2>
            {stashes.length > 0 && (
              <button type="button" className="chip-btn" onClick={needStash}>
                <Plus size={14} strokeWidth={2.8} /> New
              </button>
            )}
          </div>
          {stashes.length ? (
            <div className="cash-list">
              {stashes.map((c, i) => (
                <motion.button
                  key={c.id}
                  type="button"
                  className="cash-item"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...softSpring, delay: i * 0.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    haptic();
                    open({ kind: "card", id: c.id });
                  }}
                >
                  <motion.div layoutId={`card-${c.id}`} transition={softSpring}>
                    <CardFace card={c} stealth={state.prefs.stealth} />
                  </motion.div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="empty">
              <div className="empty-icon">
                <Banknote size={30} strokeWidth={2.2} />
              </div>
              No cash yet
              <p>Add what's in your pocket — or a stash at home, or your dollars — and track it like a card.</p>
              <button type="button" className="chip-btn" onClick={needStash}>
                Add cash
              </button>
            </div>
          )}
        </section>

        {stashes.length > 0 && (
          <section>
            <div className="section-head">
              <h2>Cash activity</h2>
            </div>
            <TxnList
              txns={txns}
              limit={80}
              empty={
                <>
                  Nothing spent in cash yet
                  <p>Pay for something in cash? Tap Spend.</p>
                </>
              }
            />
          </section>
        )}
      </div>
    </motion.div>
  );
}
