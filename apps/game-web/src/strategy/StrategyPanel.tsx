import { useMemo, useState } from "react";
import {
  EMIYA_FACTION_ID,
  ENEMY_STRATEGY_FACTION_ID,
  ORDER_LABELS,
  RYOUDOU_FACTION_ID,
  STRATEGY_FACTION_ID,
  STRATEGY_MASTER_ID,
  STRATEGY_SERVANT_ID,
  getControlledLeylineRegions,
  getCurrentStrategyRegion,
  getDiplomacyRelation,
  getEncounterAdvantageLabel,
  getEncounterDefinition,
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

const DIPLOMACY_TARGETS = [EMIYA_FACTION_ID, RYOUDOU_FACTION_ID, ENEMY_STRATEGY_FACTION_ID] as const;

export function StrategyPanel() {
  const snapshot = useGameSnapshot();
  const state = snapshot.state;
  const strategy = state.strategy;
  const current = getCurrentStrategyRegion(state);
  const controlled = getControlledLeylineRegions(state);
  const master = state.battle.units[STRATEGY_MASTER_ID];
  const servant = state.battle.units[STRATEGY_SERVANT_ID];
  const contract = state.battle.contracts[STRATEGY_FACTION_ID];
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

  const submitOrder = (orderType: StrategicOrderType) => {
    dispatch({ type: "operations.submit_order", orderType });
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
  const canRest = planning && (current.id === "tohsaka-residence" || current.id === "emiya-residence" || current.id === "church");
  const canWorkshop = planning && (current.id === "tohsaka-residence" || current.controlledBy === STRATEGY_FACTION_ID);
  const revealOrders = strategy.phase === "encounter_resolution" || strategy.phase === "night_settlement";
  const factionOrders = Object.values(strategy.factions)
    .filter(faction => faction.id !== STRATEGY_FACTION_ID && faction.order)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));

  return (
    <aside className="strategy-panel">
      <div className="panel-heading">
        <p className="eyebrow">FUYUKI MULTI-FACTION WAR · DAY {strategy.day}</p>
        <h2>圣杯战争终端</h2>
      </div>

      <div className="strategy-metrics operations-metrics">
        <article><span>阶段</span><strong>{PHASE_LABELS[strategy.phase]}</strong></article>
        <article><span>暴露度</span><strong>{strategy.exposure}</strong></article>
        <article><span>灵脉强度</span><strong>{leylinePower}</strong></article>
        <article><span>活动阵营</span><strong>{Object.values(strategy.factions).filter(item => item.status === "active").length}</strong></article>
      </div>

      <section className="strategy-location-card">
        <p className="eyebrow">CURRENT REGION</p>
        <h3>{current.name}</h3>
        <div className="region-badges">
          <span>{current.investigated ? "已调查" : "未调查"}</span>
          <span>灵脉 {current.leylineStrength}</span>
          {current.controlledBy === STRATEGY_FACTION_ID && <span className="controlled">远坂控制</span>}
        </div>
        <p>{strategy.objective}</p>
      </section>

      <FactionOverview />

      {planning && (
        <>
          <DiplomacyConsole dispatch={dispatch} />
          <section className="operation-card">
            <div className="section-title"><h3>本夜行动</h3><span>选择一项</span></div>
            <div className="operation-action-grid">
              <button disabled={!canInvestigate} onClick={() => submitOrder("investigate")}>调查</button>
              <button disabled={!canDefend} onClick={() => submitOrder("defend_leyline")}>灵脉行动</button>
              <button onClick={() => submitOrder("ambush")}>伏击</button>
              <button disabled={!canRest} onClick={() => submitOrder("rest")}>休整</button>
              <button disabled={!canWorkshop} onClick={() => submitOrder("prepare_workshop")}>准备工房</button>
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
          <div className="hidden-sigil">3</div>
          <div><strong>三支AI阵营命令已封存</strong><p>Saber、Lancer与Caster的目的地和行动尚不可见。</p></div>
          <button onClick={() => dispatch({ type: "operations.resolve_night" })}>四方同步结算</button>
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

      {master && servant && contract && (
        <section className="strategy-party-card">
          <div className="section-title"><h3>远坂阵营</h3><span>令咒 {contract.commandSeals}</span></div>
          <dl>
            <div><dt>凛</dt><dd>HP {master.health}/{master.maxHealth} · MP {master.mana}/{master.maxMana}</dd></div>
            <div><dt>Archer</dt><dd>HP {servant.health}/{servant.maxHealth} · MP {servant.mana}/{servant.maxMana}</dd></div>
          </dl>
          {strategy.workshopPrepared && <p className="workshop-ready">工房准备完成：下一场战斗获得15点投影护盾。</p>}
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

function FactionOverview() {
  const state = useGameSnapshot().state;
  return (
    <section className="faction-overview-card">
      <div className="section-title"><h3>参战阵营</h3><span>{Object.keys(state.strategy.factions).length}</span></div>
      <div className="faction-overview-list">
        {Object.values(state.strategy.factions).sort((a, b) => a.name.localeCompare(b.name)).map(faction => (
          <article key={faction.id}>
            <div><strong>{faction.name}</strong><span>{faction.status}</span></div>
            <small>位置：{faction.id === STRATEGY_FACTION_ID || faction.knownRegionId ? state.strategy.regions[faction.regionId].name : "未知"} · 暴露 {faction.exposure}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function DiplomacyConsole({ dispatch }: { readonly dispatch: (command: Parameters<typeof gameEngine.dispatch>[0]) => void }) {
  const state = useGameSnapshot().state;
  return (
    <section className="diplomacy-card">
      <div className="section-title"><h3>外交与临时合作</h3><span>计划阶段</span></div>
      {DIPLOMACY_TARGETS.map(targetId => {
        const faction = getStrategicFaction(state, targetId);
        const relation = getDiplomacyRelation(state, STRATEGY_FACTION_ID, targetId);
        if (!faction || !relation) return null;
        const agreement = relation.status === "allied" || relation.status === "truce";
        return (
          <div className="diplomacy-row" key={targetId}>
            <div><strong>{faction.name}</strong><span className={`relation relation-${relation.status}`}>{RELATION_LABELS[relation.status]}</span></div>
            <small>{relation.expiresDay ? `有效至第${relation.expiresDay}日` : relation.sharedDetection ? "共享侦察" : "不共享情报"}</small>
            <div className="diplomacy-actions">
              {!agreement && relation.status !== "betrayed" && <>
                <button onClick={() => dispatch({ type: "diplomacy.offer", targetFactionId: targetId, proposedStatus: "truce", durationDays: 2 })}>提议停战</button>
                <button onClick={() => dispatch({ type: "diplomacy.offer", targetFactionId: targetId, proposedStatus: "allied", durationDays: 2 })}>提议联盟</button>
              </>}
              {agreement && <button className="betray-action" onClick={() => dispatch({ type: "diplomacy.break", targetFactionId: targetId })}>撕毁协议</button>}
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
