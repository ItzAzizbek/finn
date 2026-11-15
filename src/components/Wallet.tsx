import { animate, motion, useMotionValue, useTransform, type MotionValue, type PanInfo } from "motion/react";
import { ChevronUp, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Card } from "../data";
import { haptic, useElementWidth } from "../lib";
import { useStore } from "../store";
import { CardFace } from "./Card";

// ─── The wallet ─────────────────────────────────────────────────────────
// A real leather wallet tucked under the home screen. Collapsed, you only
// see its top: card edges poking out of the slots, banknotes peeking from
// the back compartment, the stitched pocket with its thumb notch — and the
// history panel covers the rest. Tap it or pull down and the panel slides
// away, the pocket drops to the bottom and the cards slide out into a list.
// One motion value, 0 (closed) → 1 (open), drives every position.

const RATIO = 1.586;
const LEATHER_INSET = 14; // leather edge from the screen edge
const CARD_INSET = 30; // cards sit a little inside the leather
const TOP_PAD = 30; // room above the wallet for banknotes to stick out
const SLOT_TOP = TOP_PAD + 16; // where the first card slot starts, closed
const OPEN_TOP = TOP_PAD + 18; // where the first card sits, open
const STRIP = 14; // how much of each card shows above the next slot
const MAX_SLOTS = 4; // cards past the fourth hide behind it
const LIP = 32; // front card showing above the pocket, closed
const POCKET_H = 100;
const POCKET_PEEK = 44; // pocket showing above the panel, closed
const GAP = 14;
const NOTCH = 24; // thumb-notch radius
const SWIPE = 48; // px of pull that commits to opening/closing
const FLICK = 320; // px/s that commits regardless of distance

const BILL_TILT = [-3, 2.5, -1.5];
const BILL_SHIFT = [-6, 9, -2];

const settleSpring = { type: "spring", stiffness: 300, damping: 34 } as const;

export function WalletDeck({ cards, header, children }: { cards: Card[]; header?: ReactNode; children: ReactNode }) {
  const { open, state } = useStore();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [expanded, setExpanded] = useState(false);
  const p = useMotionValue(0);
  const startP = useRef(0);
  const panned = useRef(false);

  // Cards live in the slots, cash in the back compartment. Open, cards list first, then the notes.
  const slotted = cards.filter((c) => c.kind !== "cash");
  const notes = cards.filter((c) => c.kind === "cash");
  const items = [...slotted, ...notes];
  const n = items.length;

  const W = Math.max(0, width - CARD_INSET * 2);
  const H = W / RATIO;
  const slots = Math.max(1, Math.min(slotted.length, MAX_SLOTS));
  const pocketClosed = SLOT_TOP + (slots - 1) * STRIP + LIP;
  const pocketOpen = OPEN_TOP + Math.max(0, n * (H + GAP) - GAP) + 16;
  const collapsedTop = pocketClosed + POCKET_PEEK;
  const expandedTop = pocketOpen + POCKET_H + 18;
  const travel = Math.max(1, expandedTop - collapsedTop);

  const stageH = useTransform(p, [0, 1], [collapsedTop, expandedTop], { clamp: false });
  const pocketY = useTransform(p, [0, 1], [pocketClosed, pocketOpen], { clamp: false });
  const backH = useTransform(pocketY, (y) => y + POCKET_H - TOP_PAD);
  const shadowY = useTransform(pocketY, (y) => y - 14);
  const addOpacity = useTransform(p, [0.6, 1], [0, 1]);
  const embossOpacity = useTransform(p, [0, 0.4], [1, 0]);
  const hintOpacity = useTransform(p, [0, 0.2], [1, 0]);

  // Emptying the wallet closes it so nothing is left hanging open.
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
  const pan = { onPanStart, onPan, onPanEnd };
  // A click that ends a pan isn't a tap.
  const resetPan = () => {
    panned.current = false;
  };

  const pocketW = Math.max(0, width - LEATHER_INSET * 2);

  return (
    <div ref={ref} className={`deck wallet ${expanded ? "is-open" : ""}`}>
      <motion.div
        className="deck-stage"
        role="button"
        aria-label={expanded ? "Wallet, open" : "Open wallet"}
        aria-expanded={expanded}
        tabIndex={expanded ? -1 : 0}
        style={{ height: stageH, touchAction: expanded ? "pan-y" : "none" }}
        onPointerDownCapture={resetPan}
        onKeyDown={(e) => {
          if (!expanded && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            settle(1);
          }
        }}
        onClick={() => {
          if (panned.current || expanded) return;
          settle(1);
        }}
        {...pan}
      >
        {width > 0 && (
          <>
            <motion.div className="wallet-back leather" style={{ top: TOP_PAD, height: backH }} />

            {notes.map((card, k) => (
              <Note
                key={card.id}
                card={card}
                k={k}
                openY={OPEN_TOP + (slotted.length + k) * (H + GAP)}
                p={p}
                W={W}
                stealth={state.prefs.stealth}
                expanded={expanded}
                onOpen={() => {
                  if (panned.current) return;
                  haptic();
                  open({ kind: "card", id: card.id });
                }}
              />
            ))}

            {slotted.map((card, j) => (
              <Slotted
                key={card.id}
                card={card}
                j={j}
                slots={slots}
                openY={OPEN_TOP + j * (H + GAP)}
                p={p}
                W={W}
                count={slotted.length}
                stealth={state.prefs.stealth}
                expanded={expanded}
                onOpen={() => {
                  if (panned.current) return;
                  haptic();
                  open({ kind: "card", id: card.id });
                }}
              />
            ))}

            <motion.div className="wallet-pocket-shadow" style={{ y: shadowY }} />
            <motion.div className="wallet-pocket leather" style={{ y: pocketY, height: POCKET_H }}>
              <Stitching w={pocketW} h={POCKET_H} />
              <motion.span className="wallet-emboss" style={{ opacity: embossOpacity }}>
                finn<i>.</i>
              </motion.span>
              <motion.div className="wallet-add" style={{ opacity: addOpacity, pointerEvents: expanded ? "auto" : "none" }}>
                {n === 0 && <span className="wallet-empty-note">Your wallet is empty</span>}
                <button type="button" onClick={() => open({ kind: "addCard" })}>
                  <Plus size={18} strokeWidth={2.6} /> Card
                </button>
                <button type="button" onClick={() => open({ kind: "cash" })}>
                  <Plus size={18} strokeWidth={2.6} /> Cash
                </button>
                <button type="button" className="wallet-close" aria-label="Close wallet" onClick={() => settle(0)}>
                  <ChevronUp size={20} strokeWidth={2.6} />
                </button>
              </motion.div>
            </motion.div>
          </>
        )}
      </motion.div>

      <div className="deck-panel">
        <motion.div className="deck-grab" style={{ touchAction: "none" }} onPointerDownCapture={resetPan} onClick={() => !panned.current && settle(expanded ? 0 : 1)} {...pan}>
          <span className="deck-grabber" />
          <motion.span className="deck-hint" style={{ opacity: hintOpacity }}>
            {n ? "Pull down to open your wallet" : "Pull down — your wallet is empty"}
          </motion.span>
        </motion.div>
        {header}
        {children}
      </div>
    </div>
  );
}

