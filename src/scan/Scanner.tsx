import { AnimatePresence, motion } from "motion/react";
import { Check, Flashlight, FlashlightOff, ImageUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Worker } from "tesseract.js";
import { haptic } from "../lib";
import { formatNumber } from "../vault";
import { parseCardText, ScanVotes, type CardRead } from "./parse";

// ─── Card scanner ───────────────────────────────────────────────────────
// Camera → crop to the on-screen card frame → clean up the pixels →
// Tesseract (running locally in a web worker) → parse → vote across frames.
// The engine and English model are served from /ocr with the app (see
// scripts/copy-ocr.mjs), so nothing is fetched from anywhere else and no
// image ever leaves the device.

type Phase = "starting" | "scanning" | "found" | "nocamera" | "denied";

const asset = (p: string) => new URL(`ocr/${p}`, document.baseURI).href;

async function makeWorker(onProgress: (p: number) => void): Promise<Worker> {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: asset("worker.min.js"),
    corePath: asset("core"),
    langPath: asset("lang"),
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status.startsWith("loading")) onProgress(m.progress);
    },
  });
  // Sparse text: card text is scattered blocks, not paragraphs.
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: "1" });
  return worker;
}

/** Grayscale + contrast stretch (optionally inverted for light-on-dark cards), upscaled for OCR. */
function prepare(src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, invert: boolean) {
  const w = 1280;
  const h = Math.round((w * sh) / sw);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const lum = new Uint8Array(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const l = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    lum[j] = l;
    hist[lum[j]]++;
  }
  // Stretch between the 2nd and 98th percentiles so glare and shadows don't eat the range.
  const cut = (q: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= q * lum.length) return v;
    return 255;
  };
  const lo = cut(0.02);
  const hi = Math.max(lo + 1, cut(0.98));
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    let v = ((lum[j] - lo) * 255) / (hi - lo);
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    if (invert) v = 255 - v;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function CardScanner({ onResult, onClose }: { onResult: (r: CardRead) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [loading, setLoading] = useState(0);
  const [ready, setReady] = useState(false);
  const [seen, setSeen] = useState<{ number?: string; expiry?: string; holder?: string }>({});
  const [torch, setTorch] = useState<boolean | null>(null); // null = not supported
  const [slow, setSlow] = useState(false);
  const [photoMsg, setPhotoMsg] = useState("");
  const worker = useRef<Promise<Worker> | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const busy = useRef(false); // a photo is being read — pause the live loop
  const done = useRef(onResult);
  done.current = onResult;

  const finish = (r: CardRead) => {
    if (!alive.current) return;
    alive.current = false;
    haptic(30);
    setPhase("found");
    window.setTimeout(() => done.current(r), 650);
  };

  useEffect(() => {
    alive.current = true;
    worker.current = makeWorker(setLoading);
    worker.current.then(() => setReady(true)).catch(() => setPhotoMsg("The scanner couldn't start on this device."));

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setPhase("nocamera");
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (!alive.current) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        const v = videoRef.current!;
        v.srcObject = s;
        await v.play().catch(() => {});
        const track = s.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
        if (caps.torch) setTorch(false);
        setPhase("scanning");
      } catch (e) {
        setPhase((e as DOMException)?.name === "NotAllowedError" ? "denied" : "nocamera");
      }
    })();

    const slowTimer = window.setTimeout(() => setSlow(true), 20_000);
    return () => {
      alive.current = false;
      clearTimeout(slowTimer);
      stream.current?.getTracks().forEach((t) => t.stop());
      worker.current?.then((w) => w.terminate()).catch(() => {});
    };
  }, []);

  // Live loop: read a frame, vote, repeat — one at a time, as fast as the phone manages.
  useEffect(() => {
    if (phase !== "scanning" || !ready) return;
    const votes = new ScanVotes();
    let n = 0;
    let stop = false;
    const tick = async () => {
      if (stop || !alive.current) return;
      const v = videoRef.current;
      const f = frameRef.current;
      if (busy.current || !v || !f || !v.videoWidth) {
        window.setTimeout(tick, 200);
        return;
      }
      // Map the on-screen frame to video pixels (the video is object-fit: cover).
      const vr = v.getBoundingClientRect();
      const fr = f.getBoundingClientRect();
      const scale = Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight);
      const ox = (vr.width - v.videoWidth * scale) / 2;
      const oy = (vr.height - v.videoHeight * scale) / 2;
      const pad = 0.04 * fr.width;
      const sx = Math.max(0, (fr.left - vr.left - pad - ox) / scale);
      const sy = Math.max(0, (fr.top - vr.top - pad - oy) / scale);
      const sw = Math.min(v.videoWidth - sx, (fr.width + pad * 2) / scale);
      const sh = Math.min(v.videoHeight - sy, (fr.height + pad * 2) / scale);
      // Alternate normal and inverted — dark cards often print light text.
      const canvas = prepare(v, sx, sy, sw, sh, n++ % 2 === 1);
      try {
        const w = await worker.current!;
        const { data } = await w.recognize(canvas);
        if (stop || !alive.current) return;
        votes.add(parseCardText(data.text));
        setSeen(votes.seen());
        if (votes.done()) return finish(votes.result());
      } catch {
        /* a bad frame — just try the next one */
      }
      window.setTimeout(tick, 60);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [phase, ready]);

  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track || torch === null) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      setTorch(null);
    }
  };

  const readPhoto = async (file: File) => {
    busy.current = true;
    setPhotoMsg("Reading your photo…");
    try {
      const bmp = await createImageBitmap(file);
      const w = await worker.current!;
      const votes = new ScanVotes();
      for (const invert of [false, true]) {
        const { data } = await w.recognize(prepare(bmp, 0, 0, bmp.width, bmp.height, invert));
        votes.add(parseCardText(data.text));
        if (votes.result(true).number && votes.result(true).expiry) break;
      }
      const r = votes.result(true);
      if (r.number) return finish(r);
      setPhotoMsg("Couldn't find a card number in that photo. Try a sharper, flatter shot.");
    } catch {
      setPhotoMsg("Couldn't open that image.");
    } finally {
      busy.current = false;
    }
  };

  const chip = (label: string, value?: string) => (
    <span className={`scan-chip ${value ? "is-on" : ""}`}>
      {value ? <Check size={13} strokeWidth={3} /> : <span className="scan-dot" />}
      {label}
    </span>
  );

  const message =
    phase === "found"
      ? "Got it"
      : phase === "denied"
        ? "Camera access is off for Finn. Allow it in your browser settings, or use a photo."
        : phase === "nocamera"
          ? "No camera available here. Upload a photo of your card instead."
          : !ready
            ? `Getting the scanner ready${loading > 0 && loading < 1 ? ` · ${Math.round(loading * 100)}%` : "…"}`
            : seen.number
              ? "Holding steady…"
              : slow
                ? "Try more light, lay the card flat, and fill the frame. Raised (embossed) numbers are harder to read."
                : "Fit the front of your card in the frame";

  const root = document.querySelector(".device") ?? document.body;
  return createPortal(
    <motion.div className={`scanner is-${phase}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="dialog" aria-label="Scan your card">
      <video ref={videoRef} className="scanner-video" playsInline muted autoPlay />
      <div className="scanner-frame" ref={frameRef}>
        <i className="tl" />
        <i className="tr" />
        <i className="bl" />
        <i className="br" />
        {phase === "scanning" && ready && <span className="scanner-beam" />}
        <AnimatePresence>
          {seen.number && (
            <motion.span key="num" className="scanner-num" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              {formatNumber(seen.number)}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <header className="scanner-top">
        <button type="button" className="scanner-btn" aria-label="Close scanner" onClick={onClose}>
          <X size={22} strokeWidth={2.6} />
        </button>
        <b>Scan your card</b>
        {torch !== null ? (
          <button type="button" className={`scanner-btn ${torch ? "is-on" : ""}`} aria-label={torch ? "Turn off light" : "Turn on light"} onClick={toggleTorch}>
            {torch ? <FlashlightOff size={20} strokeWidth={2.4} /> : <Flashlight size={20} strokeWidth={2.4} />}
          </button>
        ) : (
          <span className="scanner-btn-spacer" />
        )}
      </header>

      <div className="scanner-bottom">
        <p className="scanner-msg" aria-live="polite">
          {phase === "found" ? message : photoMsg || message}
        </p>
        <div className="scanner-chips">
          {chip("Number", seen.number)}
          {chip("Expiry", seen.expiry)}
          {chip("Name", seen.holder)}
        </div>
        <button type="button" className="scanner-photo" disabled={!ready || phase === "found"} onClick={() => fileRef.current?.click()}>
          <ImageUp size={18} strokeWidth={2.4} /> Use a photo instead
        </button>
        <small className="scanner-note">Read right here on your phone — the picture is never saved or sent anywhere.</small>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) readPhoto(f);
          }}
        />
      </div>
    </motion.div>,
    root,
  );
}
