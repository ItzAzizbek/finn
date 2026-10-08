import { AnimatePresence, motion } from "motion/react";
import { ChartNoAxesColumn, House, Plus, User, WalletCards } from "lucide-react";
import { Toast, spring } from "./components/ui";
import { haptic } from "./lib";
import { CardDetail } from "./screens/CardDetail";
import { Home } from "./screens/Home";
import { Insights } from "./screens/Insights";
import { Onboarding } from "./screens/Onboarding";
import { PasscodeSheet } from "./components/Passcode";
import { Activity, AddCardSheet, CardDetailsSheet, EditCardSheet, StudioScreen, SubSheet, TxnSheet } from "./screens/Overlays";
import { CardsTab, MeTab } from "./screens/Tabs";
import { useStore, type Overlay, type Tab } from "./store";

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "insights", label: "Insights", icon: ChartNoAxesColumn },
  { id: "cards", label: "Cards", icon: WalletCards },
  { id: "me", label: "Me", icon: User },
];

function TabBar() {
  const { tab, setTab, open } = useStore();
  const item = (t: (typeof TABS)[number]) => (
    <button
      key={t.id}
      type="button"
      className={`tab ${tab === t.id ? "is-active" : ""}`}
      aria-label={t.label}
      aria-current={tab === t.id ? "page" : undefined}
      onClick={() => {
        haptic(5);
        setTab(t.id);
      }}
    >
      {tab === t.id && <motion.span layoutId="tab-pill" className="tab-pill" transition={spring} />}
      <t.icon size={22} strokeWidth={tab === t.id ? 2.7 : 2.2} />
      <span>{t.label}</span>
    </button>
  );
  return (
    <nav className="tabbar">
      {TABS.slice(0, 2).map(item)}
      <motion.button
        type="button"
        className="tab-plus"
        aria-label="Log spend"
        whileTap={{ scale: 0.86, rotate: 90 }}
        onClick={() => {
          haptic(10);
          open({ kind: "add" });
        }}
      >
        <Plus size={28} strokeWidth={3} />
      </motion.button>
      {TABS.slice(2).map(item)}
    </nav>
  );
}

function renderOverlay(o: Overlay, i: number) {
  const key = `${i}-${o.kind}`;
  switch (o.kind) {
    case "card":
      return <CardDetail key={key} id={o.id} />;
    case "studio":
      return <StudioScreen key={key} id={o.id} />;
    case "add":
      return <TxnSheet key={key} cardId={o.cardId} />;
    case "txn":
      return <TxnSheet key={key} txnId={o.id} />;
    case "editCard":
      return <EditCardSheet key={key} id={o.id} />;
    case "sub":
      return <SubSheet key={key} id={o.id} />;
    case "addCard":
      return <AddCardSheet key={key} />;
    case "cardDetails":
      return <CardDetailsSheet key={key} id={o.id} />;
    case "passcode":
      return <PasscodeSheet key={key} mode={o.mode} onDone={o.onDone} />;
    case "activity":
      return <Activity key={key} />;
  }
}

function Main() {
  const { tab, overlays } = useStore();
  return (
    <motion.div className="main" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          className="tab-scroll"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {tab === "home" && <Home />}
          {tab === "insights" && <Insights />}
          {tab === "cards" && <CardsTab />}
          {tab === "me" && <MeTab />}
        </motion.div>
      </AnimatePresence>
      <TabBar />
      <AnimatePresence>{overlays.map(renderOverlay)}</AnimatePresence>
    </motion.div>
  );
}

export default function App() {
  const { state } = useStore();
  return (
    <div className="device">
      <AnimatePresence mode="wait">{state.onboarded ? <Main key="main" /> : <Onboarding key="ob" />}</AnimatePresence>
      <Toast />
    </div>
  );
}
