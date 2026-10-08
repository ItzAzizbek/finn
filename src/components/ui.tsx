import { animate, AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CATEGORIES, type Txn } from "../data";
import { CURRENCIES, CURRENCY_LIST, groupInput, moneyParts, parseInput, type Currency } from "../currency";
import { groupByDay, haptic, timeLabel } from "../lib";
import { useMoney, useStore } from "../store";
import { CategoryIcon, Icon } from "./icons";

export const spring = { type: "spring", stiffness: 420, damping: 36 } as const;
export const softSpring = { type: "spring", stiffness: 260, damping: 30 } as const;

// ─── Money ──────────────────────────────────────────────────────────────

export function Money({ value, currency, className = "", hidden }: { value: number; currency?: Currency; className?: string; hidden?: boolean }) {
  const { display } = useMoney();
  const cur = currency ?? display;
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setShown,
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);
  const p = moneyParts(shown, cur);
  // Soʻm amounts run long ("125 000 000"): shrink big numbers so they never wrap or overflow.
  const len = (p.sign + p.prefix + p.whole).length + (p.frac.length + p.suffix.length) * 0.45;
  const fit = Math.min(1, 9.5 / len);
  return (
    <span className={`money ${hidden ? "is-hidden" : ""} ${className}`} style={{ "--fit": fit } as CSSProperties}>
      {p.sign}
      {p.prefix}
      {p.whole}
      {p.frac && <span className="money-cents">{p.frac}</span>}
      {p.suffix && <span className="money-unit">{p.suffix}</span>}
    </span>
  );
}

/** Amount field that groups digits as you type and shows the currency symbol in the right place. */
export function MoneyInput({ value, onChange, currency, placeholder }: { value: string; onChange: (raw: string) => void; currency: Currency; placeholder?: string }) {
  const spec = CURRENCIES[currency];
  return (
    <div className={`field-money is-${spec.position}`}>
      {spec.position === "prefix" && <span>{spec.symbol}</span>}
      <input
        value={value ? groupInput(value, currency) : ""}
        inputMode={spec.decimals ? "decimal" : "numeric"}
        placeholder={placeholder}
        onChange={(e) => onChange(parseInput(e.target.value, currency))}
      />
      {spec.position === "suffix" && <span>{spec.symbol}</span>}
    </div>
  );
}

/** UZS · USD · RUB switcher. */
export function CurrencyPicker({ value, onChange, id }: { value: Currency; onChange: (c: Currency) => void; id: string }) {
  return <Segmented id={id} value={value} onChange={onChange} options={CURRENCY_LIST.map((c) => ({ id: c, label: c }))} />;
}

// ─── Buttons & controls ─────────────────────────────────────────────────

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "dark";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      className={`btn btn-${variant} ${className}`}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      disabled={disabled}
      onClick={() => {
        haptic();
        onClick?.();
      }}
    >
      {children}
    </motion.button>
  );
}

