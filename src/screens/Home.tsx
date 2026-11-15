import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { ArrowRight, ChartNoAxesColumn, Eye, EyeOff, Plus, Search, Wallet } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { WalletDeck } from "../components/Wallet";
import { Money, TxnRow } from "../components/ui";
import { daysLeftInMonth, groupByDay, haptic, initials, spentInMonth } from "../lib";
import { useMoney, useStore } from "../store";

// ─── Home ───────────────────────────────────────────────────────────────
// One big number, three big buttons, and your whole wallet tucked behind
// today's activity. Pull the activity down to fan the wallet out.

export function Home() {
  const { state, dispatch, open, setTab } = useStore();
  const { cards, txns, budget, prefs } = state;
  const { toDisplay, txnValue, fmtTiny } = useMoney();
  const inDisplay = (c: (typeof cards)[number], n = c.balance) => toDisplay(n, c.currency);

  const cash = cards.filter((c) => c.kind === "cash");
  const debit = cards.filter((c) => c.kind === "card" && c.type === "debit");
  const credit = cards.filter((c) => c.kind === "card" && c.type === "credit");
  const cashTotal = cash.reduce((s, c) => s + inDisplay(c), 0);
  const cardTotal = debit.reduce((s, c) => s + inDisplay(c), 0);
  const owed = credit.reduce((s, c) => (c.limit !== undefined ? s + inDisplay(c, Math.max(0, c.limit - c.balance)) : s), 0);
  const spent = useMemo(() => spentInMonth(txns, txnValue), [txns, txnValue]);
  const left = budget - spent;
  const month = new Date().toLocaleDateString("en-US", { month: "long" });

  const pages: { value: number; label: ReactNode; onTap?: () => void }[] = [
    {
      value: cardTotal + cashTotal,
      label: (
        <>
          On cards & in cash
          {owed > 0 && <span className={prefs.stealth ? "is-hidden" : ""}> · {fmtTiny(owed)} owed on credit</span>}
        </>
      ),
    },
    {
      value: cashTotal,
      label: cash.length ? `Cash in hand · ${cash.length} ${cash.length === 1 ? "stash" : "stashes"}` : "No cash yet — tap Add cash",
    },
    {
      value: left,
      label: left >= 0 ? `Left of your ${month} budget · ${fmtTiny(left / daysLeftInMonth())}/day` : `Over your ${month} budget`,
      onTap: () => setTab("insights"),
    },
  ];
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const go = (to: number) => {
    const next = (to + pages.length) % pages.length;
    if (next === page) return;
    haptic(5);
    setDir(next > page ? 1 : -1);
    setPage(next);
  };

  const actions = [
    { label: "Add money", icon: Plus, onClick: () => open({ kind: "add", dir: "in" }) },
    { label: "Transfer", icon: ArrowRight, onClick: () => open({ kind: "transfer" }) },
    { label: "Add cash", icon: Wallet, onClick: () => open({ kind: "cash" }) },
  ];

  return (
    <div className="page bank-home">
      <header className="bank-top">
        <button type="button" className="avatar" onClick={() => setTab("me")} aria-label="Profile">
          {initials(state.name)}
        </button>
        <div className="bank-dots" role="tablist" aria-label="Balance view">
          {pages.map((_, i) => (
            <button key={i} type="button" role="tab" aria-selected={page === i} aria-label={["Total", "Cash", "Budget"][i]} className={page === i ? "is-on" : ""} onClick={() => go(i)} />
          ))}
        </div>
        <button
          type="button"
          className="bank-icon-btn"
          aria-label={prefs.stealth ? "Show balances" : "Hide balances"}
          onClick={() => {
            haptic();
            dispatch({ type: "pref", key: "stealth", value: !prefs.stealth });
          }}
        >
          {prefs.stealth ? <EyeOff size={20} strokeWidth={2.4} /> : <Eye size={20} strokeWidth={2.4} />}
        </button>
      </header>

      <motion.section
        className="bank-hero"
        onPanEnd={(_: PointerEvent, info: PanInfo) => {
          // Sideways swipes only — let vertical ones scroll the page.
          if (Math.abs(info.offset.x) < Math.abs(info.offset.y)) return;
          if (info.offset.x < -40 || info.velocity.x < -400) go(page + 1);
          else if (info.offset.x > 40 || info.velocity.x > 400) go(page - 1);
        }}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.button
            key={page}
            type="button"
            className="bank-hero-page"
            custom={dir}
            initial={{ opacity: 0, x: dir * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -60 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            onClick={pages[page].onTap}
            tabIndex={pages[page].onTap ? 0 : -1}
          >
            <Money value={Math.abs(pages[page].value)} className={`bank-amount ${page === 2 && left < 0 ? "is-over" : ""}`} hidden={prefs.stealth} />
            <span className="bank-sub">{pages[page].label}</span>
          </motion.button>
        </AnimatePresence>
      </motion.section>

      <section className="bank-actions">
        {actions.map((a, i) => (
          <motion.button
            key={a.label}
            type="button"
            className="bank-action"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 30, delay: 0.1 + i * 0.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              haptic();
              a.onClick();
            }}
          >
            <span className="bank-action-icon">
              <a.icon size={30} strokeWidth={2.2} />
            </span>
            {a.label}
          </motion.button>
        ))}
      </section>

      <WalletDeck
        cards={cards}
        header={
          <div className="deck-head">
            <button type="button" className="bank-icon-btn" aria-label="Insights" onClick={() => setTab("insights")}>
              <ChartNoAxesColumn size={22} strokeWidth={2.2} />
            </button>
            <button type="button" className="bank-icon-btn" aria-label="Search activity" onClick={() => open({ kind: "activity" })}>
              <Search size={22} strokeWidth={2.2} />
            </button>
          </div>
        }
      >
        <History />
      </WalletDeck>
    </div>
  );
}

/** Day-grouped activity in the bank-statement style: "YESTERDAY, 1 345 999 soʻm". */
function History() {
  const { state, open } = useStore();
  const { txnValue, fmt0 } = useMoney();
  const groups = useMemo(() => groupByDay(state.txns.slice(0, 40), txnValue), [state.txns, txnValue]);

  if (!state.txns.length) {
    return (
      <div className="history-empty">
        <b>Nothing here yet</b>
        <p>Tap + whenever you spend or get paid — it takes two seconds.</p>
        <button type="button" className="chip-btn" onClick={() => open({ kind: "add" })}>
          Log your first transaction
        </button>
      </div>
    );
  }

  return (
    <div className="history">
      {groups.map((g) => (
        <section key={g.label} className="history-group">
          <header>
            {g.label}
            {g.total > 0 && <span className={state.prefs.stealth ? "is-hidden" : ""}>, {fmt0(g.total)}</span>}
          </header>
          {g.items.map((t) => (
            <TxnRow key={t.id} t={t} />
          ))}
        </section>
      ))}
      {state.txns.length > 40 && (
        <button type="button" className="chip-btn history-more" onClick={() => open({ kind: "activity" })}>
          See all activity
        </button>
      )}
    </div>
  );
}
