import { findLegalAttackTargets } from "@grail/core";
import { gameEngine } from "../game-engine";
import { interactionStore } from "../interaction-store";
import { useGameSnapshot } from "../hooks/useGameSnapshot";
import { useInteractionMode } from "../hooks/useInteractionMode";

export function BattlePanel() {
  const snapshot = useGameSnapshot();
  const mode = useInteractionMode();
  const battle = snapshot.state.battle;
  const activeUnit = battle.units[battle.activeUnitId];

  if (!activeUnit) return <aside className="battle-panel">当前行动单位不存在。</aside>;

  const attackTargets = findLegalAttackTargets(battle, activeUnit.id);
  const endTurn = () => {
    interactionStore.setMode("move");
    gameEngine.dispatch({
      type: "battle.end_turn",
      battleId: battle.id,
      unitId: activeUnit.id,
    });
  };

  const recentEvents = snapshot.eventLog.slice(-8).reverse();

  return (
    <aside className="battle-panel">
      <div className="panel-heading">
        <p className="eyebrow">SCHOOL NIGHT · COMBAT SLICE</p>
        <h2>战术终端</h2>
      </div>

      <div className="status-grid">
        <article className="metric"><span>回合</span><strong>{battle.round}</strong></article>
        <article className="metric"><span>事件序列</span><strong>{snapshot.state.sequence}</strong></article>
      </div>

      <section className="unit-card">
        <div>
          <p className="eyebrow">当前行动</p>
          <h3>{activeUnit.name}</h3>
          <span className="role-chip">{activeUnit.role}</span>
        </div>
        <dl>
          <div><dt>生命</dt><dd>{activeUnit.health} / {activeUnit.maxHealth}</dd></div>
          <div><dt>魔力</dt><dd>{activeUnit.mana} / {activeUnit.maxMana}</dd></div>
          <div><dt>移动</dt><dd>{activeUnit.remainingMovement} / {activeUnit.movement}</dd></div>
          <div><dt>主行动</dt><dd>{activeUnit.mainActionAvailable ? "可用" : "已消耗"}</dd></div>
          <div><dt>反应</dt><dd>{activeUnit.reactionAvailable ? "待命" : "已消耗"}</dd></div>
        </dl>
      </section>

      <div className="action-grid" aria-label="战斗行动">
        <button
          type="button"
          className={mode === "move" ? "action-button active" : "action-button"}
          onClick={() => interactionStore.setMode("move")}
        >
          移动
        </button>
        <button
          type="button"
          className={mode === "attack" ? "action-button active danger" : "action-button danger"}
          disabled={!activeUnit.mainActionAvailable || attackTargets.length === 0}
          onClick={() => interactionStore.setMode("attack")}
        >
          攻击 · {attackTargets.length}
        </button>
      </div>

      <button type="button" className="primary-action" onClick={endTurn}>结束行动</button>

      {snapshot.lastError && (
        <p className="error-message" role="alert">{snapshot.lastError.message}</p>
      )}

      <section className="event-log">
        <div className="section-title"><h3>领域事件</h3><span>{snapshot.eventLog.length}</span></div>
        {recentEvents.length === 0 ? (
          <p className="muted">移动后切换“攻击”，点击红色高亮敌人。</p>
        ) : (
          <ol>
            {recentEvents.map(event => (
              <li key={event.sequence}>
                <span>#{event.sequence}</span>
                <code>{event.type}</code>
              </li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  );
}
