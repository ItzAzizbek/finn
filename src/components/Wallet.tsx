import { animate, motion, useMotionValue, useTransform, type MotionValue, type PanInfo } from "motion/react";
import { ChevronUp, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Card } from "../data";
import { haptic, useElementWidth } from "../lib";
import { useStore } from "../store";
import { CardFace } from "./Card";

// ─── The wallet ─────────────────────────────────────────────────────────
// A real leather wallet tucked under the home screen. Closed, you only see
// its top: card edges poking out of the slots and the stitched pocket with
// its thumb notch — the history panel covers the rest. Tap it or pull down
// and the panel slides away while the cards slide out into a list.
//
// Gestures are deliberately one-sided so scrolling never fights the wallet:
//  · Closed: pulling DOWN (at the top of the page) opens it. Swiping up just
//    scrolls the page.
//  · Open: the cards scroll like any list. Only the panel's handle (swipe it
//    up past a firm threshold) or the ⌃ button on the pocket closes it.
// One motion value, 0 (closed) → 1 (open), drives every position.

const RATIO = 1.586;
const CARD_INSET = 30; // cards sit a little inside the leather
const LEATHER_INSET = 14;
const TOP_PAD = 14; // breathing room above the wallet
const SLOT_TOP = TOP_PAD + 16; // where the first card slot starts, closed
const OPEN_TOP = TOP_PAD + 18; // where the first card sits, open
const STRIP = 14; // how much of each card shows above the next slot
const MAX_SLOTS = 4; // cards past the fourth hide behind it
const LIP = 32; // front card showing above the pocket, closed
const POCKET_H = 100;
const POCKET_PEEK = 44; // pocket showing above the panel, closed
const GAP = 14;
const NOTCH = 24; // thumb-notch radius
const SLOP = 8; // px of movement before a touch counts as a gesture
const OPEN_PULL = 48; // pull this far down to open…
const OPEN_FLICK = 320; // …or flick down this fast (px/s)
const CLOSE_PUSH = 90; // closing needs a firmer, deliberate push up the handle
const CLOSE_FLICK = 700;

const settleSpring = { type: "spring", stiffness: 300, damping: 34 } as const;

type Zone = "stage" | "grab";

