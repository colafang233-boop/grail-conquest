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
          <div className="prototype-badge">CONTRACT SLICE 0.3</div>
        </header>

        <div className="mission-strip">
          <span className="mission-dot" />
          <div>
            <strong>教学目标</strong>
            <p>保持 Master 与 Servant 的契约距离，利用护卫、供魔和三划令咒改变战局。</p>
          </div>
        </div>

        <GameCanvas />
      </section>
      <BattlePanel />
    </main>
  );
}
