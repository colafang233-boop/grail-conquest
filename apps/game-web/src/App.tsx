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
          <div className="prototype-badge">VERTICAL SLICE 0.1</div>
        </header>

        <div className="mission-strip">
          <span className="mission-dot" />
          <div>
            <strong>教学目标</strong>
            <p>选择蓝色边框范围移动，并用“结束行动”切换单位。</p>
          </div>
        </div>

        <GameCanvas />
      </section>
      <BattlePanel />
    </main>
  );
}
