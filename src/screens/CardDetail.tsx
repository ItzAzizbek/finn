import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { Copy, Eye, EyeOff, Lock, Paintbrush, Plus, Settings2, Snowflake } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CardBack, CardFace } from "../components/Card";
import { Money, ScreenHeader, softSpring, spring, TxnList } from "../components/ui";
import { CategoryIcon } from "../components/icons";
import { CATEGORIES } from "../data";
import { convert, formatCompact, formatMoney0 } from "../currency";
import { haptic, isThisMonth } from "../lib";
import { useStore } from "../store";
import { unseal, type CardSecrets } from "../vault";

export function CardDetail({ id }: { id: string }) {
  const { state, dispatch, close, open, toast, withKey, vaultKey } = useStore();
  const card = state.cards.find((c) => c.id === id);
  const [flipped, setFlipped] = useState(false);
  const [secrets, setSecrets] = useState<CardSecrets | null>(null);

  // Revealed details disappear on their own, and the moment the vault locks.
  useEffect(() => {
    if (!secrets) return;
    const t = window.setTimeout(() => {
      setSecrets(null);
      setFlipped(false);
    }, 30_000);
    return () => clearTimeout(t);
  }, [secrets]);
  useEffect(() => {
    if (!vaultKey) setSecrets(null);
  }, [vaultKey]);

  // Pointer-driven 3D tilt with a light sheen that follows your finger.
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [10, -10]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 1], [-12, 12]), { stiffness: 200, damping: 20 });
  const sx = useTransform(mx, (v) => `${v * 100}%`);
  const sy = useTransform(my, (v) => `${v * 100}%`);
  const sheen = useMotionTemplate`radial-gradient(circle at ${sx} ${sy}, rgba(255,255,255,.35), transparent 55%)`;

  const txns = useMemo(() => state.txns.filter((t) => t.cardId === id), [state.txns, id]);
  const month = useMemo(() => {
    // This screen talks in the card's own currency.
    const inCard = (t: (typeof txns)[number]) => (card ? convert(t.amount, t.currency, card.currency, state.rates) : t.amount);
    const spent = txns.filter((t) => t.amount < 0 && isThisMonth(t.date));
    const total = spent.reduce((s, t) => s - inCard(t), 0);
    const counts = new Map<string, number>();
    spent.forEach((t) => counts.set(t.category, (counts.get(t.category) ?? 0) - inCard(t)));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return { total, count: spent.length, top: top ? CATEGORIES[top[0] as keyof typeof CATEGORIES] : null };
  }, [txns, card, state.rates]);

  if (!card) return null;
  const util = card.limit ? Math.min(1, (card.limit - card.balance) / card.limit) : 0;

  const actions = [
    {
      label: card.frozen ? "Unfreeze" : "Freeze",
      icon: Snowflake,
      active: card.frozen,
      onClick: () => {
        dispatch({ type: "freeze", id });
        // Finn can't talk to the bank — this is a personal "don't use" flag.
        toast(card.frozen ? "Unfrozen in Finn" : "Marked frozen — freeze it in your bank app too");
      },
    },
    {
      label: secrets ? "Hide" : "Details",
      icon: secrets ? EyeOff : Eye,
      active: Boolean(secrets),
      onClick: () => {
        if (secrets) {
          setSecrets(null);
          setFlipped(false);
          return;
        }
        const sealed = card.secret;
        if (!sealed) return open({ kind: "cardDetails", id });
        withKey(async (key) => {
          setSecrets(await unseal<CardSecrets>(key, sealed));
          setFlipped(true);
        });
      },
    },
    { label: "Design", icon: Paintbrush, onClick: () => open({ kind: "studio", id }) },
    { label: "Log", icon: Plus, onClick: () => open({ kind: "add", cardId: id }) },
    { label: "Edit", icon: Settings2, onClick: () => open({ kind: "editCard", id }) },
  ];

  return (
    <motion.div className="overlay screen detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
      <div className="overlay-scroll">
        <ScreenHeader
          onBack={close}
          title={
            <>
              {card.issuer}{card.nickname ? ` · ${card.nickname}` : ""}
            </>
          }
        />

        <div
          className="detail-stage"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            mx.set((e.clientX - r.left) / r.width);
            my.set((e.clientY - r.top) / r.height);
          }}
          onPointerLeave={() => {
            mx.set(0.5);
            my.set(0.5);
          }}
        >
          <motion.div layoutId={`card-${card.id}`} className="detail-card" transition={softSpring}>
            <motion.div className="tilt" style={{ rotateX: rx, rotateY: ry }}>
              <motion.div
                className="flipper"
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 170, damping: 20 }}
                onClick={() => {
                  haptic();
                  setFlipped((f) => !f);
                }}
              >
                <div className="face front">
                  <CardFace card={card} stealth={state.prefs.stealth} />
                  <motion.div className="sheen" style={{ background: sheen }} />
                </div>
                <div className="face back">
                  <CardBack card={card} secrets={secrets} />
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
          {secrets ? (
            <button
              type="button"
              className="chip-btn"
              onClick={() => {
                navigator.clipboard?.writeText(secrets.number).then(
                  () => toast("Card number copied"),
                  () => toast("Couldn't access the clipboard"),
                );
              }}
            >
              <Copy size={14} strokeWidth={2.6} /> Copy number · hides in 30s
            </button>
          ) : !card.secret ? (
            <button type="button" className="chip-btn needs-details" onClick={() => open({ kind: "cardDetails", id })}>
              <Lock size={14} strokeWidth={2.6} /> Add card number & CVV
            </button>
          ) : (
            <div className="tap-hint">Tap card to flip</div>
          )}
        </div>

        <div className="detail-actions">
          {actions.map((a, i) => (
            <motion.button
              key={a.label}
              type="button"
              className={`round-action ${a.active ? "is-active" : ""}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.12 + i * 0.04 }}
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

        <section className="detail-stats">
          <div className="stat-big">
            <div className="eyebrow">{card.type === "credit" ? "Available credit" : "Available"}</div>
            <Money value={card.balance} currency={card.currency} className="balance-num sm" hidden={state.prefs.stealth} />
            {card.currency !== state.currency && (
              <div className={`conv-note ${state.prefs.stealth ? "is-hidden" : ""}`}>
                ≈ {formatCompact(convert(card.balance, card.currency, state.currency, state.rates), state.currency)} at your rate
              </div>
            )}
          </div>
          {card.limit && (
            <div className="util" style={{ "--u": `${util * 100}%` } as CSSProperties}>
              <div className="util-head">
                <span>
                  Used <b>{formatMoney0(card.limit - card.balance, card.currency)}</b> of {formatMoney0(card.limit, card.currency)}
                </span>
                <span className={util > 0.3 ? "warn" : "good"}>{Math.round(util * 100)}%</span>
              </div>
              <div className="meter">
                <motion.div className={`meter-fill ${util > 0.3 ? "is-hot" : ""}`} initial={{ width: 0 }} animate={{ width: `${util * 100}%` }} transition={softSpring} />
              </div>
              <small className="dim">{util > 0.3 ? "Keep it under 30% to keep your credit score happy." : "Under 30% — your credit score loves this."}</small>
            </div>
          )}
          <div className="mini-stats">
            <div>
              <small>This month</small>
              <b className={state.prefs.stealth ? "is-hidden" : ""}>{formatCompact(month.total, card.currency, true)}</b>
            </div>
            <div>
              <small>Purchases</small>
              <b>{month.count}</b>
            </div>
            <div>
              <small>Top spot</small>
              <b className="top-spot">
                {month.top ? (
                  <>
                    <span style={{ color: month.top.color }}>
                      <CategoryIcon id={month.top.id} size={16} />
                    </span>
                    {month.top.label.split(" ")[0]}
                  </>
                ) : (
                  "—"
                )}
              </b>
            </div>
          </div>
        </section>

        <section>
          <div className="section-head">
            <h2>Activity</h2>
          </div>
          <TxnList
            txns={txns}
            showCard={false}
            limit={60}
            empty={
              <>
                No activity on this card yet
                <p>Log a purchase and it shows up here.</p>
                <button type="button" className="chip-btn" onClick={() => open({ kind: "add", cardId: id })}>
                  Log a transaction
                </button>
              </>
            }
          />
        </section>
      </div>
    </motion.div>
  );
}
