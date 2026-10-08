import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { CardFace } from "../components/Card";
import { CardForm, draftIsValid, draftSecrets, draftToCard, EMPTY_DRAFT, type CardDraft } from "../components/CardForm";
import { Icon } from "../components/icons";
import { PasscodePad } from "../components/Passcode";
import { StudioEditor } from "../components/Studio";
import { Button, Confetti, CurrencyPicker, spring } from "../components/ui";
import { defaultDesign, GOALS, type Card } from "../data";
import { convert, CURRENCIES, formatCompact, formatMoney0, roundToStep, type Currency } from "../currency";
import { haptic } from "../lib";
import { useStore } from "../store";
import { createVault, cryptoAvailable, seal, type Vault } from "../vault";

type Step = "welcome" | "name" | "goals" | "card" | "passcode" | "design" | "budget" | "done";
const ORDER: Step[] = ["welcome", "name", "goals", "card", "passcode", "design", "budget", "done"];
const PROGRESS: Step[] = ["name", "goals", "card", "passcode", "design", "budget"];

// Eye-candy cards for the welcome screen.
const showcase = (id: string, issuer: string, logo: Card["logo"], nickname: string, last4: string, design: Partial<Card["design"]>): Card => ({
  id,
  issuer,
  logo,
  nickname,
  label: "",
  tagline: "",
  type: "debit",
  last4,
  currency: "USD",
  holder: "",
  expiry: "",
  brand: "card",
  secret: null,
  balance: 0,
  frozen: false,
  design: { ...defaultDesign(), ...design },
});

const SHOWCASE: Card[] = [
  showcase("s1", "nova", "spark", "Main Character", "4821", { skinId: "ultraviolet", sticker: "butterfly" }),
  showcase("s2", "orbit", "orbit", "Treat Yourself", "0937", { skinId: "acid", pattern: "grid" }),
  showcase("s3", "atlas", "peak", "Travel", "5560", { skinId: "holo", sticker: "sparkle", finish: "holo", font: "wide" }),
];

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0, filter: "blur(6px)" }),
  center: { x: 0, opacity: 1, filter: "blur(0px)" },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0, filter: "blur(6px)" }),
};

/** Thresholds are in US dollars; any budget is compared by its dollar value. */
function eraFor(budget: number) {
  if (budget < 1200) return { title: "Saving era", icon: "save", copy: "Lean and mean. Future you is already grateful." };
  if (budget < 2800) return { title: "Balanced era", icon: "chill", copy: "Room for brunch and the savings account." };
  if (budget < 5000) return { title: "Soft life era", icon: "invest", copy: "Living well, still keeping receipts." };
  return { title: "Main character era", icon: "credit", copy: "Big budget energy. We'll keep you honest." };
}

