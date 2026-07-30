import { StrategyCanvas } from "./StrategyCanvas";
import { StrategyPanel } from "./StrategyPanel";
import "./strategy.css";

export function StrategyScreen() {
  return (
    <main className="strategy-shell">
      <section className="strategy-stage">
        <header className="topbar">
          <div>
            <p className="eyebrow">冬木市 · 第五次圣杯战争</p>
            <h1>Grail Conquest</h1>
          </div>
          <div className="prototype-badge">FACTION SLICE 0.8</div>
        </header>

        <div className="mission-strip">
          <span className="mission-dot" />
          <div>
            <strong>多阵营作战目标</strong>
            <p>在Saber、Lancer与Caster同时暗中行动时，通过停战、共享侦察和敌对关系控制多方接触的结果。</p>
          </div>
        </div>

        <StrategyCanvas />

        <div className="strategy-legend">
          <span><i className="current" />远坂阵营 T</span>
          <span><i className="ally" />Saber阵营 S</span>
          <span><i className="enemy" />Lancer阵营 L</span>
          <span><i className="caster" />Caster阵营 C</span>
          <span><i className="planned" />计划路线</span>
          <span><i className="danger" />多方遭遇</span>
          <span><i className="unknown" />战争迷雾</span>
        </div>
      </section>
      <StrategyPanel />
    </main>
  );
}
