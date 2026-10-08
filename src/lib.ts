import { useLayoutEffect, useRef, useState } from "react";
import type { Txn } from "./data";

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function dayLabel(iso: string) {
  const d = startOfDay(new Date(iso));
  const today = startOfDay(new Date());
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Maps a transaction to its amount in the display currency. */
export type ToDisplay = (t: Txn) => number;

export function groupByDay(txns: Txn[], value: ToDisplay) {
  const groups: { label: string; items: Txn[]; total: number }[] = [];
  for (const t of txns) {
    const label = dayLabel(t.date);
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) groups.push((g = { label, items: [], total: 0 }));
    g.items.push(t);
    if (t.amount < 0) g.total -= value(t);
  }
  return groups;
}

export function isThisMonth(iso: string, ref = new Date()) {
  const d = new Date(iso);
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
}

export function spentInMonth(txns: Txn[], value: ToDisplay, ref = new Date()) {
  return txns.reduce((s, t) => (t.amount < 0 && isThisMonth(t.date, ref) ? s - value(t) : s), 0);
}

export function daysLeftInMonth(ref = new Date()) {
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  return end - ref.getDate() + 1;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

export function initials(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "F";
}

export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

/** Perceived brightness of a hex color, 0–1. */
export function luminance(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
