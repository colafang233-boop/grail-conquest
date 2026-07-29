import { BattlePanel } from "./components/BattlePanel";
import { GameCanvas } from "./components/GameCanvas";
import { ScenarioOverlay } from "./ScenarioOverlay";
import { useScenarioController } from "./useScenarioController";

export default function App() {
  useScenarioController();

  return (
    <main className="app-shell">
      <section className="battle-stage">
        <header className="topbar">
          <div>
            <p className="eyebrow">第 1 夜 · 冬木市学园</p>
            <h1>Grail Conquest</h1>
          </div>
          <div className="prototype-badge">SCENARIO SLICE 0.4</div>
        </header>

        <div className="mission-strip">
          <span className="mission-dot" />
          <div>
            <strong>关卡目标</strong>
            <p>调查敌方真名，在宝具威胁形成后选择撤退保全情报，或继续冒险交战。</p>
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
