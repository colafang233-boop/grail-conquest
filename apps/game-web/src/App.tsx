import { BattlePanel } from "./components/BattlePanel";
import { GameCanvas } from "./components/GameCanvas";
import { ScenarioOverlay } from "./ScenarioOverlay";
import { useScenarioController } from "./useScenarioController";
import "./scenario.css";

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
          <div className="prototype-badge">ABILITY SLICE 0.5</div>
        </header>

        <div className="mission-strip">
          <span className="mission-dot" />
          <div>
            <strong>关卡目标</strong>
            <p>观察真实宝具准备窗口，选择投影射击打断、投影盾防御、令咒撤离或战术撤退。</p>
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