/** Saddle stitching around the pocket, dipping around the thumb notch. */
function Stitching({ w, h }: { w: number; h: number }) {
  if (!w) return null;
  const inset = 8;
  const cx = w / 2;
  const r = NOTCH + inset;
  const dx = Math.sqrt(r * r - inset * inset);
  const d = [
    `M ${inset} ${h + 2}`,
    `L ${inset} ${inset + 14}`,
    `Q ${inset} ${inset} ${inset + 14} ${inset}`,
    `L ${cx - dx} ${inset}`,
    `A ${r} ${r} 0 0 0 ${cx + dx} ${inset}`,
    `L ${w - inset - 14} ${inset}`,
    `Q ${w - inset} ${inset} ${w - inset} ${inset + 14}`,
    `L ${w - inset} ${h + 2}`,
  ].join(" ");
  return (
    <svg className="wallet-stitch" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={d} />
    </svg>
  );
}

interface ItemProps {
  card: Card;
  p: MotionValue<number>;
  W: number;
  openY: number;
  stealth: boolean;
  expanded: boolean;
  onOpen: () => void;
}

function ItemButton({ card, stealth, expanded, onOpen, focusable }: Pick<ItemProps, "card" | "stealth" | "expanded" | "onOpen"> & { focusable: boolean }) {
  return (
    <button
      type="button"
      className="deck-card-btn"
      aria-label={card.kind === "cash" ? `Cash: ${card.nickname}` : `${card.issuer} ${card.last4}`}
      tabIndex={expanded && focusable ? 0 : -1}
      onClick={(e) => {
        if (!expanded) return; // closed: the tap opens the wallet instead
        e.stopPropagation();
        onOpen();
      }}
    >
      <motion.div layoutId={`card-${card.id}`}>
        <CardFace card={card} stealth={stealth} />
      </motion.div>
    </button>
  );
}

/** A card in its slot: closed, only its top edge shows; open, it slides up into the list. */
function Slotted({ j, slots, count, ...props }: ItemProps & { j: number; slots: number; count: number }) {
  const { p, W, openY } = props;
  const depth = Math.min(j, MAX_SLOTS - 1);
  // The front card (j = 0) sits lowest; each one behind it a strip higher.
  const closedY = SLOT_TOP + (slots - 1 - depth) * STRIP;
  const y = useTransform(p, [0, 1], [closedY, openY], { clamp: false });
  const opacity = useTransform(p, [0, 0.25], [j >= MAX_SLOTS ? 0 : 1, 1]);
  const shade = useTransform(p, [0, 0.6], [Math.min(0.4, depth * 0.13), 0]);
  return (
    <motion.div className="deck-card" style={{ y, opacity, width: W, left: CARD_INSET, zIndex: 10 + count - j }}>
      <ItemButton {...props} focusable />
      <motion.span className="deck-shade" style={{ opacity: shade }} />
    </motion.div>
  );
}

/** Cash: closed, banknotes stick up out of the back compartment, a little askew; open, they line up under the cards. */
function Note({ k, ...props }: ItemProps & { k: number }) {
  const { p, W, openY } = props;
  const shown = k < BILL_TILT.length;
  const closedY = TOP_PAD - 24 + k * 6;
  const y = useTransform(p, [0, 1], [closedY, openY], { clamp: false });
  const x = useTransform(p, [0, 1], [shown ? BILL_SHIFT[k] : 0, 0]);
  const rotate = useTransform(p, [0, 1], [shown ? BILL_TILT[k] : 0, 0]);
  const opacity = useTransform(p, [0, 0.25], [shown ? 1 : 0, 1]);
  // Closed, notes are inside the wallet — behind the leather. Once it starts opening they come out on top.
  const zIndex = useTransform(p, (v) => (v > 0.04 ? 5 : 0));
  return (
    <motion.div className="deck-card wallet-note" style={{ y, x, rotate, opacity, zIndex, width: W, left: CARD_INSET }}>
      <ItemButton {...props} focusable />
    </motion.div>
  );
}
