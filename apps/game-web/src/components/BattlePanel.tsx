import {
  evaluateIdentityCandidates,
  findLegalAttackTargets,
  getPlayerFactionId,
  getSelectedPlayerFaction,
  hexDistance,
  type CommandSealEffect,
} from "@grail/core";
import { gameEngine } from "../game-engine";
import { interactionStore } from "../interaction-store";
import { useGameSnapshot } from "../hooks/useGameSnapshot";
import { useInteractionMode } from "../hooks/useInteractionMode";
import { AbilityPalette } from "./AbilityPalette";

const SEAL_LABELS: Readonly<Record<CommandSealEffect, string>> = {
  recall: "强制召回",
  extra_turn: "再次行动",
  mana_infusion: "魔力灌注",
  reject_death: "拒绝死亡",
};

const PHASE_LABELS = {
  investigation: "调查中",
  encounter: "交战中",
  noble_phantasm_warning: "宝具预警",
  completed: "已结算",
} as const;

export function BattlePanel() {
  const snapshot = useGameSnapshot();
  const mode = useInteractionMode();
  const state = snapshot.state;
  const { battle, scenario } = state;
  const playerFactionId = getPlayerFactionId(state);
  const playerFaction = getSelectedPlayerFaction(state);
  const activeUnit = battle.units[battle.activeUnitId];
  const contract = battle.contracts[playerFactionId];
  const master = contract ? battle.units[contract.masterId] : undefined;
  const servant = contract ? battle.units[contract.servantId] : undefined;

  if (!activeUnit) return <aside className="battle-panel">当前行动单位不存在。</aside>;

  const playerTurn = activeUnit.factionId === playerFactionId;
  const battleActive = scenario.phase === "encounter" || scenario.phase === "noble_phantasm_warning";
  const playerCanAct = playerTurn && battleActive;
  const attackTargets = playerCanAct ? findLegalAttackTargets(battle, activeUnit.id) : [];
  const candidates = evaluateIdentityCandidates(scenario.clues);
  const contractDistance = master && servant ? hexDistance(master.position, servant.position) : undefined;
  const guardReady = Boolean(
    contract && master?.deployed && servant?.deployed && !master.defeated && !servant.defeated &&
    servant.reactionAvailable && contractDistance !== undefined &&
    contractDistance <= contract.guardRange + servant.guardBonus,
  );
  const transferAvailable = Boolean(
    playerCanAct && contract && master && servant && activeUnit.id === master.id &&
    activeUnit.mainActionAvailable && master.mana > 0 && servant.mana < servant.maxMana &&
    contractDistance !== undefined && contractDistance <= contract.transferRange,
  );

  const endTurn = () => {
    if (!playerCanAct) return;
    interactionStore.setMode({ type: "move" });
    gameEngine.dispatch({ type: "battle.end_turn", battleId: battle.id, unitId: activeUnit.id });
  };

  const transferMana = () => {
    if (!contract) return;
    interactionStore.setMode({ type: "move" });
    gameEngine.dispatch({ type: "contract.transfer_mana", battleId: battle.id, factionId: contract.factionId });
  };

  const useCommandSeal = (effect: CommandSealEffect) => {
    if (!contract || !battleActive) return;
    interactionStore.setMode({ type: "move" });
    gameEngine.dispatch({
      type: "contract.use_command_seal",
      battleId: battle.id,
      factionId: contract.factionId,
      effect,
    });
  };

  const recentEvents = snapshot.eventLog.slice(-12).reverse();

  return (
    <aside className="battle-panel">
      <div className="panel-heading">
        <p className="eyebrow">{playerFaction?.name ?? "PLAYER FACTION"} · NIGHT {state.campaign.currentNight}</p>
        <h2>战术终端</h2>
      </div>

      <div className="status-grid">
        <article className="metric"><span>回合</span><strong>{battle.round}</strong></article>
        <article className="metric"><span>阶段</span><strong className="phase-value">{PHASE_LABELS[scenario.phase]}</strong></article>
      </div>

      <section className="scenario-card">
        <div className="section-title"><h3>任务状态</h3><span>{scenario.clues.length} 条线索</span></div>
        <p>{scenario.objective}</p>
        {scenario.clues.length > 0 && (
          <ul className="live-clues">
            {scenario.clues.slice(-3).reverse().map(clue => <li key={clue.id}>{clue.label}</li>)}
          </ul>
        )}
        {candidates[0] && (
          <div className="top-candidate">
            <span>当前最高候选</span>
            <strong>{candidates[0].name} · {candidates[0].confidence}%</strong>
          </div>
        )}
      </section>

      <section className="unit-card">
        <div>
          <p className="eyebrow">{playerTurn ? "当前行动" : "其他阵营行动结算中"}</p>
          <h3>{activeUnit.name}</h3>
          <span className="role-chip">{activeUnit.role}</span>
        </div>
        <dl>
          <div><dt>生命</dt><dd>{activeUnit.health} / {activeUnit.maxHealth}</dd></div>
          <div><dt>魔力</dt><dd>{activeUnit.mana} / {activeUnit.maxMana}</dd></div>
          <div><dt>移动</dt><dd>{activeUnit.remainingMovement} / {activeUnit.movement}</dd></div>
          <div><dt>主行动</dt><dd>{activeUnit.mainActionAvailable ? "可用" : "已消耗"}</dd></div>
          <div><dt>反应</dt><dd>{activeUnit.reactionAvailable ? "待命" : "已消耗"}</dd></div>
          {activeUnit.role === "servant" && (
            <div><dt>供魔状态</dt><dd>{activeUnit.lowMana ? "低魔力 · 攻击-25%" : "稳定"}</dd></div>
          )}
          {activeUnit.barrier > 0 && <div><dt>护盾</dt><dd>{activeUnit.barrier}</dd></div>}
        </dl>
      </section>

      <div className="action-grid" aria-label="战斗行动">
        <button
          type="button"
          className={mode.type === "move" ? "action-button active" : "action-button"}
          disabled={!playerCanAct}
          onClick={() => interactionStore.setMode({ type: "move" })}
        >移动</button>
        <button
          type="button"
          className={mode.type === "attack" ? "action-button active danger" : "action-button danger"}
          disabled={!playerCanAct || !activeUnit.mainActionAvailable || attackTargets.length === 0}
          onClick={() => interactionStore.setMode({ type: "attack" })}
        >攻击 · {attackTargets.length}</button>
      </div>

      {activeUnit.role === "servant" && (
        <AbilityPalette battle={battle} activeUnit={activeUnit} enabled={playerCanAct} />
      )}

      {contract && master && servant && (
        <section className="contract-card">
          <div className="section-title">
            <div><p className="eyebrow">MASTER–SERVANT CONTRACT</p><h3>契约回路</h3></div>
            <span className={guardReady ? "contract-status ready" : "contract-status"}>
              {guardReady ? "护卫待命" : "护卫失效"}
            </span>
          </div>
          <div className="contract-pair">
            <div><span>Master</span><strong>{master.name}</strong><small>魔力 {master.mana}</small></div>
            <div className="contract-link">距离 {contractDistance ?? "—"}</div>
            <div><span>Servant</span><strong>{servant.name}</strong><small>魔力 {servant.mana}</small></div>
          </div>
          <dl className="contract-metrics">
            <div><dt>稳定度</dt><dd>{contract.stability}</dd></div>
            <div><dt>信赖</dt><dd>{contract.trust}</dd></div>
            <div><dt>每轮维持</dt><dd>{contract.upkeep} MP</dd></div>
          </dl>
          <button type="button" className="mana-action" disabled={!transferAvailable} onClick={transferMana}>
            供魔 +{contract.transferAmount} MP
          </button>
          <div className="seal-heading">
            <span>令咒</span>
            <div className="seal-marks" aria-label={`剩余 ${contract.commandSeals} 划令咒`}>
              {Array.from({ length: 3 }, (_, index) => <i key={index} className={index < contract.commandSeals ? "active" : ""} />)}
            </div>
          </div>
          <div className="seal-grid">
            {(Object.keys(SEAL_LABELS) as CommandSealEffect[]).map(effect => (
              <button
                key={effect}
                type="button"
                disabled={!battleActive || contract.commandSeals <= 0}
                onClick={() => useCommandSeal(effect)}
              >{SEAL_LABELS[effect]}</button>
            ))}
          </div>
          {servant.deathWardActive && <p className="ward-notice">令咒效果：下一次致命伤害将被拒绝。</p>}
        </section>
      )}

      <button type="button" className="primary-action" disabled={!playerCanAct} onClick={endTurn}>
        {playerTurn ? "结束行动" : "其他阵营行动中…"}
      </button>

      {snapshot.lastError && <p className="error-message" role="alert">{snapshot.lastError.message}</p>}

      <section className="event-log">
        <div className="section-title"><h3>领域事件</h3><span>{snapshot.eventLog.length}</span></div>
        {recentEvents.length === 0 ? <p className="muted">行动后，战斗与情报事件会记录在这里。</p> : (
          <ol>{recentEvents.map(event => <li key={event.sequence}><span>#{event.sequence}</span><code>{event.type}</code></li>)}</ol>
        )}
      </section>
    </aside>
  );
}
