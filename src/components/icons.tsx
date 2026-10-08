import type { ReactNode } from "react";
import type { CategoryId, LogoId, StickerId } from "../data";

// ─── Finn icon set ──────────────────────────────────────────────────────
// Duotone, rounded, 24px grid: a soft filled body plus a crisp outline.

function Ico({ size = 22, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const tint = { fill: "currentColor", fillOpacity: 0.22 } as const;

const PATHS: Record<string, ReactNode> = {
  // categories
  food: (
    <>
      <path d="M3 11.5h18a9 9 0 0 1-18 0Z" {...tint} />
      <path d="M15 3.5 11 9.5M19.5 4.5l-5 5" />
      <path d="M7 7.5c0-1 .8-1.4.8-2.4M10 7.5c0-1 .8-1.4.8-2.4" opacity=".6" />
    </>
  ),
  groceries: (
    <>
      <path d="M3.5 9.5h17l-1.7 9a2 2 0 0 1-2 1.6H7.2a2 2 0 0 1-2-1.6l-1.7-9Z" {...tint} />
      <path d="m8 9.5 3-5.5M16 9.5l-3-5.5M9 13.5v3M15 13.5v3M12 13.5v3" />
    </>
  ),
  transport: (
    <>
      <path d="M3 15.5V12l2-4.2A2.2 2.2 0 0 1 7 6.5h10a2.2 2.2 0 0 1 2 1.3l2 4.2v3.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" {...tint} />
      <path d="M3.5 12h17" />
      <circle cx="7.5" cy="16.5" r="2" fill="var(--bg, #000)" />
      <circle cx="16.5" cy="16.5" r="2" fill="var(--bg, #000)" />
    </>
  ),
  shopping: (
    <>
      <path d="M4.5 8h15l-1.1 11.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8L4.5 8Z" {...tint} />
      <path d="M8.5 11V6.5a3.5 3.5 0 0 1 7 0V11" />
    </>
  ),
  fun: (
    <>
      <circle cx="6.5" cy="17.5" r="3" {...tint} />
      <circle cx="17.5" cy="15.5" r="3" {...tint} />
      <path d="M9.5 17.5V5.5l11-2.5v12.5M9.5 9l11-2.5" />
    </>
  ),
  subs: (
    <>
      <circle cx="12" cy="12" r="8" {...tint} stroke="none" />
      <path d="M4.5 10.5A7.8 7.8 0 0 1 18 6.8L19.5 8.5M19.5 4v4.5H15M19.5 13.5A7.8 7.8 0 0 1 6 17.2L4.5 15.5M4.5 20v-4.5H9" />
    </>
  ),
  health: (
    <>
      <path d="M12 20.5S3 15.3 3 9a4.8 4.8 0 0 1 9-2.3A4.8 4.8 0 0 1 21 9c0 6.3-9 11.5-9 11.5Z" {...tint} />
      <path d="M6.5 11.5h3l1.5-2.5 2 5 1.5-2.5h3" />
    </>
  ),
  income: (
    <>
      <circle cx="12" cy="12" r="9" {...tint} />
      <path d="M12 7v9M8.5 12.5 12 16l3.5-3.5" />
    </>
  ),
  // goals
  save: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.6" {...tint} />
      <path d="M5 6v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 10v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4M5 14v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4" />
    </>
  ),
  overspend: (
    <>
      <path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3Z" {...tint} />
      <path d="M8 12h8" />
    </>
  ),
  credit: (
    <>
      <path d="M3 19 9 13l4 3.5L21 7v12Z" {...tint} stroke="none" />
      <path d="m3 17 6-6 4 3.5L21 6M15.5 6H21v5.5" />
    </>
  ),
  travel: (
    <>
      <path d="M21.5 2.5 2.5 10l7.5 3 3 7.5Z" {...tint} />
      <path d="m10 13 5-5" />
    </>
  ),
  debt: (
    <>
      <path d="M9.5 14.5 8 16a3.5 3.5 0 0 1-5-5l1.5-1.5M14.5 9.5 16 8a3.5 3.5 0 0 1 5 5l-1.5 1.5" />
      <path d="M8.5 3.5 9.5 6M3.5 8.5 6 9.5M15.5 20.5l-1-2.5M20.5 15.5l-2.5-1" opacity=".7" />
    </>
  ),
  invest: (
    <>
      <path d="M12 12C12 7.5 9 4.5 4 4.5c0 4.5 3 7.5 8 7.5ZM12 14.5c0-3.5 2.6-6.5 7.5-6.5 0 3.8-2.8 6.5-7.5 6.5Z" {...tint} />
      <path d="M12 21v-9" />
    </>
  ),
  chill: (
    <>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" {...tint} />
      <path d="M16 3.5v3M14.5 5h3" opacity=".7" />
    </>
  ),
  // misc
  receipt: (
    <>
      <path d="M5 3h14v18l-2.3-1.5L14.3 21 12 19.5 9.7 21l-2.4-1.5L5 21Z" {...tint} />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  snow: (
    <path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2M4 10.6l3-.6-1-3M20 13.4l-3 .6 1 3M4 13.4l3 .6-1 3M20 10.6l-3-.6 1-3" />
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" {...tint} />
      <path d="M14.8 9.2c-.5-.9-1.6-1.5-2.8-1.5-1.6 0-2.8.9-2.8 2.1 0 2.8 5.6 1.6 5.6 4.4 0 1.2-1.2 2.1-2.8 2.1-1.2 0-2.3-.6-2.8-1.5M12 6v1.7M12 16.3V18" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size }: { name: string; size?: number }) {
  return <Ico size={size}>{PATHS[name] ?? PATHS.receipt}</Ico>;
}

export function CategoryIcon({ id, size }: { id: CategoryId; size?: number }) {
  return <Icon name={id} size={size} />;
}

// ─── Issuer logo marks (for the card face) ──────────────────────────────

export const LOGOS: { id: LogoId; label: string }[] = [
  { id: "spark", label: "Spark" },
  { id: "orbit", label: "Orbit" },
  { id: "sun", label: "Sun" },
  { id: "pulse", label: "Pulse" },
  { id: "peak", label: "Peak" },
  { id: "kite", label: "Kite" },
  { id: "dot", label: "Dot" },
  { id: "none", label: "None" },
];

export function LogoMark({ id, size = 16 }: { id: LogoId; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (id) {
    case "spark":
      return <svg {...p}><path d="M12 2c.8 5.6 4.4 9.2 10 10-5.6.8-9.2 4.4-10 10-.8-5.6-4.4-9.2-10-10 5.6-.8 9.2-4.4 10-10Z" fill="currentColor" stroke="none" /></svg>;
    case "orbit":
      return <svg {...p}><circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" /><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-25 12 12)" /></svg>;
    case "sun":
      return <svg {...p}><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></svg>;
    case "pulse":
      return <svg {...p}><path d="M2 12h4l3-7 4 14 3-7h6" /></svg>;
    case "peak":
      return <svg {...p}><path d="M12 3 22 20H2L12 3Z" fill="currentColor" stroke="none" /></svg>;
    case "kite":
      return <svg {...p}><path d="M12 2 19 10 12 22 5 10 12 2Z" fill="currentColor" stroke="none" /></svg>;
    case "dot":
      return <svg {...p}><circle cx="12" cy="12" r="8" fill="currentColor" stroke="none" /></svg>;
    case "none":
      return null;
  }
}

// ─── Stickers ───────────────────────────────────────────────────────────
// Die-cut look: every shape gets a thick white outline painted under its fill.

const cut = { stroke: "#fff", strokeWidth: 7, paintOrder: "stroke", strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const ink = { stroke: "#1a1022", strokeWidth: 4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

function starPoints(cx: number, cy: number, spikes: number, outer: number, inner: number, rot = -Math.PI / 2) {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / spikes;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(" ");
}

const STICKER_ART: Record<StickerId, ReactNode> = {
  star: <polygon points={starPoints(50, 53, 5, 42, 19)} fill="#ffd60a" {...cut} />,
  sparkle: (
    <>
      <path d="M50 6c4 26 18 40 44 44-26 4-40 18-44 44-4-26-18-40-44-44 26-4 40-18 44-44Z" fill="#c8ff2e" {...cut} />
      <path d="M82 10c1.5 7 4 9.5 11 11-7 1.5-9.5 4-11 11-1.5-7-4-9.5-11-11 7-1.5 9.5-4 11-11Z" fill="#fff" />
    </>
  ),
  bolt: <path d="M58 4 18 56h28l-8 40 44-56H52Z" fill="#ffd60a" {...cut} />,
  heart: (
    <>
      <path d="M50 88S8 64 8 34a21 21 0 0 1 42-8 21 21 0 0 1 42 8c0 30-42 54-42 54Z" fill="#ff4fa3" {...cut} />
      <path d="M24 30a9 9 0 0 1 9-8" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".7" />
    </>
  ),
  flame: (
    <>
      <path d="M50 4c6 18 30 28 30 56a30 30 0 0 1-60 0c0-14 8-22 14-28 0 10 4 16 10 18-2-18 2-32 6-46Z" fill="#ff6a1a" {...cut} />
      <path d="M50 52c4 8 14 12 14 24a14 14 0 0 1-28 0c0-8 6-12 8-18 2 4 4 6 6 6 0-4-1-8 0-12Z" fill="#ffd60a" />
    </>
  ),
  smiley: (
    <>
      <circle cx="50" cy="50" r="42" fill="#ffd60a" {...cut} />
      <path d="M38 34v12M62 34v12" {...ink} strokeWidth={7} />
      <path d="M30 58c6 14 34 14 40 0" {...ink} strokeWidth={6} />
    </>
  ),
  flower: (
    <>
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <ellipse key={r} cx="50" cy="26" rx="15" ry="22" fill="#ff8cc6" transform={`rotate(${r} 50 50)`} {...cut} />
      ))}
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <ellipse key={`f${r}`} cx="50" cy="26" rx="15" ry="22" fill="#ff8cc6" transform={`rotate(${r} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="14" fill="#ffd60a" />
    </>
  ),
  moon: (
    <>
      <path d="M78 66A38 38 0 0 1 34 12a40 40 0 1 0 44 54Z" fill="#b8a6ff" {...cut} />
      <circle cx="40" cy="58" r="5" fill="#9580f0" />
      <circle cx="56" cy="74" r="3.5" fill="#9580f0" />
    </>
  ),
  cherry: (
    <>
      <path d="M32 62C36 40 44 22 66 10M68 66C66 44 64 26 66 10" stroke="#fff" strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d="M32 62C36 40 44 22 66 10M68 66C66 44 64 26 66 10" stroke="#3a9a3a" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M66 10c8-4 18-2 22 6-8 4-18 2-22-6Z" fill="#5fd35f" {...cut} />
      <circle cx="30" cy="70" r="20" fill="#ff2e4d" {...cut} />
      <circle cx="70" cy="72" r="20" fill="#ff2e4d" {...cut} />
      <circle cx="24" cy="64" r="5" fill="#fff" opacity=".6" />
      <circle cx="64" cy="66" r="5" fill="#fff" opacity=".6" />
    </>
  ),
  crown: (
    <>
      <path d="M10 30 30 50 50 18 70 50 90 30 82 82H18Z" fill="#ffc83d" {...cut} />
      <circle cx="50" cy="62" r="7" fill="#ff4fa3" />
      <circle cx="30" cy="66" r="5" fill="#2ee6ff" />
      <circle cx="70" cy="66" r="5" fill="#2ee6ff" />
    </>
  ),
  planet: (
    <>
      <circle cx="50" cy="50" r="30" fill="#8b5cff" {...cut} />
      <ellipse cx="50" cy="52" rx="46" ry="13" transform="rotate(-18 50 52)" fill="none" stroke="#fff" strokeWidth="13" />
      <ellipse cx="50" cy="52" rx="46" ry="13" transform="rotate(-18 50 52)" fill="none" stroke="#2ee6ff" strokeWidth="6" />
      <path d="M22 44a30 30 0 0 1 56 0" fill="#8b5cff" />
      <circle cx="40" cy="38" r="5" fill="#a98bff" />
    </>
  ),
  rainbow: (
    <>
      <path d="M8 76a42 42 0 0 1 84 0" fill="none" stroke="#fff" strokeWidth="40" strokeLinecap="round" />
      <path d="M14 76a36 36 0 0 1 72 0" fill="none" stroke="#ff4f6a" strokeWidth="9" />
      <path d="M23 76a27 27 0 0 1 54 0" fill="none" stroke="#ffd60a" strokeWidth="9" />
      <path d="M32 76a18 18 0 0 1 36 0" fill="none" stroke="#4ade80" strokeWidth="9" />
      <path d="M41 76a9 9 0 0 1 18 0" fill="none" stroke="#2ee6ff" strokeWidth="9" />
    </>
  ),
  butterfly: (
    <>
      <path d="M50 46C40 18 12 10 10 30c-1 12 14 18 40 16ZM50 46c10-28 38-36 40-16 1 12-14 18-40 16Z" fill="#ff4fa3" {...cut} />
      <path d="M50 50C34 52 18 62 24 78c6 12 22 2 26-28ZM50 50c16 2 32 12 26 28-6 12-22 2-26-28Z" fill="#8b5cff" {...cut} />
      <path d="M50 30v52" stroke="#1a1022" strokeWidth="6" strokeLinecap="round" />
      <circle cx="28" cy="30" r="5" fill="#fff" opacity=".7" />
      <circle cx="72" cy="30" r="5" fill="#fff" opacity=".7" />
    </>
  ),
  ghost: (
    <>
      <path d="M18 88V44a32 32 0 0 1 64 0v44l-10.7-8-10.6 8L50 80l-10.7 8-10.6-8Z" fill="#efe9ff" stroke="#1a1022" strokeWidth="3" {...{ paintOrder: "stroke" }} />
      <ellipse cx="38" cy="44" rx="5" ry="8" fill="#1a1022" />
      <ellipse cx="62" cy="44" rx="5" ry="8" fill="#1a1022" />
      <ellipse cx="50" cy="62" rx="6" ry="4" fill="#ff8cc6" />
    </>
  ),
  eye: (
    <>
      <path d="M4 50C18 24 34 16 50 16s32 8 46 34C82 76 66 84 50 84S18 76 4 50Z" fill="#fff" stroke="#1a1022" strokeWidth="4" />
      <circle cx="50" cy="50" r="20" fill="#2ee6ff" />
      <circle cx="50" cy="50" r="10" fill="#1a1022" />
      <circle cx="56" cy="44" r="4" fill="#fff" />
    </>
  ),
};

export const STICKERS = Object.keys(STICKER_ART) as StickerId[];

export function Sticker({ id, className }: { id: StickerId; className?: string }) {
  return (
    <svg className={className} viewBox="-6 -6 112 112" aria-hidden>
      {STICKER_ART[id]}
    </svg>
  );
}
