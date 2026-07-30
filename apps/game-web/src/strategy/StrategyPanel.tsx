import { useMemo, useState } from "react";
import {
  ORDER_LABELS,
  getCampaignHomeRegion,
  getCampaignRoute,
  getDiplomacyRelation,
  getEncounterAdvantageLabel,
  getEncounterDefinition,
  getPlayerFactionId,
  getSelectedPlayerFaction,
  getStrategicFaction,
  type FactionId,
  type OperationPhase,
  type StrategicOrder,
  type StrategicOrderType,
} from "@grail/core";
import { gameEngine } from "../game-engine";
import { useGameSnapshot } from "../hooks/useGameSnapshot";
import { hasSavedGame, loadSavedGame, saveCurrentGame } from "../save-game";

const PHASE_LABELS: Readonly<Record<OperationPhase, string>> = {
  dawn: "清晨结算",
  planning: "夜间计划",
  orders_locked: "命令封存",
  movement_resolution: "同步移动",
  encounter_resolution: "遭遇判定",
  night_settlement: "夜间结算",
};

const RELATION_LABELS = {
  neutral: "中立",
  truce: "停战",
  allied: "联盟",
  hostile: "敌对",
  betrayed: "背叛",
} as const;

const DETECTION_LABELS = {
  mutual: "双方互相发现",
  player_only: "我方单向发现",
  enemy_only: "敌方单向发现",
  missed: "双方均未发现",
} as const;

