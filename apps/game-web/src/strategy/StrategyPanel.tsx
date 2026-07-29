import { useMemo, useState } from "react";
import {
  ORDER_LABELS,
  STRATEGY_FACTION_ID,
  STRATEGY_MASTER_ID,
  STRATEGY_SERVANT_ID,
  getControlledLeylineRegions,
  getCurrentStrategyRegion,
  getEncounterAdvantageLabel,
  getEncounterDefinition,
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
  const canRest = planning && (current.id === "tohsaka-residence" || current.id === "church");
  const canWorkshop = planning && (
    current.id === "tohsaka-residence" || current.controlledBy === STRATEGY_FACTION_ID
  );
  const revealEnemyOrder = strategy.phase === "encounter_resolution" || strategy.phase === "night_settlement";

  return (
    <aside className="strategy-panel">
      <div className="panel-heading">
        <p className="eyebrow">FUYUKI OPERATIONS · DAY {strategy.day}</p>
        <h2>圣杯战争终端</h2>
      </div>

      <div className="strategy-metrics operations-metrics">
        <article><span>阶段</span><strong>{PHASE_LABELS[strategy.phase]}</strong></article>
        <article><span>暴露度</span><strong>{strategy.exposure}</strong></article>
        <article><span>灵脉强度</span><strong>{leylinePower}</strong></article>
        <article><span>已知敌踪</span><strong>{strategy.knownEnemyRegionId ? strategy.regions[strategy.knownEnemyRegionId].name : "未知"}</strong></article>
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

      {planning && (
        <>
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
                  onClick={() => dispatch({
                    type: "operations.submit_order",
                    orderType: "move",
                    destinationId: region.id,
                  })}
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
          <div><strong>敌方命令已封存</strong><p>结算前无法查看目的地与行动类型。</p></div>
          <button onClick={() => dispatch({ type: "operations.resolve_night" })}>同步结算</button>
        </section>
      )}

      {revealEnemyOrder && strategy.enemyOrder && (
        <section className="enemy-order-reveal">
          <p className="eyebrow">ENEMY ORDER REVEALED</p>
          <h3>{ORDER_LABELS[strategy.enemyOrder.type]}</h3>
          <p>{describeOrder(strategy.enemyOrder, state)}</p>
        </section>
      )}

      {strategy.lastDetection && (
        <section className="detection-card">
          <div className="section-title">
            <h3>{DETECTION_LABELS[strategy.lastDetection.outcome]}</h3>
            <span>{strategy.regions[strategy.lastDetection.regionId].name}</span>
          </div>
          <div className="detection-rolls">
            <div><span>我方发现</span><strong>{strategy.lastDetection.playerRoll} / {strategy.lastDetection.playerScore}</strong></div>
            <div><span>敌方发现</span><strong>{strategy.lastDetection.enemyRoll} / {strategy.lastDetection.enemyScore}</strong></div>
          </div>
        </section>
      )}

      {strategy.encounterQueue.map(encounter => {
        const definition = getEncounterDefinition(encounter.encounterId);
        return (
          <section className="operation-encounter-card" key={encounter.id}>
            <p className="eyebrow">ENCOUNTER GENERATED</p>
            <h3>{definition.title}</h3>
            <p>{definition.subtitle}</p>
            <div className="encounter-tags">
              <span>{getEncounterAdvantageLabel(encounter.advantage)}</span>
              <span>{encounter.mandatory ? "不可回避" : "可选择交战"}</span>
            </div>
            <button className="encounter-action" onClick={() => dispatch({
              type: "operations.enter_encounter",
              queueId: encounter.id,
            })}>进入遭遇</button>
            {!encounter.mandatory && (
              <button className="decline-encounter" onClick={() => dispatch({
                type: "operations.decline_encounter",
                queueId: encounter.id,
              })}>保持隐蔽</button>
            )}
          </section>
        );
      })}

      {strategy.phase === "night_settlement" && (
        <button className="dawn-action" onClick={() => dispatch({ type: "operations.settle_night" })}>
          结束夜晚 · 进入清晨结算
        </button>
      )}

      {strategy.resolutionTimeline.length > 0 && (
        <section className="operation-timeline">
          <div className="section-title"><h3>夜间结算时间线</h3><span>{strategy.resolutionTimeline.length}</span></div>
          <ol>
            {strategy.resolutionTimeline.map(entry => (
              <li key={entry.id}>
                <i />
                <div><span>{PHASE_LABELS[entry.phase]}</span><p>{entry.message}</p></div>
              </li>
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
            <div className="report-candidate">
              <span>最高候选</span>
              <strong>{strategy.lastReport.candidates[0].name} · {strategy.lastReport.candidates[0].confidence}%</strong>
            </div>
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
        <ol>
          {snapshot.eventLog.slice(-10).reverse().map(event => (
            <li key={event.sequence}><span>#{event.sequence}</span><code>{event.type}</code></li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

function describeOrder(order: StrategicOrder, state: ReturnType<typeof gameEngine.getSnapshot>["state"]): string {
  const origin = state.strategy.regions[order.originRegionId].name;
  const destination = state.strategy.regions[order.destinationRegionId].name;
  if (order.type === "move") return `${origin} → ${destination}`;
  return `在${destination}执行${ORDER_LABELS[order.type]}。`;
}
