import { animate, motion, useMotionValue, useTransform, type MotionValue, type PanInfo } from "motion/react";
import { Banknote, ChevronUp, CreditCard, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Card } from "../data";
import { haptic, useElementWidth } from "../lib";
import { useStore } from "../store";
import { CardFace } from "./Card";

// ─── Wallet deck ────────────────────────────────────────────────────────
// Collapsed, the cards sit in a tight stack peeking out from behind the
// activity panel. Pull down (on the stack or the panel's grabber) and the
// panel slides away while the stack deals out into a full list. Push up to
// tuck them back in. One motion value, 0 → 1, drives every position.

const RATIO = 1.586;
const GUTTER = 20; // matches --gutter
const STRIP = 12; // how much of each card behind the front one peeks out
const PEEK = 64; // how much of the front card shows above the panel
const GAP = 14;
const MAX_DEPTH = 3; // cards further back hide behind the third
const ADD_ROW = 50;
const SWIPE = 48; // px of pull that commits to opening/closing
const FLICK = 320; // px/s that commits regardless of distance

const settleSpring = { type: "spring", stiffness: 320, damping: 34 } as const;

export function WalletDeck({ cards, header, children }: { cards: Card[]; header?: ReactNode; children: ReactNode }) {
  const { open, state } = useStore();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [expanded, setExpanded] = useState(false);
  const p = useMotionValue(0);
  const startP = useRef(0);
  const panned = useRef(false);

  const n = cards.length;
  const W = Math.max(0, width - GUTTER * 2);
  const H = W / RATIO;
  // Collapsed, the front card is ~80% of the screen wide, like a card tucked in a sleeve.
  const front = width ? Math.min(0.9, (width * 0.8) / W) : 0.88;
  const shown = Math.min(n, MAX_DEPTH + 1);
  const collapsedTop = n ? (shown - 1) * STRIP + PEEK : 0;
  const expandedTop = n ? n * (H + GAP) + ADD_ROW + GAP : 0;
  const travel = Math.max(1, expandedTop - collapsedTop);
  const stageH = useTransform(p, [0, 1], [collapsedTop, expandedTop], { clamp: false });
  const addOpacity = useTransform(p, [0.55, 1], [0, 1]);
  const hintOpacity = useTransform(p, [0, 0.2], [1, 0]);

  // Removing the last cards collapses the deck so nothing is left floating open.
  useEffect(() => {
    if (n < 1 && expanded) {
      p.set(0);
      setExpanded(false);
    }
  }, [n, expanded, p]);

  const settle = (to: 0 | 1, velocity = 0) => {
    animate(p, to, { ...settleSpring, velocity: velocity / travel });
    if ((to === 1) !== expanded) haptic(to ? 12 : 8);
    setExpanded(to === 1);
  };

  const onPanStart = () => {
    panned.current = true;
    p.stop();
    startP.current = p.get();
  };
  const onPan = (_: PointerEvent, info: PanInfo) => {
    const raw = startP.current + info.offset.y / travel;
    // Rubber-band past either end instead of stopping dead.
    p.set(raw > 1 ? 1 + (raw - 1) * 0.25 : raw < 0 ? raw * 0.25 : raw);
  };
  const onPanEnd = (_: PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const wasOpen = startP.current > 0.5;
    if (!wasOpen && (offset.y > SWIPE || velocity.y > FLICK)) settle(1, velocity.y);
    else if (wasOpen && (offset.y < -SWIPE || velocity.y < -FLICK)) settle(0, velocity.y);
    else settle(wasOpen ? 1 : 0, velocity.y);
  };
  const pan = n ? { onPanStart, onPan, onPanEnd } : {};
  // A click that ends a pan isn't a tap.
  const resetPan = () => {
    panned.current = false;
  };

  return (
    <div ref={ref} className={`deck ${expanded ? "is-open" : ""}`}>
      {n === 0 ? (
        <div className="deck-empty">
          <button type="button" onClick={() => open({ kind: "addCard" })}>
            <CreditCard size={20} strokeWidth={2.4} /> Add a card
          </button>
          <button type="button" onClick={() => open({ kind: "cash" })}>
            <Banknote size={20} strokeWidth={2.4} /> Add cash
          </button>
        </div>
      ) : (
        <motion.div
          className="deck-stage"
          style={{ height: stageH, touchAction: expanded ? "pan-y" : "none" }}
          onPointerDownCapture={resetPan}
          onClick={() => {
            if (panned.current || expanded) return;
            settle(1);
          }}
          {...pan}
        >
          {width > 0 &&
            cards.map((card, i) => (
              <DeckCard
                key={card.id}
                card={card}
                i={i}
                n={n}
                p={p}
                W={W}
                H={H}
                front={front}
                stealth={state.prefs.stealth}
                onOpen={() => {
                  if (panned.current) return;
                  haptic();
                  open({ kind: "card", id: card.id });
                }}
                expanded={expanded}
              />
            ))}
          <motion.div className="deck-add" style={{ top: n * (H + GAP), opacity: addOpacity, pointerEvents: expanded ? "auto" : "none" }}>
            <button type="button" onClick={() => open({ kind: "addCard" })}>
              <Plus size={18} strokeWidth={2.6} /> Card
            </button>
            <button type="button" onClick={() => open({ kind: "cash" })}>
              <Plus size={18} strokeWidth={2.6} /> Cash
            </button>
            <button type="button" className="deck-close" aria-label="Stack cards" onClick={() => settle(0)}>
              <ChevronUp size={20} strokeWidth={2.6} />
            </button>
          </motion.div>
        </motion.div>
      )}

      <div className="deck-panel">
        <motion.div className="deck-grab" style={{ touchAction: "none" }} onPointerDownCapture={resetPan} onClick={() => !panned.current && n && settle(expanded ? 0 : 1)} {...pan}>
          <span className="deck-grabber" />
          {n > 1 && (
            <motion.span className="deck-hint" style={{ opacity: hintOpacity }}>
              Pull down to see all {n}
            </motion.span>
          )}
        </motion.div>
        {header}
        {children}
      </div>
    </div>
  );
}

