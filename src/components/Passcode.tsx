import { motion, useAnimationControls } from "motion/react";
import { Delete, Lock, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { haptic } from "../lib";
import { useStore } from "../store";
import { createVault, cryptoAvailable, seal, unlockVault, unseal, type Sealed } from "../vault";
import { Sheet } from "./ui";

export const PASSCODE_LENGTH = 6;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

/** Six dots and a keypad. `onComplete` returns false to reject (shake + clear). */
export function PasscodePad({
  title,
  subtitle,
  onComplete,
}: {
  title: string;
  subtitle?: string;
  onComplete: (pin: string) => Promise<boolean> | boolean;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const shake = useAnimationControls();

  useEffect(() => {
    if (pin.length !== PASSCODE_LENGTH) return;
    let alive = true;
    setBusy(true);
    // Let the last dot paint before key derivation blocks for a moment.
    const t = window.setTimeout(async () => {
      const ok = await onComplete(pin);
      if (!alive) return;
      setBusy(false);
      if (ok === false) {
        haptic(40);
        setError(true);
        shake.start({ x: [0, -14, 12, -8, 6, 0], transition: { duration: 0.4 } });
        setPin("");
      }
    }, 60);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const press = (k: string) => {
    if (busy || !k) return;
    haptic(5);
    setError(false);
    setPin((p) => (k === "del" ? p.slice(0, -1) : p.length < PASSCODE_LENGTH ? p + k : p));
  };

  // Whatever field was focused underneath (e.g. the CVV) must not catch the passcode keystrokes.
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, []);

  // Hardware keyboards work too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        press("del");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="passcode">
      <div className="passcode-head">
        <span className="passcode-lock">
          <Lock size={22} strokeWidth={2.4} />
        </span>
        <h2>{title}</h2>
        <p className={error ? "is-error" : ""}>{error ? "That didn't match. Try again." : busy ? "Checking…" : subtitle}</p>
      </div>
      <motion.div className={`passcode-dots ${busy ? "is-busy" : ""}`} animate={shake}>
        {Array.from({ length: PASSCODE_LENGTH }, (_, i) => (
          <motion.span key={i} className={i < pin.length ? "is-filled" : ""} animate={{ scale: i === pin.length - 1 ? [1, 1.3, 1] : 1 }} transition={{ duration: 0.18 }} />
        ))}
      </motion.div>
      <div className="keypad passcode-keys">
        {KEYS.map((k, i) =>
          k ? (
            <motion.button key={k} type="button" whileTap={{ scale: 0.86, backgroundColor: "rgba(255,255,255,.14)" }} onClick={() => press(k)} aria-label={k === "del" ? "Delete" : k}>
              {k === "del" ? <Delete size={24} strokeWidth={2.2} /> : k}
            </motion.button>
          ) : (
            <span key={`blank-${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

export function PasscodeSheet({ mode, onDone }: { mode: "unlock" | "create" | "change"; onDone?: (key: CryptoKey) => void }) {
  const { state, dispatch, close, toast, setVaultKey } = useStore();
  const [step, setStep] = useState<"current" | "new" | "confirm">(mode === "create" ? "new" : "current");
  const [oldKey, setOldKey] = useState<CryptoKey | null>(null);
  const [first, setFirst] = useState("");
  const [confirmErase, setConfirmErase] = useState(false);

  const finish = (key: CryptoKey) => {
    setVaultKey(key);
    close();
    onDone?.(key);
  };

  if (!cryptoAvailable()) {
    return (
      <Sheet onClose={close} title="Secure connection needed">
        <div className="empty">
          <div className="empty-icon">
            <ShieldAlert size={30} strokeWidth={2.2} />
          </div>
          Card details are encrypted with your browser's Web Crypto, which only works over https:// or on localhost.
          <p>
            On a phone, run <code>npm run dev:phone</code> and open the https:// address it prints.
          </p>
        </div>
      </Sheet>
    );
  }

  let pad;
  if (step === "current") {
    pad = (
      <PasscodePad
        key="current"
        title={mode === "change" ? "Current passcode" : "Enter passcode"}
        subtitle="Unlocks your card numbers for 5 minutes"
        onComplete={async (pin) => {
          if (!state.vault) return false;
          const key = await unlockVault(state.vault, pin);
          if (!key) return false;
          if (mode === "unlock") finish(key);
          else {
            setOldKey(key);
            setStep("new");
          }
          return true;
        }}
      />
    );
  } else if (step === "new") {
    pad = (
      <PasscodePad
        key="new"
        title={mode === "change" ? "New passcode" : "Create a passcode"}
        subtitle="6 digits. It locks your full card numbers and security codes."
        onComplete={(pin) => {
          setFirst(pin);
          setStep("confirm");
          return true;
        }}
      />
    );
  } else {
    pad = (
      <PasscodePad
        key="confirm"
        title="Confirm passcode"
        subtitle="Type it once more"
        onComplete={async (pin) => {
          if (pin !== first) {
            setStep("new");
            toast("Passcodes didn't match — try again");
            return false;
          }
          const { vault, key } = await createVault(pin);
          if (mode === "change" && oldKey) {
            // Re-encrypt every saved card under the new key.
            const secrets: Record<string, Sealed> = {};
            for (const c of state.cards) {
              if (c.secret) secrets[c.id] = await seal(key, await unseal(oldKey, c.secret));
            }
            dispatch({ type: "rekey", vault, secrets });
            toast("Passcode changed");
          } else {
            dispatch({ type: "setVault", vault });
          }
          finish(key);
          return true;
        }}
      />
    );
  }

  return (
    <Sheet onClose={close} className="passcode-sheet">
      {pad}
      {mode === "unlock" && (
        <button
          type="button"
          className="danger-link"
          onClick={() => {
            haptic(15);
            if (!confirmErase) return setConfirmErase(true);
            dispatch({ type: "eraseSecrets" });
            toast("Saved card numbers erased");
            close();
          }}
        >
          {confirmErase ? "Tap again — erases every saved card number" : "Forgot passcode?"}
        </button>
      )}
    </Sheet>
  );
}