export function IconButton({ children, onClick, label, className = "" }: { children: ReactNode; onClick?: () => void; label: string; className?: string }) {
  return (
    <motion.button type="button" aria-label={label} className={`icon-btn ${className}`} whileTap={{ scale: 0.88 }} onClick={onClick}>
      {children}
    </motion.button>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton label="Back" onClick={onClick}>
      <ChevronLeft size={22} strokeWidth={2.6} />
    </IconButton>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle ${on ? "is-on" : ""}`}
      onClick={() => {
        haptic();
        onChange(!on);
      }}
    >
      <motion.span className="toggle-knob" layout transition={spring} />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, id }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; id: string }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? "is-active" : ""} onClick={() => onChange(o.id)}>
          {value === o.id && <motion.span layoutId={`seg-${id}`} className="segmented-pill" transition={spring} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Transactions ───────────────────────────────────────────────────────

export function TxnRow({ t, showCard = true }: { t: Txn; showCard?: boolean }) {
  const { state, open } = useStore();
  const { display, fmtSigned, fmtCompact, txnValue } = useMoney();
  const cat = CATEGORIES[t.category];
  const foreign = t.currency !== display;
  const card = state.cards.find((c) => c.id === t.cardId);
  return (
    <button type="button" className="txn" onClick={() => open({ kind: "txn", id: t.id })}>
      <div className="txn-icon" style={{ "--c": cat.color } as CSSProperties}>
        <CategoryIcon id={t.category} />
      </div>
      <div className="txn-main">
        <div className="txn-merchant">{t.merchant}</div>
        <div className="txn-sub">
          {cat.label}
          {showCard && card ? ` · ${card.issuer} ${card.last4}` : ` · ${timeLabel(t.date)}`}
        </div>
      </div>
      <div className={`txn-amt ${t.amount > 0 ? "is-in" : ""} ${state.prefs.stealth ? "is-hidden" : ""}`}>
        {fmtSigned(t.amount, t.currency)}
        {foreign && <small className="txn-conv">≈ {fmtCompact(Math.abs(txnValue(t)))}</small>}
      </div>
    </button>
  );
}

export function TxnList({ txns, showCard = true, limit, empty = "Nothing here yet." }: { txns: Txn[]; showCard?: boolean; limit?: number; empty?: ReactNode }) {
  const { txnValue, fmtSigned } = useMoney();
  const groups = useMemo(() => groupByDay(limit ? txns.slice(0, limit) : txns, txnValue), [txns, limit, txnValue]);
  if (!txns.length) {
    return (
      <div className="empty">
        <div className="empty-icon">
          <Icon name="receipt" size={34} />
        </div>
        {empty}
      </div>
    );
  }
  return (
    <div className="txn-groups">
      {groups.map((g) => (
        <section key={g.label} className="txn-group">
          <header className="txn-group-head">
            <span>{g.label}</span>
            {g.total > 0 && <span>{fmtSigned(-g.total)}</span>}
          </header>
          <div className="txn-group-body">
            {g.items.map((t) => (
              <TxnRow key={t.id} t={t} showCard={showCard} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Sheet ──────────────────────────────────────────────────────────────

export function Sheet({ children, onClose, className = "", title }: { children: ReactNode; onClose: () => void; className?: string; title?: ReactNode }) {
  const controls = useDragControls();
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };
  return (
    <motion.div className="sheet-layer" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 1 }}>
      <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className={`sheet ${className}`}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 40 }}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.8 }}
        onDragEnd={onDragEnd}
      >
        <div className="sheet-grabber-zone" onPointerDown={(e) => controls.start(e)}>
          <div className="sheet-grabber" />
          {title && <div className="sheet-title">{title}</div>}
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

// ─── Toast ──────────────────────────────────────────────────────────────

export function Toast() {
  const { toastMsg } = useStore();
  return (
    <div className="toast-zone">
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            key={toastMsg.id}
            className="toast"
            initial={{ y: -40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0, scale: 0.95 }}
            transition={spring}
          >
            {toastMsg.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Confetti ───────────────────────────────────────────────────────────

const CONFETTI_COLORS = ["#c8ff2e", "#ff4fa3", "#8b5cff", "#2ee6ff", "#ff7a1a", "#ffd60a", "#f5f5f7"];

export function Confetti({ count = 90 }: { count?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 140 + Math.random() * 260;
        return {
          i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 120,
          r: Math.random() * 720 - 360,
          c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          w: 6 + Math.random() * 8,
          round: Math.random() > 0.6,
          delay: Math.random() * 0.15,
        };
      }),
    [count],
  );
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b) => (
        <motion.span
          key={b.i}
          style={{ background: b.c, width: b.w, height: b.round ? b.w : b.w * 0.45, borderRadius: b.round ? 99 : 2 }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.4 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 420], rotate: b.r, opacity: [1, 1, 0], scale: 1 }}
          transition={{ duration: 2.4, delay: b.delay, ease: [0.12, 0.8, 0.3, 1], times: [0, 0.35, 1] }}
        />
      ))}
    </div>
  );
}

// ─── Screen header (for overlays) ───────────────────────────────────────

export function ScreenHeader({ title, onBack, right }: { title?: ReactNode; onBack: () => void; right?: ReactNode }) {
  return (
    <header className="screen-header">
      <BackButton onClick={onBack} />
      <div className="screen-header-title">{title}</div>
      <div className="screen-header-right">{right}</div>
    </header>
  );
}
