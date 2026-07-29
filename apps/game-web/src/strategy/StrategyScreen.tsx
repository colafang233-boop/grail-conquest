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
          <div className="prototype-badge">STRATEGY SLICE 0.6</div>
        </header>

        <div className="mission-strip">
          <span className="mission-dot" />
          <div>
            <strong>战略目标</strong>
            <p>移动到学校并调查异常，在夜战中获取真名线索，再带着真实损耗返回冬木地图。</p>
          </div>
        </div>

        <StrategyCanvas />

        <div className="strategy-legend">
          <span><i className="current" />当前位置</span>
          <span><i className="leyline" />已控制灵脉</span>
          <span><i className="unknown" />战争迷雾</span>
          <span><i className="danger" />遭遇已发现</span>
        </div>
      </section>
      <StrategyPanel />
    </main>
  );
}
