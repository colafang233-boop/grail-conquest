import { BattlePanel } from "./components/BattlePanel";
import { GameCanvas } from "./components/GameCanvas";

export default function App() {
  return (
    <main className="app-shell">
      <section className="battle-stage">
        <header className="topbar">
          <div>
            <p className="eyebrow">第 1 夜 · 冬木市学园</p>
            <h1>Grail Conquest</h1>
          </div>
          <div className="prototype-badge">COMBAT SLICE 0.2</div>
        </header>

        <div className="mission-strip">
          <span className="mission-dot" />
          <div>
            <strong>教学目标</strong>
            <p>移动后切换攻击模式，点击红色高亮敌人；近战目标会自动反击。</p>
          </div>
        </div>

        <GameCanvas />
      </section>
      <BattlePanel />
    </main>
  );
}
