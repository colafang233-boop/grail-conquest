import { useMemo, useState } from "react";
import {
  STRATEGY_FACTION_ID,
  STRATEGY_MASTER_ID,
  STRATEGY_SERVANT_ID,
  getControlledLeylineRegions,
  getCurrentStrategyRegion,
} from "@grail/core";
import { gameEngine } from "../game-engine";
import { useGameSnapshot } from "../hooks/useGameSnapshot";
import { hasSavedGame, loadSavedGame, saveCurrentGame } from "../save-game";

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

  const canInvestigate = strategy.actionPoints >= 1 && !current.investigated;
  const canControl = strategy.actionPoints >= 2 && current.leylineStrength > 0 && current.controlledBy !== STRATEGY_FACTION_ID;
  const canRest = strategy.actionPoints >= 1 && (current.id === "tohsaka-residence" || current.id === "church");
  const canEnter = strategy.pendingEncounterId === "school-night" && current.id === "school";
  const leylinePower = controlled.reduce((sum, region) => sum + region.leylineStrength, 0);

  return (
    <aside className="strategy-panel">
      <div className="panel-heading">
        <p className="eyebrow">FUYUKI OPERATIONS · DAY {strategy.day}</p>
        <h2>圣杯战争终端</h2>
      </div>

      <div className="strategy-metrics">
        <article><span>行动点</span><strong>{strategy.actionPoints}/{strategy.maxActionPoints}</strong></article>
        <article><span>暴露度</span><strong>{strategy.exposure}</strong></article>
        <article><span>灵脉强度</span><strong>{leylinePower}</strong></article>
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

      <div className="strategy-actions">
        <button disabled={!canInvestigate} onClick={() => dispatch({ type: "strategy.investigate" })}>调查区域 · 1 AP</button>
        <button disabled={!canControl} onClick={() => dispatch({ type: "strategy.control_leyline" })}>控制灵脉 · 2 AP</button>
        <button disabled={!canRest} onClick={() => dispatch({ type: "strategy.rest" })}>休整 · 1 AP</button>
        <button className="end-day" onClick={() => dispatch({ type: "strategy.end_day" })}>结束今日</button>
      </div>

      {canEnter && (
        <button className="encounter-action" onClick={() => dispatch({ type: "strategy.enter_encounter" })}>
          进入学校结界
        </button>
      )}

      <section className="adjacent-regions">
        <div className="section-title"><h3>相邻区域</h3><span>点击移动 · 1 AP</span></div>
        <div>
          {adjacent.map(region => (
            <button
              key={region.id}
              disabled={strategy.actionPoints < 1}
              onClick={() => dispatch({ type: "strategy.move_region", destinationId: region.id })}
            >
              <strong>{region.discovered ? region.name : "未知区域"}</strong>
              <small>{region.investigated ? "已调查" : "待探索"}</small>
            </button>
          ))}
        </div>
      </section>

      {master && servant && contract && (
        <section className="strategy-party-card">
          <div className="section-title"><h3>远坂阵营</h3><span>令咒 {contract.commandSeals}</span></div>
          <dl>
            <div><dt>凛</dt><dd>HP {master.health}/{master.maxHealth} · MP {master.mana}/{master.maxMana}</dd></div>
            <div><dt>Archer</dt><dd>HP {servant.health}/{servant.maxHealth} · MP {servant.mana}/{servant.maxMana}</dd></div>
          </dl>
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
        <div className="section-title"><h3>行动记录</h3><span>{snapshot.eventLog.length}</span></div>
        <ol>
          {snapshot.eventLog.slice(-8).reverse().map(event => (
            <li key={event.sequence}><span>#{event.sequence}</span><code>{event.type}</code></li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