export function Onboarding() {
  const { dispatch, state, setVaultKey, toast } = useStore();
  const [step, setStep] = useState<Step>("welcome");
  const [dir, setDir] = useState(1);
  const [name, setName] = useState(state.name);
  const [goals, setGoals] = useState<string[]>(state.goals);
  const [draft, setDraft] = useState<CardDraft>(EMPTY_DRAFT);
  const [card, setCard] = useState<Card | null>(null);
  const [budget, setBudget] = useState(state.budget);
  const [budgetCur, setBudgetCur] = useState<Currency>(state.currency);
  const [budgetTouched, setBudgetTouched] = useState(false);
  const scale = CURRENCIES[budgetCur].scale;
  const [vault, setVault] = useState<{ vault: Vault; key: CryptoKey } | null>(null);
  const [firstPin, setFirstPin] = useState<string | null>(null);

  const go = (to: Step) => {
    haptic();
    setDir(ORDER.indexOf(to) > ORDER.indexOf(step) ? 1 : -1);
    setStep(to);
  };
  const next = () => go(ORDER[ORDER.indexOf(step) + 1]);
  const back = () => {
    if (step === "passcode" && firstPin) return setFirstPin(null);
    // Once the passcode exists, going back from design skips straight to the card form.
    go(step === "design" && vault ? "card" : ORDER[ORDER.indexOf(step) - 1]);
  };

  /** Encrypts the number + CVV and builds the card, keeping any design work from a previous pass. */
  const sealCard = async (key: CryptoKey) => {
    const secret = await seal(key, draftSecrets(draft));
    const fresh = draftToCard(draft, 0, secret);
    // Until they've touched the budget, suggest one in the card's own currency.
    if (!budgetTouched) {
      setBudgetCur(draft.currency);
      setBudget(CURRENCIES[draft.currency].scale.defaultBudget);
    }
    setCard(card ? { ...fresh, id: card.id, design: card.design, logo: card.logo, tagline: card.tagline } : fresh);
  };

  const addCard = async () => {
    if (vault) {
      await sealCard(vault.key);
      go("design");
    } else next();
  };

  const onPasscode = async (pin: string) => {
    if (!firstPin) {
      setFirstPin(pin);
      return true;
    }
    if (pin !== firstPin) {
      setFirstPin(null);
      toast("Passcodes didn't match — try again");
      return false;
    }
    const created = await createVault(pin);
    setVault(created);
    await sealCard(created.key);
    setFirstPin(null);
    next();
    return true;
  };

  const finish = () => {
    if (!card || !vault) return;
    dispatch({ type: "onboard", name: name.trim(), goals, budget, currency: budgetCur, cards: [card], vault: vault.vault });
    setVaultKey(vault.key);
  };

  const firstName = name.trim().split(" ")[0];
  const era = useMemo(() => eraFor(convert(budget, budgetCur, "USD", state.rates)), [budget, budgetCur, state.rates]);
  const pickBudget = (v: number) => {
    setBudgetTouched(true);
    setBudget(v);
  };
  const progressIndex = PROGRESS.indexOf(step);

  let cta: { label: string; disabled?: boolean; onClick: () => void } | null = null;
  switch (step) {
    case "name":
      cta = { label: "Continue", disabled: !name.trim(), onClick: next };
      break;
    case "goals":
      cta = { label: goals.length ? "Continue" : "Skip for now", onClick: next };
      break;
    case "card":
      cta = { label: draftIsValid(draft) ? "Continue" : "Fill in the details", disabled: !draftIsValid(draft), onClick: addCard };
      break;
    case "design":
      cta = { label: "Looks fire, next", onClick: next };
      break;
    case "budget":
      cta = { label: "Lock it in", onClick: next };
      break;
  }

  return (
    <div className="onboarding">
      <div className="ob-glow" />
      {step !== "welcome" && step !== "done" && (
        <header className="ob-header">
          <button type="button" className="icon-btn" aria-label="Back" onClick={back}>
            <ChevronLeft size={22} strokeWidth={2.6} />
          </button>
          <div className="ob-progress">
            {PROGRESS.map((s, i) => (
              <span key={s} className="ob-progress-seg">
                <motion.span initial={false} animate={{ scaleX: i <= progressIndex ? 1 : 0 }} transition={spring} />
              </span>
            ))}
          </div>
        </header>
      )}

      <div className="ob-body">
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.div key={step} className={`ob-step ob-${step}`} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ ...spring, opacity: { duration: 0.2 } }}>
            {step === "welcome" && (
              <>
                <div className="showcase">
                  {SHOWCASE.map((c, i) => (
                    <motion.div
                      key={c.id}
                      className={`showcase-card s${i}`}
                      initial={{ opacity: 0, y: 80, rotate: 0 }}
                      animate={{ opacity: 1, y: [0, -10, 0], rotate: [-14, 6, -4][i] }}
                      transition={{ opacity: { delay: 0.15 * i }, rotate: { ...spring, delay: 0.15 * i }, y: { repeat: Infinity, duration: 4 + i, ease: "easeInOut", delay: i * 0.4 } }}
                    >
                      <CardFace card={c} showBalance={false} />
                    </motion.div>
                  ))}
                </div>
                <div className="welcome-copy">
                  <motion.div className="logo" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    finn<span>.</span>
                  </motion.div>
                  <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.4 }}>
                    Money,
                    <br />
                    but make it <mark>fun.</mark>
                  </motion.h1>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                    Every card in one wallet. Designed by you. No spreadsheets, ever.
                  </motion.p>
                </div>
              </>
            )}

            {step === "name" && (
              <>
                <h1 className="ob-title">
                  First things first —<br />
                  <span className="dim">what do we call you?</span>
                </h1>
                <input
                  className="name-input"
                  autoFocus
                  placeholder="Your name"
                  value={name}
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && name.trim() && next()}
                  autoComplete="given-name"
                  enterKeyHint="next"
                />
                <AnimatePresence>
                  {name.trim() && (
                    <motion.p className="name-reply" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      Love that for you, {firstName}.
                    </motion.p>
                  )}
                </AnimatePresence>
              </>
            )}

            {step === "goals" && (
              <>
                <h1 className="ob-title">
                  What are we
                  <br />
                  working toward<span className="dim">, {firstName}?</span>
                </h1>
                <p className="ob-sub">Pick as many as you like. We'll tune your insights around them.</p>
                <div className="goal-grid">
                  {GOALS.map((g, i) => {
                    const on = goals.includes(g.id);
                    return (
                      <motion.button
                        key={g.id}
                        type="button"
                        className={`goal ${on ? "is-on" : ""}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ ...spring, delay: 0.03 * i }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => {
                          haptic();
                          setGoals((gs) => (on ? gs.filter((x) => x !== g.id) : [...gs, g.id]));
                        }}
                      >
                        <span className="goal-icon">
                          <Icon name={g.id} size={20} />
                        </span>
                        {g.label}
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}

            {step === "card" && (
              <>
                <h1 className="ob-title">
                  Add your
                  <br />
                  <span className="dim">first card.</span>
                </h1>
                <CardForm draft={draft} onChange={setDraft} />
              </>
            )}

            {step === "passcode" &&
              (cryptoAvailable() ? (
                <PasscodePad
                  key={firstPin ? "confirm" : "create"}
                  title={firstPin ? "Confirm your passcode" : "Lock your card details"}
                  subtitle={firstPin ? "Type it once more" : "Pick a 6-digit passcode. Your card number and CVV are encrypted with it — Finn can't recover it for you."}
                  onComplete={onPasscode}
                />
              ) : (
                <div className="empty">
                  Card details are encrypted with your browser's Web Crypto, which only runs over https:// or on localhost.
                  <p>
                    On a phone, start Finn with <code>npm run dev:phone</code> and open the https:// address.
                  </p>
                </div>
              ))}

            {step === "design" && card && (
              <>
                <h1 className="ob-title">
                  Make it <mark>yours.</mark>
                </h1>
                <p className="ob-sub">Skins, stickers, your own drawings — and every word on it is yours to change.</p>
                <StudioEditor card={card} onChange={setCard} compact />
              </>
            )}

            {step === "budget" && (
              <>
                <h1 className="ob-title">
                  Set your
                  <br />
                  <span className="dim">monthly budget.</span>
                </h1>
                <div className="budget-hero">
                  <motion.div key={era.title} className="era" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <Icon name={era.icon} size={16} />
                    {era.title}
                  </motion.div>
                  <div className={`budget-num ${budgetCur === "UZS" ? "is-long" : ""}`}>{formatMoney0(budget, budgetCur)}</div>
                  <p className="ob-sub center">{era.copy}</p>
                </div>
                <input
                  type="range"
                  className="range range-xl"
                  min={scale.budgetMin}
                  max={scale.budgetMax}
                  step={scale.budgetStep}
                  value={budget}
                  aria-label="Monthly budget"
                  style={{ "--p": `${((budget - scale.budgetMin) / (scale.budgetMax - scale.budgetMin)) * 100}%` } as CSSProperties}
                  onChange={(e) => pickBudget(Number(e.target.value))}
                />
                <div className="quick-chips">
                  {scale.budgetPresets.map((v) => (
                    <button key={v} type="button" className={`chip-btn ${budget === v ? "is-active" : ""}`} onClick={() => pickBudget(v)}>
                      {formatCompact(v, budgetCur)}
                    </button>
                  ))}
                </div>
                <div className="budget-currency">
                  <span className="dim">Track totals in</span>
                  <CurrencyPicker
                    id="ob-currency"
                    value={budgetCur}
                    onChange={(c) => {
                      // Same money, new currency — rounded to that currency's slider step.
                      setBudget(roundToStep(convert(budget, budgetCur, c, state.rates), c));
                      setBudgetCur(c);
                      setBudgetTouched(true);
                    }}
                  />
                </div>
              </>
            )}

            {step === "done" && card && (
              <div className="done">
                <Confetti />
                <motion.div className="done-card" initial={{ y: 120, rotate: -30, scale: 0.6, opacity: 0 }} animate={{ y: 0, rotate: -6, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 14, delay: 0.1 }}>
                  <CardFace card={card} />
                </motion.div>
                <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.4 }}>
                  You're in,
                  <br />
                  <mark>{firstName}.</mark>
                </motion.h1>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                  Card added. {formatCompact(budget, budgetCur)}/mo budget. Let's get it.
                </motion.p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="ob-footer">
        {step === "welcome" && (
          <>
            <Button onClick={next}>
              Get started <ArrowRight size={20} strokeWidth={2.8} />
            </Button>
            <p className="fine">By continuing you agree to be financially iconic.</p>
          </>
        )}
        {cta && (
          <Button onClick={cta.onClick} disabled={cta.disabled}>
            {cta.label}
          </Button>
        )}
        {step === "done" && (
          <Button onClick={finish}>
            Open my wallet <ArrowRight size={20} strokeWidth={2.8} />
          </Button>
        )}
      </footer>
    </div>
  );
}