function DeckCard({
  card,
  i,
  n,
  p,
  W,
  H,
  front,
  stealth,
  expanded,
  onOpen,
}: {
  card: Card;
  i: number;
  n: number;
  p: MotionValue<number>;
  W: number;
  H: number;
  front: number;
  stealth: boolean;
  expanded: boolean;
  onOpen: () => void;
}) {
  const depth = Math.min(i, MAX_DEPTH);
  const shown = Math.min(n, MAX_DEPTH + 1);
  // Collapsed: the front card (i = 0) sits lowest; each card behind it a strip higher and a touch smaller.
  const yc = (shown - 1 - depth) * STRIP;
  const ye = i * (H + GAP);
  const y = useTransform(p, [0, 1], [yc, ye], { clamp: false });
  const scale = useTransform(p, [0, 1], [front - depth * 0.045, 1]);
  const opacity = useTransform(p, [0, 0.25], [i > MAX_DEPTH ? 0 : 1, 1]);
  const shade = useTransform(p, [0, 0.6], [Math.min(0.45, depth * 0.16), 0]);

  return (
    <motion.div className="deck-card" style={{ y, scale, opacity, width: W, zIndex: n - i }}>
      <button
        type="button"
        className="deck-card-btn"
        aria-label={card.kind === "cash" ? `Cash: ${card.nickname}` : `${card.issuer} ${card.last4}`}
        tabIndex={expanded || i === 0 ? 0 : -1}
        onClick={(e) => {
          if (!expanded) return; // collapsed: let the stage open the deck
          e.stopPropagation();
          onOpen();
        }}
      >
        <motion.div layoutId={`card-${card.id}`}>
          <CardFace card={card} stealth={stealth} />
        </motion.div>
      </button>
      <motion.span className="deck-shade" style={{ opacity: shade }} />
    </motion.div>
  );
}
