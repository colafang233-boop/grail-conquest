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
          <div className="prototype-badge">OPERATIONS SLICE 0.7</div>
        </header>

        <div className="mission-strip">
          <span className="mission-dot" />
          <div>
            <strong>夜间作战目标</strong>
            <p>在不知道敌方命令的情况下锁定计划，随后同步移动并依据暴露度、情报与伏击状态判定遭遇。</p>
          </div>
        </div>

        <StrategyCanvas />

        <div className="strategy-legend">
          <span><i className="current" />当前位置</span>
          <span><i className="planned" />计划路线</span>
          <span><i className="enemy" />已知敌踪</span>
          <span><i className="leyline" />已控制灵脉</span>
          <span><i className="danger" />遭遇已生成</span>
          <span><i className="unknown" />战争迷雾</span>
        </div>
      </section>
      <StrategyPanel />
    </main>
  );
}
