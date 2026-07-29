import { getEncounterDefinition } from "@grail/core";
import { BattlePanel } from "./components/BattlePanel";
import { GameCanvas } from "./components/GameCanvas";
import { ScenarioOverlay } from "./ScenarioOverlay";
import { useGameSnapshot } from "./hooks/useGameSnapshot";
import { StrategyScreen } from "./strategy/StrategyScreen";
import { useScenarioController } from "./useScenarioController";
import "./scenario.css";

export default function App() {
  useScenarioController();
  const snapshot = useGameSnapshot();

  if (snapshot.state.mode === "strategy") return <StrategyScreen />;

  const encounter = getEncounterDefinition(
    snapshot.state.strategy.activeEncounterId ?? "school-night",
  );

  return (
    <main className="app-shell">
      <section className="battle-stage">
        <header className="topbar">
          <div>
            <p className="eyebrow">第 {snapshot.state.strategy.day} 夜 · {encounter.title}</p>
            <h1>Grail Conquest</h1>
          </div>
          <div className="prototype-badge">OPERATIONS SLICE 0.7</div>
        </header>

        <div className="mission-strip">
          <span className="mission-dot" />
          <div>
            <strong>{encounter.subtitle}</strong>
            <p>{encounter.objective}</p>
          </div>
        </div>

        <div className="battlefield-wrap">
          <GameCanvas />
          <ScenarioOverlay />
        </div>
      </section>
      <BattlePanel />
    </main>
  );
}
