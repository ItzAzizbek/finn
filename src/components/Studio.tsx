import { AnimatePresence, motion } from "motion/react";
import { Ban, Brush, Dices, Eraser, Grid3x3, Palette, PenLine, Smile, Sparkles, SprayCan, Trash2, Type, Undo2, Wand2, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { FINISHES, FONTS, PATTERNS, SKINS, SWATCHES, TEXT_COLORS, type Card, type CardDesign, type Pattern } from "../data";
import { haptic } from "../lib";
import { CardFace, resolveLook } from "./Card";
import { LOGOS, LogoMark, Sticker, STICKERS } from "./icons";
import { spring, Toggle } from "./ui";

// ─── Drawing canvas ─────────────────────────────────────────────────────

type BrushKind = "pen" | "neon" | "rainbow" | "spray" | "eraser";

interface Stroke {
  brush: BrushKind;
  color: string;
  size: number;
  hue0: number;
  pts: { x: number; y: number }[];
}

export interface DrawApi {
  undo: () => void;
  clear: () => void;
}

/** Brush sizes are expressed against a 340px-wide card so strokes look the same at any resolution. */
const BASIS = 340;

function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number) {
  const k = w / BASIS;
  const pts = s.pts.map((p) => ({ x: p.x * w, y: p.y * h }));
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = s.brush === "eraser" ? "destination-out" : "source-over";

  if (s.brush === "spray") {
    ctx.fillStyle = s.color;
    pts.forEach((p, i) => {
      for (let j = 0; j < 14; j++) {
        const a = seeded(i * 31 + j) * Math.PI * 2;
        const r = seeded(i * 17 + j * 3) * s.size * 1.6 * k;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 0.9 * k, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
    return;
  }

  if (s.brush === "rainbow") {
    ctx.lineWidth = s.size * k;
    for (let i = 1; i < pts.length; i++) {
      ctx.strokeStyle = `hsl(${(s.hue0 + i * 5) % 360} 100% 60%)`;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    if (pts.length === 1) {
      ctx.fillStyle = `hsl(${s.hue0} 100% 60%)`;
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, (s.size * k) / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 1) ctx.lineTo(pts[0].x + 0.01, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    if (pts.length > 1) ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  };

  if (s.brush === "neon") {
    ctx.shadowColor = s.color;
    ctx.shadowBlur = s.size * 2.2 * k;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size * k;
    trace();
    trace();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.lineWidth = Math.max(1, s.size * 0.32 * k);
    trace();
  } else {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size * k;
    trace();
  }
  ctx.restore();
}

function DrawCanvas({
  initial,
  brush,
  color,
  size,
  apiRef,
  onCommit,
  onHistory,
}: {
  initial: string | null;
  brush: BrushKind;
  color: string;
  size: number;
  apiRef: RefObject<DrawApi | null>;
  onCommit: (dataUrl: string | null) => void;
  onHistory: (n: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const base = useRef<HTMLImageElement | null>(null);
  const raf = useRef(0);

  const render = useCallback(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (base.current?.complete) ctx.drawImage(base.current, 0, 0, c.width, c.height);
    for (const s of strokes.current) drawStroke(ctx, s, c.width, c.height);
    if (current.current) drawStroke(ctx, current.current, c.width, c.height);
  }, []);

  const schedule = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(render);
  }, [render]);

  const commit = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    onHistory(strokes.current.length);
    onCommit(strokes.current.length || base.current ? c.toDataURL("image/webp", 0.85) : null);
  }, [onCommit, onHistory]);

  // Size the backing store to the element.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // keeps saved drawings small for localStorage
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      render();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, [render]);

  // Load the existing drawing once, as the bottom layer.
  useEffect(() => {
    if (!initial) return;
    const img = new Image();
    img.onload = () => {
      base.current = img;
      render();
    };
    img.src = initial;
  }, []);

  useEffect(() => {
    apiRef.current = {
      undo: () => {
        strokes.current.pop();
        render();
        commit();
      },
      clear: () => {
        strokes.current = [];
        base.current = null;
        render();
        commit();
      },
    };
  }, [apiRef, render, commit]);

  const point = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  return (
    <canvas
      ref={canvasRef}
      className="card-layer draw-canvas"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        haptic(4);
        current.current = { brush, color, size, hue0: Math.floor(Math.random() * 360), pts: [point(e)] };
        schedule();
      }}
      onPointerMove={(e) => {
        if (!current.current) return;
        const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
        const r = e.currentTarget.getBoundingClientRect();
        for (const ev of events) current.current.pts.push({ x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height });
        schedule();
      }}
      onPointerUp={() => {
        if (!current.current) return;
        strokes.current.push(current.current);
        current.current = null;
        render();
        commit();
      }}
      onPointerCancel={() => {
        current.current = null;
        render();
      }}
    />
  );
}

