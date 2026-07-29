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

  return (
    <main className="app-shell">
      <section className="battle-stage">
        <header className="topbar">
          <div>
            <p className="eyebrow">第 {snapshot.state.strategy.day} 夜 · 冬木市学园</p>
            <h1>Grail Conquest</h1>
          </div>
          <div className="prototype-badge">STRATEGY SLICE 0.6</div>
        </header>

        <div className="mission-strip">
          <span className="mission-dot" />
          <div>
            <strong>战斗目标</strong>
            <p>保全凛与Archer，识破宝具并撤退；结果会原样带回冬木战略地图。</p>
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
