import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import type { Card } from "../data";
import { haptic, useElementWidth } from "../lib";
import { useStore } from "../store";
import { CardFace } from "./Card";
import { softSpring } from "./ui";

const RATIO = 1.586;

export function Wallet({ cards }: { cards: Card[] }) {
  const { open, state } = useStore();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [spread, setSpread] = useState(false);

  const cardH = width / RATIO;
  const n = cards.length;
  const peek = spread ? cardH + 14 : Math.max(46, Math.round(cardH * 0.24));
  const height = n ? cardH + (n - 1) * peek : cardH;

  // Draw back-to-front: cards[0] is the hero sitting at the front of the stack.
  const ordered = [...cards].reverse();

  return (
    <section className="wallet">
      <div className="section-head">
        <h2>Wallet</h2>
        {n > 1 && (
          <button type="button" className="chip-btn" onClick={() => setSpread((s) => !s)}>
            {spread ? "Stack" : "Fan out"}
          </button>
        )}
      </div>
      <motion.div ref={ref} className="wallet-stack" animate={{ height: width ? height : "auto" }} transition={softSpring}>
        {!n && (
          <button type="button" className="wallet-empty" onClick={() => open({ kind: "addCard" })}>
            <Plus size={28} strokeWidth={2.6} />
            Add your first card
          </button>
        )}
        {width > 0 &&
          ordered.map((card, j) => (
            <motion.div
              key={card.id}
              className="wallet-slot"
              style={{ zIndex: j }}
              initial={{ y: j * peek - 60, opacity: 0, rotateX: 18 }}
              animate={{ y: j * peek, opacity: 1, rotateX: 0 }}
              transition={{ ...softSpring, delay: spread ? 0 : 0.05 * j }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                haptic();
                open({ kind: "card", id: card.id });
              }}
            >
              <motion.div layoutId={`card-${card.id}`} className="wallet-card" transition={softSpring}>
                <CardFace card={card} stealth={state.prefs.stealth} />
              </motion.div>
            </motion.div>
          ))}
      </motion.div>
    </section>
  );
}