// ─── Studio editor ──────────────────────────────────────────────────────

type TabId = "skins" | "draw" | "text" | "color" | "pattern" | "sticker" | "finish";

const TABS: { id: TabId; label: string; icon: typeof Brush }[] = [
  { id: "skins", label: "Skins", icon: Sparkles },
  { id: "draw", label: "Draw", icon: PenLine },
  { id: "text", label: "Text", icon: Type },
  { id: "color", label: "Color", icon: Palette },
  { id: "pattern", label: "Pattern", icon: Grid3x3 },
  { id: "sticker", label: "Sticker", icon: Smile },
  { id: "finish", label: "Finish", icon: Wand2 },
];

const BRUSHES: { id: BrushKind; label: string; icon: typeof Brush }[] = [
  { id: "pen", label: "Pen", icon: PenLine },
  { id: "neon", label: "Neon", icon: Zap },
  { id: "rainbow", label: "Rainbow", icon: Brush },
  { id: "spray", label: "Spray", icon: SprayCan },
  { id: "eraser", label: "Eraser", icon: Eraser },
];

const INK_COLORS = ["#f5f5f7", "#0a0a0b", "#c8ff2e", "#ff4fa3", "#8b5cff", "#2ee6ff", "#ff7a1a", "#ffd60a"];

function randomDesign(prev: CardDesign): CardDesign {
  const r = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
  return {
    ...prev,
    skinId: r(SKINS).id,
    color: Math.random() < 0.25 ? r(SWATCHES) : null,
    pattern: Math.random() < 0.5 ? "none" : r(PATTERNS).id,
    sticker: Math.random() < 0.55 ? r(STICKERS) : null,
    finish: r(FINISHES).id,
    font: Math.random() < 0.6 ? "sans" : r(FONTS).id,
    textColor: null,
  };
}

function TextField({ label, value, onChange, max, placeholder, numeric }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string; numeric?: boolean }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        value={value}
        maxLength={max}
        placeholder={placeholder}
        inputMode={numeric ? "numeric" : undefined}
        autoComplete="off"
        onChange={(e) => onChange(numeric ? e.target.value.replace(/\D/g, "") : e.target.value)}
      />
    </label>
  );
}

