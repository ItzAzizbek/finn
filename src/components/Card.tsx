import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { FONTS, SKIN_BY_ID, type Card, type CardDesign, type Ink, type Pattern } from "../data";
import { formatMoney } from "../currency";
import { luminance } from "../lib";
import { formatNumber, type CardSecrets } from "../vault";
import { Icon, LogoMark, Sticker } from "./icons";

export function resolveLook(d: CardDesign): { bg: string; ink: Ink } {
  if (d.color) {
    return {
      ink: luminance(d.color) > 0.62 ? "dark" : "light",
      bg: `radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,.28) 0%, transparent 55%), radial-gradient(120% 130% at 100% 100%, rgba(0,0,0,.28) 0%, transparent 60%), ${d.color}`,
    };
  }
  const skin = SKIN_BY_ID[d.skinId] ?? SKIN_BY_ID.midnight;
  return { bg: skin.bg, ink: skin.ink };
}

function Chip() {
  return (
    <svg className="card-chip" viewBox="0 0 46 34" aria-hidden>
      <defs>
        <linearGradient id="chipg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e7b0" />
          <stop offset=".5" stopColor="#c9a64f" />
          <stop offset="1" stopColor="#f2d98a" />
        </linearGradient>
      </defs>
      <rect x=".5" y=".5" width="45" height="33" rx="7" fill="url(#chipg)" stroke="rgba(0,0,0,.25)" />
      <path d="M0 12h14M0 22h14M32 12h14M32 22h14M14 0v34M32 0v34M14 17h18" stroke="rgba(80,55,10,.45)" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function Contactless() {
  return (
    <svg className="card-nfc" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M8.5 8.5a5 5 0 0 1 0 7M12 6a8.5 8.5 0 0 1 0 12M15.5 3.5a12 12 0 0 1 0 17" />
    </svg>
  );
}

function PatternLayer({ pattern }: { pattern: Pattern }) {
  if (pattern === "none") return null;
  if (pattern === "waves") {
    return (
      <svg className="card-layer card-pattern" viewBox="0 0 320 202" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M-10 ${20 + i * 24} C 60 ${-4 + i * 24}, 120 ${44 + i * 24}, 180 ${20 + i * 24} S 290 ${-4 + i * 24}, 340 ${20 + i * 24}`} fill="none" stroke="currentColor" strokeWidth="1.4" />
        ))}
      </svg>
    );
  }
  return <div className={`card-layer card-pattern pattern-${pattern}`} aria-hidden />;
}

// ─── Card face ──────────────────────────────────────────────────────────

interface FaceProps {
  card: Card;
  design?: CardDesign;
  className?: string;
  style?: CSSProperties;
  /** Show the balance on the card face. */
  showBalance?: boolean;
  stealth?: boolean;
  /** Hide the stored drawing (the studio canvas renders it live instead). */
  hideDrawing?: boolean;
  children?: ReactNode;
}

/** Inline style for the text layer: chosen font plus an optional custom ink. */
export function textStyle(d: CardDesign): CSSProperties {
  const font = FONTS.find((f) => f.id === d.font) ?? FONTS[0];
  const style: Record<string, string> = { fontFamily: font.family };
  if (d.textColor) {
    style["--ink"] = d.textColor;
    style["--ink-2"] = `color-mix(in srgb, ${d.textColor} 72%, transparent)`;
  }
  return style as CSSProperties;
}

export function CardFace({ card, design = card.design, className = "", style, showBalance = true, stealth, hideDrawing, children }: FaceProps) {
  const look = resolveLook(design);
  const balanceVisible = showBalance && design.showBalance;
  return (
    <div className={`card-wrap ${className}`} style={style}>
      <div className={`card ink-${look.ink} finish-${design.finish} font-${design.font}`} style={{ background: look.bg }}>
        <PatternLayer pattern={design.pattern} />
        {design.drawing && !hideDrawing && <img className="card-layer card-drawing" src={design.drawing} alt="" draggable={false} />}
        {children}
        <div className="card-layer card-finish" />
        <div className="card-layer card-noise" />
        <AnimatePresence>
          {design.sticker && (
            <motion.span
              key={design.sticker}
              className="card-sticker"
              initial={{ scale: 0.3, rotate: -40, opacity: 0 }}
              animate={{ scale: 1, rotate: -12, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
            >
              <Sticker id={design.sticker} />
            </motion.span>
          )}
        </AnimatePresence>
        <div className="card-content" style={textStyle(design)}>
          <div className="card-row">
            <div className="card-issuer">
              <span className="card-bank">
                <LogoMark id={card.logo} size={18} />
                {card.issuer}
              </span>
              {card.tagline && <span className="card-tagline">{card.tagline}</span>}
            </div>
            {card.label && <span className="card-type">{card.label}</span>}
          </div>
          <div className="card-mid">
            {design.showChip && (
              <>
                <Chip />
                <Contactless />
              </>
            )}
          </div>
          <div className="card-row card-row-end">
            <div className="card-ident">
              {card.nickname && <div className="card-nick">{card.nickname}</div>}
              <div className="card-num">•••• {card.last4}</div>
            </div>
            {balanceVisible && <div className={`card-bal ${stealth ? "is-hidden" : ""}`}>{formatMoney(card.balance, card.currency)}</div>}
          </div>
        </div>
        <AnimatePresence>
          {card.frozen && (
            <motion.div className="card-frozen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.span initial={{ scale: 0.4, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
                <Icon name="snow" size={44} />
              </motion.span>
              Frozen
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Card back ──────────────────────────────────────────────────────────

/** Back of the card. Pass `secrets` (decrypted) to show the full number and CVV. */
export function CardBack({ card, secrets }: { card: Card; secrets?: CardSecrets | null }) {
  const look = resolveLook(card.design);
  const amex = card.brand === "amex";
  const masked = amex ? `•••• •••••• •${card.last4}` : `•••• •••• •••• ${card.last4}`;
  const fullNumber = secrets?.number ? formatNumber(secrets.number) : "";
  return (
    <div className="card-wrap">
      <div className={`card card-back ink-${look.ink} finish-${card.design.finish}`} style={{ background: look.bg }}>
        <div className="card-layer card-finish" />
        <div className="card-layer card-noise" />
        <div className="card-stripe" />
        <div className="card-back-body" style={textStyle(card.design)}>
          <div>
            <div className="card-back-label">Card number</div>
            <div className="card-back-num">{fullNumber || masked}</div>
          </div>
          <div className="card-back-meta">
            <div className="card-back-holder">
              <div className="card-back-label">Name</div>
              <div className="card-back-val">{card.holder || "—"}</div>
            </div>
            <div>
              <div className="card-back-label">Expires</div>
              <div className="card-back-val">{card.expiry || "••/••"}</div>
            </div>
            <div>
              <div className="card-back-label">{amex ? "CID" : "CVV"}</div>
              <div className="card-back-val">{secrets?.cvv || (amex ? "••••" : "•••")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