export function StrategyPanel() {
  const snapshot = useGameSnapshot();
  const state = snapshot.state;
  const strategy = state.strategy;
  const playerFactionId = getPlayerFactionId(state);
  const playerFaction = getSelectedPlayerFaction(state);
  const route = state.campaign.routeId ? getCampaignRoute(state.campaign.routeId) : undefined;
  const current = strategy.regions[strategy.currentRegionId];
  const homeRegionId = getCampaignHomeRegion(state);
  const controlled = Object.values(strategy.regions)
    .filter(region => region.controlledBy === playerFactionId)
    .sort((left, right) => left.id.localeCompare(right.id));
  const master = playerFaction ? state.battle.units[playerFaction.masterUnitId] : undefined;
  const primaryServantId = playerFaction?.servantUnitIds[0];
  const servant = primaryServantId ? state.battle.units[primaryServantId] : undefined;
  const contract = state.battle.contracts[playerFactionId];
  const [feedback, setFeedback] = useState<string>();
  const [saveAvailable, setSaveAvailable] = useState(() => hasSavedGame());

  const adjacent = useMemo(
    () => current.connections.map(id => strategy.regions[id]),
    [current, strategy.regions],
  );

  const dispatch = (command: Parameters<typeof gameEngine.dispatch>[0]) => {
    const result = gameEngine.dispatch(command);
    if (!result.ok) setFeedback(result.error?.message);
    else setFeedback(undefined);
  };

  const save = () => {
    const savedAt = saveCurrentGame();
    setSaveAvailable(true);
    setFeedback(`已保存：${new Date(savedAt).toLocaleString()}`);
  };

  const load = () => {
    try {
      const savedAt = loadSavedGame();
      setFeedback(savedAt ? `已载入：${new Date(savedAt).toLocaleString()}` : "没有可载入的存档");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "存档载入失败");
    }
  };

  const planning = strategy.phase === "planning";
  const leylinePower = controlled.reduce((sum, region) => sum + region.leylineStrength, 0);
  const canInvestigate = planning && !current.investigated;
  const canDefend = planning && current.leylineStrength > 0;
  const canRest = planning && (current.id === homeRegionId || current.id === "church");
  const canWorkshop = planning && (current.id === homeRegionId || current.controlledBy === playerFactionId);
  const revealOrders = strategy.phase === "encounter_resolution" || strategy.phase === "night_settlement";
  const factionOrders = Object.values(strategy.factions)
    .filter(faction => faction.id !== playerFactionId && faction.order)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));

  return (
    <aside className="strategy-panel">
      <div className="panel-heading">
        <p className="eyebrow">THREE-NIGHT CAMPAIGN · NIGHT {state.campaign.currentNight}/{state.campaign.maxNights}</p>
        <h2>{route?.title ?? "圣杯战争终端"}</h2>
      </div>

      <section className="campaign-progress-card">
        <div className="section-title"><h3>路线目标</h3><span>{state.campaign.objectives.filter(item => item.completed).length}/3</span></div>
        <div className="campaign-progress-list">
          {state.campaign.objectives.map(objective => (
            <article key={objective.id} className={objective.completed ? "completed" : ""}>
              <i>{objective.completed ? "✓" : "○"}</i>
              <div><strong>{objective.label}</strong><small>{objective.description}</small></div>
            </article>
          ))}
        </div>
      </section>

      <div className="strategy-metrics operations-metrics">
        <article><span>阶段</span><strong>{PHASE_LABELS[strategy.phase]}</strong></article>
        <article><span>暴露度</span><strong>{playerFaction?.exposure ?? strategy.exposure}</strong></article>
        <article><span>灵脉强度</span><strong>{leylinePower}</strong></article>
        <article><span>活动阵营</span><strong>{Object.values(strategy.factions).filter(item => item.status === "active").length}</strong></article>
      </div>

      <section className="strategy-location-card">
        <p className="eyebrow">CURRENT REGION</p>
        <h3>{current.name}</h3>
        <div className="region-badges">
          <span>{current.investigated ? "已调查" : "未调查"}</span>
          <span>灵脉 {current.leylineStrength}</span>
          {current.controlledBy === playerFactionId && <span className="controlled">己方控制</span>}
          {current.id === homeRegionId && <span>本拠地</span>}
        </div>
        <p>{strategy.objective}</p>
      </section>

      <FactionOverview playerFactionId={playerFactionId} />

      {planning && (
        <>
          <DiplomacyConsole playerFactionId={playerFactionId} dispatch={dispatch} />
          <section className="operation-card">
            <div className="section-title"><h3>本夜行动</h3><span>选择一项</span></div>
            <div className="operation-action-grid">
              <button disabled={!canInvestigate} onClick={() => dispatch({ type: "operations.submit_order", orderType: "investigate" })}>调查</button>
              <button disabled={!canDefend} onClick={() => dispatch({ type: "operations.submit_order", orderType: "defend_leyline" })}>灵脉行动</button>
              <button onClick={() => dispatch({ type: "operations.submit_order", orderType: "ambush" })}>伏击</button>
              <button disabled={!canRest} onClick={() => dispatch({ type: "operations.submit_order", orderType: "rest" })}>休整</button>
              <button disabled={!canWorkshop} onClick={() => dispatch({ type: "operations.submit_order", orderType: "prepare_workshop" })}>准备工房</button>
            </div>
          </section>

          <section className="adjacent-regions operation-routes">
            <div className="section-title"><h3>移动命令</h3><span>点击地图或区域</span></div>
            <div>
              {adjacent.map(region => (
                <button
                  key={region.id}
                  onClick={() => dispatch({ type: "operations.submit_order", orderType: "move", destinationId: region.id })}
                >
                  <strong>{region.discovered ? region.name : "未知区域"}</strong>
                  <small>{region.investigated ? "已调查" : "待探索"}</small>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {strategy.playerOrder && (
        <section className={`order-preview phase-${strategy.phase}`}>
          <div className="section-title">
            <div><p className="eyebrow">PLAYER ORDER</p><h3>{ORDER_LABELS[strategy.playerOrder.type]}</h3></div>
            <span>{strategy.phase === "planning" ? "待锁定" : "已锁定"}</span>
          </div>
          <p>{describeOrder(strategy.playerOrder, state)}</p>
          {strategy.phase === "planning" && (
            <div className="order-actions">
              <button onClick={() => dispatch({ type: "operations.cancel_order" })}>撤销</button>
              <button className="lock-order" onClick={() => dispatch({ type: "operations.lock_orders" })}>锁定命令</button>
            </div>
          )}
        </section>
      )}

      {strategy.phase === "orders_locked" && (
        <section className="enemy-order-hidden">
          <div className="hidden-sigil">?</div>
          <div><strong>其他阵营命令已封存</strong><p>目的地与行动类型将在同步结算后公开。</p></div>
          <button onClick={() => dispatch({ type: "operations.resolve_night" })}>同步结算</button>
        </section>
      )}

      {revealOrders && factionOrders.length > 0 && (
        <section className="enemy-order-reveal">
          <p className="eyebrow">FACTION ORDERS REVEALED</p>
          {factionOrders.map(faction => (
            <div className="faction-order-row" key={faction.id}>
              <strong>{faction.name}</strong>
              <span>{faction.order ? describeOrder(faction.order, state) : "无命令"}</span>
            </div>
          ))}
        </section>
      )}

      {strategy.lastDetections.length > 0 && (
        <section className="detection-card">
          <div className="section-title"><h3>侦察判定</h3><span>{strategy.lastDetections.length}组</span></div>
          {strategy.lastDetections.slice(-4).map((detection, index) => (
            <div className="multi-detection" key={`${detection.regionId}-${index}`}>
              <span>{DETECTION_LABELS[detection.outcome]} · {strategy.regions[detection.regionId].name}</span>
              <small>{factionName(detection.firstFactionId, state)} ↔ {factionName(detection.secondFactionId, state)}</small>
            </div>
          ))}
        </section>
      )}

      {strategy.encounterQueue.map(encounter => {
        const definition = getEncounterDefinition(encounter.encounterId);
        return (
          <section className="operation-encounter-card" key={encounter.id}>
            <p className="eyebrow">MULTI-PARTY ENCOUNTER</p>
            <h3>{definition.title}</h3>
            <p>{definition.subtitle}</p>
            <div className="encounter-participants">
              {encounter.participantFactionIds.map(id => <span key={id}>{factionName(id, state)}</span>)}
            </div>
            <div className="encounter-tags">
              <span>{getEncounterAdvantageLabel(encounter.advantage)}</span>
              <span>{encounter.hostilePairs.length}组敌对关系</span>
              <span>{encounter.mandatory ? "不可回避" : "可选择交战"}</span>
            </div>
            <button className="encounter-action" onClick={() => dispatch({ type: "operations.enter_encounter", queueId: encounter.id })}>进入遭遇</button>
            {!encounter.mandatory && (
              <button className="decline-encounter" onClick={() => dispatch({ type: "operations.decline_encounter", queueId: encounter.id })}>保持隐蔽</button>
            )}
          </section>
        );
      })}

      {strategy.churchBounty?.active && (
        <section className="church-bounty-card">
          <p className="eyebrow">CHURCH BOUNTY</p>
          <h3>教会共同讨伐令</h3>
          <p>{strategy.churchBounty.reason}</p>
          <strong>目标：{factionName(strategy.churchBounty.targetFactionId, state)} · 情报奖励 {strategy.churchBounty.intelligenceReward}</strong>
        </section>
      )}

      {strategy.phase === "night_settlement" && (
        <button className="dawn-action" onClick={() => dispatch({ type: "operations.settle_night" })}>结束夜晚 · 进入清晨结算</button>
      )}

      {strategy.resolutionTimeline.length > 0 && (
        <section className="operation-timeline">
          <div className="section-title"><h3>夜间结算时间线</h3><span>{strategy.resolutionTimeline.length}</span></div>
          <ol>
            {strategy.resolutionTimeline.map(entry => (
              <li key={entry.id}><i /><div><span>{PHASE_LABELS[entry.phase]}</span><p>{entry.message}</p></div></li>
            ))}
          </ol>
        </section>
      )}

      {playerFaction && master && servant && contract && (
        <section className="strategy-party-card">
          <div className="section-title"><h3>{playerFaction.name}</h3><span>令咒 {contract.commandSeals}</span></div>
          <dl>
            <div><dt>{master.name}</dt><dd>HP {master.health}/{master.maxHealth} · MP {master.mana}/{master.maxMana}</dd></div>
            <div><dt>{servant.name}</dt><dd>HP {servant.health}/{servant.maxHealth} · MP {servant.mana}/{servant.maxMana}</dd></div>
          </dl>
          {strategy.workshopPrepared && <p className="workshop-ready">工房准备完成：下一场战斗获得15点护盾。</p>}
        </section>
      )}

      {strategy.lastReport && (
        <section className="strategy-report-card">
          <p className="eyebrow">LATEST INTELLIGENCE</p>
          <h3>{strategy.lastReport.title}</h3>
          <p>{strategy.lastReport.summary}</p>
          {strategy.lastReport.candidates[0] && (
            <div className="report-candidate"><span>最高候选</span><strong>{strategy.lastReport.candidates[0].name} · {strategy.lastReport.candidates[0].confidence}%</strong></div>
          )}
        </section>
      )}

      <div className="strategy-save-actions">
        <button onClick={save}>保存进度</button>
        <button disabled={!saveAvailable} onClick={load}>载入进度</button>
      </div>

      {feedback && <p className="strategy-feedback" role="status">{feedback}</p>}
      <section className="event-log strategy-log">
        <div className="section-title"><h3>领域事件</h3><span>{snapshot.eventLog.length}</span></div>
        <ol>{snapshot.eventLog.slice(-12).reverse().map(event => <li key={event.sequence}><span>#{event.sequence}</span><code>{event.type}</code></li>)}</ol>
      </section>
    </aside>
  );
}

function FactionOverview({ playerFactionId }: { readonly playerFactionId: FactionId }) {
  const state = useGameSnapshot().state;
  return (
    <section className="faction-overview-card">
      <div className="section-title"><h3>参战阵营</h3><span>{Object.keys(state.strategy.factions).length}</span></div>
      <div className="faction-overview-list">
        {Object.values(state.strategy.factions).sort((a, b) => a.name.localeCompare(b.name)).map(faction => {
          const visibleRegionId = faction.id === playerFactionId ? faction.regionId : faction.knownRegionId;
          return (
            <article key={faction.id} className={faction.id === playerFactionId ? "player-faction" : ""}>
              <div><strong>{faction.name}</strong><span>{faction.id === playerFactionId ? "玩家" : faction.status}</span></div>
              <small>位置：{visibleRegionId ? state.strategy.regions[visibleRegionId].name : "未知"} · 暴露 {faction.exposure}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DiplomacyConsole(props: {
  readonly playerFactionId: FactionId;
  readonly dispatch: (command: Parameters<typeof gameEngine.dispatch>[0]) => void;
}) {
  const state = useGameSnapshot().state;
  const targets = Object.values(state.strategy.factions)
    .filter(faction => faction.id !== props.playerFactionId && faction.status === "active")
    .sort((left, right) => left.name.localeCompare(right.name));
  return (
    <section className="diplomacy-card">
      <div className="section-title"><h3>外交与临时合作</h3><span>计划阶段</span></div>
      {targets.map(faction => {
        const relation = getDiplomacyRelation(state, props.playerFactionId, faction.id);
        if (!relation) return null;
        const agreement = relation.status === "allied" || relation.status === "truce";
        return (
          <div className="diplomacy-row" key={faction.id}>
            <div><strong>{faction.name}</strong><span className={`relation relation-${relation.status}`}>{RELATION_LABELS[relation.status]}</span></div>
            <small>{relation.expiresDay ? `有效至第${relation.expiresDay}日` : relation.sharedDetection ? "共享侦察" : "不共享情报"}</small>
            <div className="diplomacy-actions">
              {!agreement && relation.status !== "betrayed" && <>
                <button onClick={() => props.dispatch({ type: "diplomacy.offer", targetFactionId: faction.id, proposedStatus: "truce", durationDays: 2 })}>提议停战</button>
                <button onClick={() => props.dispatch({ type: "diplomacy.offer", targetFactionId: faction.id, proposedStatus: "allied", durationDays: 2 })}>提议联盟</button>
              </>}
              {agreement && <button className="betray-action" onClick={() => props.dispatch({ type: "diplomacy.break", targetFactionId: faction.id })}>撕毁协议</button>}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function factionName(factionId: FactionId | undefined, state: ReturnType<typeof gameEngine.getSnapshot>["state"]): string {
  if (!factionId) return "未知阵营";
  return getStrategicFaction(state, factionId)?.name ?? String(factionId);
}

function describeOrder(order: StrategicOrder, state: ReturnType<typeof gameEngine.getSnapshot>["state"]): string {
  const origin = state.strategy.regions[order.originRegionId].name;
  const destination = state.strategy.regions[order.destinationRegionId].name;
  if (order.type === "move") return `${origin} → ${destination}`;
  return `在${destination}执行${ORDER_LABELS[order.type]}。`;
}
