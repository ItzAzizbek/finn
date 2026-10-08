import { motion } from "motion/react";
import { ChartNoAxesColumn, CreditCard, Eye, EyeOff, Paintbrush, Plus } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { Wallet } from "../components/Wallet";
import { IconButton, Money, softSpring, TxnList } from "../components/ui";
import { daysLeftInMonth, greeting, haptic, initials, spentInMonth } from "../lib";
import { compactParts } from "../currency";
import { useMoney, useStore } from "../store";

export function Home() {
  const { state, dispatch, open, setTab } = useStore();
  const { cards, txns, budget, prefs } = state;
  const { toDisplay, txnValue, fmtCompact, fmtTiny, display } = useMoney();
  // Every card counts in the display currency, converted at the user's rates.
  const inDisplay = (n: number, c: (typeof cards)[number]) => toDisplay(n, c.currency);

  // Cash is what's on debit cards; credit cards contribute what you owe, not their limit.
  const debit = cards.filter((c) => c.type === "debit");
  const cash = debit.reduce((s, c) => s + inDisplay(c.balance, c), 0);
  const owed = cards.reduce((s, c) => (c.type === "credit" && c.limit !== undefined ? s + inDisplay(Math.max(0, c.limit - c.balance), c) : s), 0);
  const creditAvailable = cards.reduce((s, c) => (c.type === "credit" ? s + inDisplay(c.balance, c) : s), 0);
  const heroLabel = debit.length ? "Total balance" : "Available credit";
  const heroValue = debit.length ? cash : creditAvailable;
  const spent = useMemo(() => spentInMonth(txns, txnValue), [txns, txnValue]);
  // Rolling 30 days vs the 30 before — steadier than a half-finished calendar month.
  const delta = useMemo(() => {
    const now = Date.now();
    let recent = 0;
    let before = 0;
    for (const t of txns) {
      if (t.amount >= 0) continue;
      const age = (now - new Date(t.date).getTime()) / 86_400_000;
      if (age < 30) recent -= txnValue(t);
      else if (age < 60) before -= txnValue(t);
    }
    // Only compare once there's a previous month of history to compare against.
    return before ? ((recent - before) / before) * 100 : null;
  }, [txns, txnValue]);

  const left = budget - spent;
  const leftParts = compactParts(Math.abs(left), display);
  const spentParts = compactParts(spent, display, true);
  const daysLeft = daysLeftInMonth();
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const pace = now.getDate() / daysInMonth;
  const used = Math.min(1, spent / budget);
  const onTrack = used <= pace + 0.03;


  const actions = [
    { label: "Log spend", icon: Plus, accent: true, onClick: () => open({ kind: "add" }) },
    { label: "Design", icon: Paintbrush, onClick: () => cards[0] && open({ kind: "studio", id: cards[0].id }) },
    { label: "Insights", icon: ChartNoAxesColumn, onClick: () => setTab("insights") },
    { label: "Add card", icon: CreditCard, onClick: () => open({ kind: "addCard" }) },
  ];

  return (
    <div className="page home">
      <header className="topbar">
        <button type="button" className="avatar" onClick={() => setTab("me")} aria-label="Profile">
          {initials(state.name)}
        </button>
        <div className="topbar-text">
          <span className="dim">{greeting()},</span>
          <b>{state.name.split(" ")[0] || "friend"}</b>
        </div>
        <IconButton label={prefs.stealth ? "Show balances" : "Hide balances"} onClick={() => { haptic(); dispatch({ type: "pref", key: "stealth", value: !prefs.stealth }); }}>
          {prefs.stealth ? <EyeOff size={20} strokeWidth={2.4} /> : <Eye size={20} strokeWidth={2.4} />}
        </IconButton>
      </header>

      <section className="balance-hero">
        <div className="eyebrow">{heroLabel}</div>
        <Money value={heroValue} className="balance-num" hidden={prefs.stealth} />
        <div className="balance-meta">
          {delta !== null && (
            <span className={`delta ${delta <= 0 ? "is-good" : "is-bad"}`}>
              {delta <= 0 ? "↓" : "↑"} {Math.abs(delta).toFixed(0)}% spending vs prior 30 days
            </span>
          )}
          {debit.length > 0 && owed > 0 && <span className={`dim ${prefs.stealth ? "is-hidden" : ""}`}>{fmtCompact(owed)} owed on credit ·</span>}
          <span className="dim">
            {cards.length} card{cards.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      <Wallet cards={cards} />

      <section className="actions">
        {actions.map((a, i) => (
          <motion.button
            key={a.label}
            type="button"
            className={`action ${a.accent ? "is-accent" : ""}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...softSpring, delay: 0.15 + i * 0.04 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              haptic();
              a.onClick();
            }}
          >
            <span className="action-icon">
              <a.icon size={22} strokeWidth={2.6} />
            </span>
            {a.label}
          </motion.button>
        ))}
      </section>

      <motion.section className="budget-card" whileTap={{ scale: 0.985 }} onClick={() => setTab("insights")}>
        <div className="budget-top">
          <div>
            <div className="eyebrow">{now.toLocaleDateString("en-US", { month: "long" })} budget</div>
            <div className={`budget-left ${prefs.stealth ? "is-hidden" : ""}`}>
              {leftParts.prefix}
              {leftParts.value}
              <span>
                {leftParts.suffix}
                {left >= 0 ? " left" : " over"}
              </span>
            </div>
          </div>
          <div className={`pace-pill ${onTrack ? "is-good" : "is-bad"}`}>{onTrack ? "On track" : "Slow down"}</div>
        </div>
        <div className="meter" style={{ "--pace": `${pace * 100}%` } as CSSProperties}>
          <motion.div className={`meter-fill ${used > 0.9 ? "is-hot" : ""}`} initial={{ width: 0 }} animate={{ width: `${used * 100}%` }} transition={{ ...softSpring, delay: 0.2 }} />
          <span className="meter-pace" />
        </div>
        <div className="budget-foot">
          <span>
            <b>{spentParts.prefix + spentParts.value}</b> of {fmtTiny(budget)}
          </span>
          <span>{left > 0 ? `${fmtTiny(left / daysLeft)}/day` : "Budget maxed"}</span>
        </div>
      </motion.section>

      <section>
        <div className="section-head">
          <h2>Recent</h2>
          <button type="button" className="chip-btn" onClick={() => open({ kind: "activity" })}>
            See all
          </button>
        </div>
        <TxnList
          txns={txns}
          limit={8}
          empty={
            <>
              Nothing logged yet
              <p>Tap + whenever you spend or get paid. It takes two seconds.</p>
              <button type="button" className="chip-btn" onClick={() => open({ kind: "add" })}>
                Log your first transaction
              </button>
            </>
          }
        />
      </section>
    </div>
  );
}