export function StudioEditor({ card, onChange, compact }: { card: Card; onChange: (c: Card) => void; compact?: boolean }) {
  const [tab, setTab] = useState<TabId>("skins");
  const [brush, setBrush] = useState<BrushKind>("neon");
  const [ink, setInk] = useState(INK_COLORS[2]);
  const [size, setSize] = useState(8);
  const [history, setHistory] = useState(0);
  const api = useRef<DrawApi | null>(null);
  const cardRef = useRef(card);
  cardRef.current = card;
  const design = card.design;

  const set = (patch: Partial<CardDesign>) => {
    haptic(6);
    onChange({ ...card, design: { ...design, ...patch } });
  };
  const setText = (patch: Partial<Card>) => onChange({ ...card, ...patch });

  const onCommit = useCallback((drawing: string | null) => {
    const c = cardRef.current;
    onChange({ ...c, design: { ...c.design, drawing } });
  }, [onChange]);
  const drawing = tab === "draw";
  const look = resolveLook(design);

  return (
    <div className={`studio ${compact ? "is-compact" : ""}`}>
      <div className="studio-stage">
        <motion.div className="studio-preview" animate={{ rotateX: drawing ? 0 : 8, y: drawing ? 0 : -2 }} transition={spring}>
          <CardFace card={card} hideDrawing={drawing} showBalance={!compact}>
            {drawing && <DrawCanvas key={card.id} initial={design.drawing} brush={brush} color={ink} size={size} apiRef={api} onCommit={onCommit} onHistory={setHistory} />}
          </CardFace>
        </motion.div>
        <div className="studio-hint">
          <AnimatePresence mode="wait">
            <motion.span key={drawing ? "d" : "n"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              {drawing ? "Draw right on the card" : "Live preview"}
            </motion.span>
          </AnimatePresence>
          {!drawing && (
            <button type="button" className="chip-btn" onClick={() => set(randomDesign(design))}>
              <Dices size={14} strokeWidth={2.6} /> Surprise me
            </button>
          )}
        </div>
      </div>

      <div className="studio-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-active" : ""} onClick={() => setTab(t.id)}>
            {tab === t.id && <motion.span layoutId={`studio-tab-${card.id}`} className="studio-tab-pill" transition={spring} />}
            <t.icon size={16} strokeWidth={2.4} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} className="studio-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
          {tab === "skins" && (
            <div className="skin-grid">
              {SKINS.map((s) => {
                const active = !design.color && design.skinId === s.id;
                return (
                  <button key={s.id} type="button" className={`skin-tile ${active ? "is-active" : ""}`} onClick={() => set({ skinId: s.id, color: null })}>
                    <span className={`skin-swatch ${s.id === "holo" ? "is-holo" : ""}`} style={{ background: s.bg }} />
                    <span className="skin-name">{s.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {tab === "text" && (
            <div className="text-tools">
              <div className="fields">
                <TextField label="Bank or issuer" value={card.issuer} max={18} placeholder="My Bank" onChange={(issuer) => setText({ issuer })} />
                <TextField label="Tagline" value={card.tagline} max={28} placeholder="Optional — e.g. est. 2026" onChange={(tagline) => setText({ tagline })} />
                <TextField label="Card name" value={card.nickname} max={22} placeholder="Leave empty to hide" onChange={(nickname) => setText({ nickname })} />
                <TextField label="Corner label" value={card.label} max={12} placeholder="Leave empty to hide" onChange={(label) => setText({ label })} />
                <TextField label="Name on card" value={card.holder} max={26} placeholder="Shown on the back" onChange={(holder) => setText({ holder })} />
                {/* With real details saved, the last 4 come from the card number itself. */}
                {!card.secret && <TextField label="Last 4 digits" value={card.last4} max={4} numeric onChange={(last4) => setText({ last4 })} />}
              </div>

              <div className="tool-block">
                <div className="tool-label">Logo</div>
                <div className="logo-row">
                  {LOGOS.map((l) => (
                    <button key={l.id} type="button" aria-label={l.label} className={`logo-btn ${card.logo === l.id ? "is-active" : ""}`} onClick={() => setText({ logo: l.id })}>
                      {l.id === "none" ? <Ban size={18} strokeWidth={2.4} /> : <LogoMark id={l.id} size={20} />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="tool-block">
                <div className="tool-label">Font</div>
                <div className="font-row">
                  {FONTS.map((f) => (
                    <button key={f.id} type="button" className={`font-btn ${design.font === f.id ? "is-active" : ""}`} onClick={() => set({ font: f.id })}>
                      <b style={{ fontFamily: f.family, fontWeight: f.id === "serif" ? 400 : 700 }}>Aa</b>
                      <span>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="tool-block">
                <div className="tool-label">Text color</div>
                <div className="ink-row">
                  <button type="button" className={`ink ink-auto ${!design.textColor ? "is-active" : ""}`} aria-label="Automatic" onClick={() => set({ textColor: null })}>
                    A
                  </button>
                  {TEXT_COLORS.map((c) => (
                    <button key={c} type="button" aria-label={`Text ${c}`} className={`ink ${design.textColor === c ? "is-active" : ""}`} style={{ background: c }} onClick={() => set({ textColor: c })} />
                  ))}
                </div>
              </div>

              <div className="toggle-list">
                <div className="toggle-row">
                  <span>Show chip</span>
                  <Toggle label="Show chip" on={design.showChip} onChange={(showChip) => set({ showChip })} />
                </div>
                <div className="toggle-row">
                  <span>Show balance on card</span>
                  <Toggle label="Show balance" on={design.showBalance} onChange={(showBalance) => set({ showBalance })} />
                </div>
              </div>
            </div>
          )}

          {tab === "color" && (
            <div className="swatch-grid">
              {SWATCHES.map((c) => (
                <button key={c} type="button" aria-label={c} className={`swatch ${design.color === c ? "is-active" : ""}`} style={{ background: c }} onClick={() => set({ color: c })} />
              ))}
              <label className="swatch swatch-custom" aria-label="Custom color">
                <input type="color" value={design.color ?? "#8b5cff"} onChange={(e) => onChange({ ...card, design: { ...design, color: e.target.value } })} />
              </label>
            </div>
          )}

          {tab === "pattern" && (
            <div className="pattern-grid">
              {PATTERNS.map((p) => (
                <button key={p.id} type="button" className={`pattern-tile ${design.pattern === p.id ? "is-active" : ""}`} onClick={() => set({ pattern: p.id as Pattern })}>
                  <span className={`pattern-swatch ink-${look.ink}`} style={{ background: look.bg }}>
                    {p.id !== "none" && p.id !== "waves" && <span className={`card-layer card-pattern pattern-${p.id}`} />}
                    {p.id === "waves" && (
                      <svg className="card-layer card-pattern" viewBox="0 0 100 60" preserveAspectRatio="none">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <path key={i} d={`M-5 ${8 + i * 12} C 20 ${0 + i * 12}, 40 ${16 + i * 12}, 60 ${8 + i * 12} S 90 ${0 + i * 12}, 110 ${8 + i * 12}`} fill="none" stroke="currentColor" strokeWidth="1.2" />
                        ))}
                      </svg>
                    )}
                  </span>
                  <span className="skin-name">{p.label}</span>
                </button>
              ))}
            </div>
          )}

          {tab === "draw" && (
            <div className="draw-tools">
              <div className="brush-row">
                {BRUSHES.map((b) => (
                  <button key={b.id} type="button" className={`brush-btn ${brush === b.id ? "is-active" : ""}`} onClick={() => setBrush(b.id)}>
                    <b.icon size={18} strokeWidth={2.4} />
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>
              <div className={`ink-row ${brush === "rainbow" || brush === "eraser" ? "is-disabled" : ""}`}>
                {INK_COLORS.map((c) => (
                  <button key={c} type="button" aria-label={`Ink ${c}`} className={`ink ${ink === c ? "is-active" : ""}`} style={{ background: c }} onClick={() => setInk(c)} />
                ))}
              </div>
              <div className="size-row">
                <span className="size-dot" style={{ width: 6, height: 6 }} />
                <input type="range" min={2} max={26} value={size} onChange={(e) => setSize(Number(e.target.value))} className="range" style={{ "--p": `${((size - 2) / 24) * 100}%` } as CSSProperties} aria-label="Brush size" />
                <span className="size-dot" style={{ width: 18, height: 18 }} />
              </div>
              <div className="draw-actions">
                <button type="button" className="pill-btn" disabled={!history} onClick={() => api.current?.undo()}>
                  <Undo2 size={16} strokeWidth={2.6} /> Undo
                </button>
                <button type="button" className="pill-btn" onClick={() => api.current?.clear()}>
                  <Trash2 size={16} strokeWidth={2.6} /> Clear
                </button>
              </div>
            </div>
          )}

          {tab === "sticker" && (
            <div className="sticker-grid">
              <button type="button" aria-label="No sticker" className={`sticker ${!design.sticker ? "is-active" : ""}`} onClick={() => set({ sticker: null })}>
                <Ban size={22} strokeWidth={2.2} className="dim" />
              </button>
              {STICKERS.map((s) => (
                <motion.button key={s} type="button" aria-label={s} whileTap={{ scale: 0.8, rotate: -12 }} className={`sticker ${design.sticker === s ? "is-active" : ""}`} onClick={() => set({ sticker: s })}>
                  <Sticker id={s} />
                </motion.button>
              ))}
            </div>
          )}

          {tab === "finish" && (
            <div className="finish-list">
              {FINISHES.map((f) => (
                <button key={f.id} type="button" className={`finish-row ${design.finish === f.id ? "is-active" : ""}`} onClick={() => set({ finish: f.id })}>
                  <span className={`finish-swatch finish-${f.id}`} style={{ background: look.bg }}>
                    <span className="card-layer card-finish" />
                  </span>
                  <span className="finish-text">
                    <b>{f.label}</b>
                    <small>{f.hint}</small>
                  </span>
                  <span className="radio" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