export function WalletDeck({ cards, header, children }: { cards: Card[]; header?: ReactNode; children: ReactNode }) {
  const { open, state } = useStore();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [expanded, setExpanded] = useState(false);
  const p = useMotionValue(0);
  const startP = useRef(0);
  /** Where the wallet is headed (not where the animation happens to be) — gestures read this. */
  const isOpen = useRef(false);
  /** True once the current press has moved — the click that ends it isn't a tap. */
  const moved = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<HTMLDivElement>(null);

  const n = cards.length;
  const W = Math.max(0, width - CARD_INSET * 2);
  const H = W / RATIO;
  const slots = Math.max(1, Math.min(n, MAX_SLOTS));
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
      isOpen.current = false;
      setExpanded(false);
    }
  }, [n, expanded, p]);

  const settle = (to: 0 | 1, velocity = 0) => {
    isOpen.current = to === 1;
    animate(p, to, { ...settleSpring, velocity: velocity / travel });
    if ((to === 1) !== expanded) haptic(to ? 12 : 8);
    setExpanded(to === 1);
  };
  const follow = (dy: number) => {
    const raw = startP.current + dy / travel;
    // Rubber-band past either end instead of stopping dead.
    p.set(raw > 1 ? 1 + (raw - 1) * 0.25 : raw < 0 ? raw * 0.25 : raw);
  };
  const release = (dy: number, vy: number) => {
    const wasOpen = isOpen.current;
    if (!wasOpen && (dy > OPEN_PULL || vy > OPEN_FLICK)) settle(1, vy);
    else if (wasOpen && (dy < -CLOSE_PUSH || (vy < -CLOSE_FLICK && dy < -30))) settle(0, vy);
    else settle(wasOpen ? 1 : 0, vy);
  };

  /** Which way may this zone move the wallet right now? null = leave the gesture to the page. */
  const allowed = (zone: Zone, dy: number) => {
    if (!isOpen.current && dy > 0) {
      if (zone === "grab") return true; // the handle never scrolls, so it can always open
      // On the wallet itself, pulling down opens only at the top of the page, like pull-to-refresh.
      const scroller = ref.current?.closest(".tab-scroll");
      return !scroller || scroller.scrollTop <= 1;
    }
    // Closing only ever happens from the handle, never from scrolling over the cards.
    return zone === "grab" && isOpen.current && dy < 0;
  };

  // Touch: native, non-passive listeners so we can claim a pull without blocking ordinary scrolling.
  useTouchPull(stageRef, "stage", { allowed, follow, release, startP, p, moved });
  useTouchPull(grabRef, "grab", { allowed, follow, release, startP, p, moved });

  // Mouse: a click-drag on the closed wallet or on the handle does the same thing.
  const mousePan = (zone: Zone) => {
    let active = false;
    return {
      onPanStart: (e: PointerEvent) => {
        active = e.pointerType === "mouse";
        if (!active) return;
        moved.current = true;
        p.stop();
        startP.current = p.get();
      },
      onPan: (_: PointerEvent, info: PanInfo) => {
        if (active && allowed(zone, info.offset.y)) follow(info.offset.y);
      },
      onPanEnd: (_: PointerEvent, info: PanInfo) => {
        if (!active) return;
        active = false;
        if (allowed(zone, info.offset.y)) release(info.offset.y, info.velocity.y);
        else settle(isOpen.current ? 1 : 0);
      },
    };
  };
  const resetMoved = () => {
    moved.current = false;
  };

  const pocketW = Math.max(0, width - LEATHER_INSET * 2);

  return (
    <div ref={ref} className={`deck wallet ${expanded ? "is-open" : ""}`}>
      <motion.div
        ref={stageRef}
        className="deck-stage"
        role="button"
        aria-label={expanded ? "Wallet, open" : "Open wallet"}
        aria-expanded={expanded}
        tabIndex={expanded ? -1 : 0}
        style={{ height: stageH }}
        onPointerDownCapture={resetMoved}
        onKeyDown={(e) => {
          if (!expanded && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            settle(1);
          }
        }}
        onClick={() => {
          if (moved.current || expanded) return;
          settle(1);
        }}
        {...(expanded ? {} : mousePan("stage"))}
      >
        {width > 0 && (
          <>
            <motion.div className="wallet-back leather" style={{ top: TOP_PAD, height: backH }} />

            {cards.map((card, j) => (
              <Slotted
                key={card.id}
                card={card}
                j={j}
                slots={slots}
                openY={OPEN_TOP + j * (H + GAP)}
                p={p}
                W={W}
                count={n}
                stealth={state.prefs.stealth}
                expanded={expanded}
                onOpen={() => {
                  if (moved.current) return;
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
                  <Plus size={18} strokeWidth={2.6} /> Add a card
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
        <motion.div
          ref={grabRef}
          className="deck-grab"
          style={{ touchAction: "none" }}
          role="button"
          aria-label={expanded ? "Close wallet" : "Open wallet"}
          onPointerDownCapture={resetMoved}
          onClick={() => !moved.current && settle(expanded ? 0 : 1)}
          {...mousePan("grab")}
        >
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

/**
 * Pull-to-open on touch screens. Waits until the finger has clearly moved, then
 * either claims the gesture (and stops the page from scrolling) or lets it go
 * entirely, so a scroll is never half-hijacked.
 */
function useTouchPull(
  target: RefObject<HTMLElement | null>,
  zone: Zone,
  h: {
    allowed: (zone: Zone, dy: number) => boolean;
    follow: (dy: number) => void;
    release: (dy: number, vy: number) => void;
    startP: { current: number };
    p: MotionValue<number>;
    moved: { current: boolean };
  },
) {
  // Handlers change every render; the listeners read the latest through a ref.
  const latest = useRef(h);
  latest.current = h;

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let x0 = 0;
    let y0 = 0;
    let mode: "idle" | "pull" | "page" = "idle";
    let lastY = 0;
    let lastT = 0;
    let vy = 0;

    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      x0 = t.clientX;
      y0 = lastY = t.clientY;
      lastT = e.timeStamp;
      vy = 0;
      mode = "idle";
    };
    const move = (e: TouchEvent) => {
      if (mode === "page" || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      const dt = e.timeStamp - lastT;
      if (dt > 0) vy = ((t.clientY - lastY) / dt) * 1000;
      lastY = t.clientY;
      lastT = e.timeStamp;

      if (mode === "idle") {
        // Pulling down at the very top would only bounce the page — hold it from the first pixel.
        if (zone === "stage" && dy > 0 && latest.current.allowed(zone, dy) && e.cancelable) e.preventDefault();
        if (Math.abs(dy) < SLOP && Math.abs(dx) < SLOP) return;
        latest.current.moved.current = true;
        const { allowed, p, startP } = latest.current;
        if (Math.abs(dy) > Math.abs(dx) && allowed(zone, dy)) {
          mode = "pull";
          p.stop();
          startP.current = p.get();
        } else {
          mode = "page";
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
      latest.current.follow(dy - Math.sign(dy) * SLOP);
    };
    const end = (e: TouchEvent) => {
      if (mode === "pull") {
        const t = e.changedTouches[0];
        latest.current.release(t.clientY - y0, vy);
      }
      mode = "idle";
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [target, zone]);
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

/** A card in its slot: closed, only its top edge shows; open, it slides up into the list. */
function Slotted({
  card,
  j,
  slots,
  count,
  p,
  W,
  openY,
  stealth,
  expanded,
  onOpen,
}: {
  card: Card;
  j: number;
  slots: number;
  count: number;
  p: MotionValue<number>;
  W: number;
  openY: number;
  stealth: boolean;
  expanded: boolean;
  onOpen: () => void;
}) {
  const depth = Math.min(j, MAX_SLOTS - 1);
  // The front card (j = 0) sits lowest; each one behind it a strip higher.
  const closedY = SLOT_TOP + (slots - 1 - depth) * STRIP;
  const y = useTransform(p, [0, 1], [closedY, openY], { clamp: false });
  const opacity = useTransform(p, [0, 0.25], [j >= MAX_SLOTS ? 0 : 1, 1]);
  const shade = useTransform(p, [0, 0.6], [Math.min(0.4, depth * 0.13), 0]);
  return (
    <motion.div className="deck-card" style={{ y, opacity, width: W, left: CARD_INSET, zIndex: 10 + count - j }}>
      <button
        type="button"
        className="deck-card-btn"
        aria-label={`${card.issuer} ${card.last4}`}
        tabIndex={expanded ? 0 : -1}
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
      <motion.span className="deck-shade" style={{ opacity: shade }} />
    </motion.div>
  );
}
