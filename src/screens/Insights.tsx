import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { CategoryIcon, Icon } from "../components/icons";
import { Money, Segmented, softSpring } from "../components/ui";
import { CATEGORIES, daysUntil, SPEND_CATEGORIES, type CategoryId } from "../data";
import { daysLeftInMonth, spentInMonth, startOfDay } from "../lib";
import { useMoney, useStore } from "../store";

type Period = "week" | "month";

const ROASTS: Record<CategoryId, string> = {
  food: "Your oven called. It misses you.",
  groceries: "Meal-prep royalty. Chef's kiss.",
  transport: "Have you considered… walking?",
  shopping: "The cart is not a personality.",
  fun: "Social butterfly with receipts to prove it.",
  subs: "Time to audit those subscriptions.",
  health: "Investing in yourself. Respect.",
  income: "",
};

export function Insights() {
  const { state, open } = useStore();
  const { txns, budget, prefs } = state;
  const { txnValue, toDisplay, fmt, fmtCompact } = useMoney();
  const [period, setPeriod] = useState<Period>("week");
  const days = period === "week" ? 7 : 30;

  const data = useMemo(() => {
    const today = startOfDay(new Date());
    const start = new Date(today);
    start.setDate(today.getDate() - (days - 1));
    const prevStart = new Date(start);
    prevStart.setDate(start.getDate() - days);

    const buckets = Array.from({ length: days }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { date: d, total: 0 };
    });
    const byCat = new Map<CategoryId, number>();
    let total = 0;
    let prev = 0;

    for (const t of txns) {
      if (t.amount >= 0) continue;
      const d = startOfDay(new Date(t.date));
      const amt = -txnValue(t); // everything adds up in the display currency
      if (d >= start && d <= today) {
        const idx = Math.round((d.getTime() - start.getTime()) / 86_400_000);
        if (buckets[idx]) buckets[idx].total += amt;
        byCat.set(t.category, (byCat.get(t.category) ?? 0) + amt);
        total += amt;
      } else if (d >= prevStart && d < start) {
        prev += amt;
      }
    }
    const cats = SPEND_CATEGORIES.map((id) => ({ ...CATEGORIES[id], total: byCat.get(id) ?? 0 }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
    return { buckets, total, prev, cats, max: Math.max(1, ...buckets.map((b) => b.total)) };
  }, [txns, days, txnValue]);

  const [selected, setSelected] = useState<number | null>(null);
  const sel = selected !== null && data.buckets[selected] ? data.buckets[selected] : data.buckets[data.buckets.length - 1];
  const avg = data.total / days;
  const delta = data.prev ? ((data.total - data.prev) / data.prev) * 100 : null;

  const monthSpent = spentInMonth(txns, txnValue);
  const ring = Math.min(1, monthSpent / budget);
  const R = 52;
  const C = 2 * Math.PI * R;
  const top = data.cats[0];
  const subsTotal = state.subscriptions.reduce((s, x) => s + toDisplay(x.amount, x.currency), 0);

  return (
    <div className="page insights">
      <header className="page-title">
        <h1>Insights</h1>
        <Segmented
          id="period"
          value={period}
          onChange={(p) => {
            setPeriod(p);
            setSelected(null);
          }}
          options={[
            { id: "week", label: "7D" },
            { id: "month", label: "30D" },
          ]}
        />
      </header>

      <section className="spend-hero">
        <div className="eyebrow">You spent</div>
        <Money value={data.total} className="balance-num" hidden={prefs.stealth} />
        <div className="balance-meta">
          {delta !== null && (
            <span className={`delta ${delta <= 0 ? "is-good" : "is-bad"}`}>
              {delta <= 0 ? "↓" : "↑"} {Math.abs(delta).toFixed(0)}%
            </span>
          )}
          <span className="dim">
            {delta !== null ? `vs previous ${days} days · ` : ""}avg {fmtCompact(avg)}/day
          </span>
        </div>
      </section>

      <section className="chart-card">
        <div className="chart-head">
          <span className="dim">{sel.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
          <AnimatePresence mode="wait">
            <motion.b key={sel.date.getTime()} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
              {fmt(sel.total)}
            </motion.b>
          </AnimatePresence>
        </div>
        <div className={`bars ${period}`}>
          <span className="avg-line" style={{ bottom: `${(avg / data.max) * 100}%` }}>
            <i>avg</i>
          </span>
          {data.buckets.map((b, i) => {
            const isSel = sel === b;
            return (
              <button key={`${period}-${i}`} type="button" className={`bar ${isSel ? "is-sel" : ""}`} onClick={() => setSelected(i)} aria-label={`${b.date.toDateString()}: ${fmt(b.total)}`}>
                <motion.span initial={{ height: 0 }} animate={{ height: `${Math.max(2, (b.total / data.max) * 100)}%` }} transition={{ ...softSpring, delay: i * (period === "week" ? 0.04 : 0.012) }} />
                {period === "week" && <small>{b.date.toLocaleDateString("en-US", { weekday: "narrow" })}</small>}
              </button>
            );
          })}
        </div>
      </section>

      <div className="tile-row">
        <section className="tile ring-tile">
          <svg viewBox="0 0 128 128" className="ring">
            <circle cx="64" cy="64" r={R} className="ring-track" />
            <motion.circle
              cx="64"
              cy="64"
              r={R}
              className={`ring-fill ${ring > 0.9 ? "is-hot" : ""}`}
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: C * (1 - ring) }}
              transition={{ ...softSpring, delay: 0.2 }}
            />
          </svg>
          <div className="ring-label">
            <b>{Math.round(ring * 100)}%</b>
            <small>of budget</small>
          </div>
          <div className="tile-foot">{daysLeftInMonth()} days left</div>
        </section>
        <section className="tile vibe-tile">
          <div className="eyebrow">Vibe check</div>
          {top ? (
            <>
              <div className="vibe-big">
                <CategoryIcon id={top.id} size={30} />
                {Math.round((top.total / data.total) * 100)}%
              </div>
              <p>
                goes to {top.label.toLowerCase()}. {ROASTS[top.id]}
              </p>
            </>
          ) : (
            <>
              <div className="vibe-big">
                <Icon name="chill" size={30} />
              </div>
              <p>Quiet stretch. Suspiciously quiet.</p>
            </>
          )}
        </section>
      </div>

      <section className="card-section">
        <div className="section-head">
          <h2>Where it went</h2>
        </div>
        {data.cats.length === 0 && <p className="section-empty">No spending logged in the last {days} days.</p>}
        <div className="stack-bar">
          {data.cats.map((c, i) => (
            <motion.span key={c.id} style={{ background: c.color }} initial={{ flexGrow: 0 }} animate={{ flexGrow: c.total }} transition={{ ...softSpring, delay: 0.05 * i }} />
          ))}
        </div>
        <div className="cat-list">
          {data.cats.map((c) => (
            <div key={c.id} className="cat-row">
              <span className="txn-icon" style={{ ["--c" as string]: c.color }}>
                <CategoryIcon id={c.id} />
              </span>
              <div className="cat-main">
                <div className="cat-line">
                  <b>{c.label}</b>
                  <b className={prefs.stealth ? "is-hidden" : ""}>{fmtCompact(c.total)}</b>
                </div>
                <div className="cat-bar">
                  <motion.span style={{ background: c.color }} initial={{ width: 0 }} animate={{ width: `${(c.total / data.cats[0].total) * 100}%` }} transition={softSpring} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card-section">
        <div className="section-head">
          <h2>Subscriptions</h2>
          <button type="button" className="chip-btn" onClick={() => open({ kind: "sub" })}>
            <Plus size={14} strokeWidth={2.8} /> Add
          </button>
        </div>
        {state.subscriptions.length === 0 ? (
          <p className="section-empty">Track what renews every month so it never sneaks up on you.</p>
        ) : (
          <>
            <div className="subs">
              {state.subscriptions
                .map((x) => ({ ...x, inDays: daysUntil(x.day) }))
                .sort((a, b) => a.inDays - b.inDays)
                .map((x) => {
                  const card = state.cards.find((c) => c.id === x.cardId);
                  return (
                    <button key={x.id} type="button" className="sub-row" onClick={() => open({ kind: "sub", id: x.id })}>
                      <span className="sub-logo">{x.name[0]?.toUpperCase()}</span>
                      <div className="cat-main">
                        <b>{x.name}</b>
                        <small className="dim">
                          {x.inDays === 0 ? "Renews today" : `Renews in ${x.inDays} day${x.inDays > 1 ? "s" : ""}`}
                          {card ? ` · ${card.issuer} ${card.last4}` : ""}
                        </small>
                      </div>
                      <b className={prefs.stealth ? "is-hidden" : ""}>{fmt(x.amount, x.currency)}</b>
                    </button>
                  );
                })}
            </div>
            <div className="subs-total">
              <span>Every month</span>
              <b className={prefs.stealth ? "is-hidden" : ""}>{fmt(subsTotal)}</b>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
