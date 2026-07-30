import { lazy, Suspense } from "react";
import "./browser-release.css";
import { GuidedAdventureScreen } from "./guided/GuidedAdventureScreen";
import { GuidedBattleCoach } from "./guided/GuidedBattleCoach";
import { useGameSnapshot } from "./hooks/useGameSnapshot";
import "./scenario.css";
import { useScenarioController } from "./useScenarioController";

const BattleScreen = lazy(() => import("./screens/BattleScreen").then(module => ({ default: module.BattleScreen })));

export default function App() {
  useScenarioController();
  const snapshot = useGameSnapshot();

  if (snapshot.state.mode !== "battle") {
    return <GuidedAdventureScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen label="正在进入学校夜战…" />}>
      <div className="guided-battle-shell">
        <BattleScreen onOpenReplay={() => undefined} onOpenSettings={() => undefined} />
        <GuidedBattleCoach />
      </div>
    </Suspense>
  );
}

function LoadingScreen(props: { readonly label: string }) {
  return (
    <main className="loading-screen" role="status" aria-live="polite">
      <div className="loading-sigil">GC</div>
      <p>{props.label}</p>
    </main>
  );
}
