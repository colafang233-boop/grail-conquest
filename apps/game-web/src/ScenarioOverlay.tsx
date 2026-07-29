import { useEffect, useState } from "react";
import { createSchoolBattleState } from "@grail/core";
import { gameEngine } from "./game-engine";
import { useGameSnapshot } from "./hooks/useGameSnapshot";
import { hasSavedGame, loadSavedGame, saveCurrentGame } from "./save-game";

export function ScenarioOverlay() {
  const snapshot = useGameSnapshot();
  const scenario = snapshot.state.scenario;
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [saveAvailable, setSaveAvailable] = useState(() => hasSavedGame());
  const [feedback, setFeedback] = useState<string>();

  useEffect(() => {
    if (scenario.phase !== "noble_phantasm_warning") setWarningDismissed(false);
  }, [scenario.phase]);

  const save = () => {
    saveCurrentGame();
    setSaveAvailable(true);
    setFeedback("当前进度已保存到本机浏览器。");
  };

  const load = () => {
    try {
      const savedAt = loadSavedGame();
      setFeedback(savedAt ? `已载入存档：${new Date(savedAt).toLocaleString()}` : "没有可载入的存档。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "存档载入失败");
    }
  };

  const reset = () => {
    gameEngine.restore(createSchoolBattleState(), []);
    setFeedback(undefined);
  };

  if (scenario.phase === "investigation") {
    return (
      <div className="scenario-overlay full">
        <section className="scenario-dialog investigation-dialog">
          <p className="eyebrow">PROLOGUE · INVESTIGATION</p>
          <h2>穗群原学园 · 异常结界</h2>
          <p>凛在深夜的学园内检测到持续抽取生命力的术式。结界深处存在一组陌生的 Servant 反应，但对方的真名和 Master 均未确认。</p>
          <ul className="investigation-list">
            <li>结界强度正在上升，长时间停留会增加风险。</li>
            <li>Archer 建议先确认敌方武装与战斗风格。</li>
            <li>本次任务的成功条件不是歼灭，而是带回有效情报。</li>
          </ul>
          <div className="dialog-actions">
            <button
              type="button"
              className="primary-action compact"
              onClick={() => gameEngine.dispatch({ type: "scenario.begin_encounter" })}
            >进入结界</button>
            <button type="button" className="secondary-action" disabled={!saveAvailable} onClick={load}>
              载入进度
            </button>
          </div>
          {feedback && <p className="save-feedback">{feedback}</p>}
        </section>
      </div>
    );
  }

  if (scenario.phase === "noble_phantasm_warning" && !warningDismissed) {
    return (
      <div className="scenario-overlay warning-layer">
        <section className="scenario-dialog warning-dialog">
          <p className="eyebrow">DANGER · TRUE NAME RELEASE</p>
          <h2>检测到因果干涉型宝具征兆</h2>
          <p>常规闪避方案被判定为低可信。当前已获得足够情报，可以立即撤退保全成果，也可以继续承担风险尝试击败 Lancer。</p>
          <div className="dialog-actions">
            <button
              type="button"
              className="retreat-action"
              onClick={() => gameEngine.dispatch({ type: "scenario.retreat" })}
            >战术撤退</button>
            <button type="button" className="secondary-action" onClick={() => setWarningDismissed(true)}>
              继续交战
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (scenario.phase === "completed" && scenario.report) {
    return (
      <div className="scenario-overlay full report-layer">
        <section className="scenario-dialog report-dialog">
          <p className="eyebrow">AFTER ACTION REPORT</p>
          <h2>{scenario.report.title}</h2>
          <p>{scenario.report.summary}</p>

          <div className="report-columns">
            <section>
              <h3>真名候选</h3>
              <ol className="candidate-list">
                {scenario.report.candidates.map(candidate => (
                  <li key={candidate.id}>
                    <span>{candidate.name}</span>
                    <strong>{candidate.confidence}%</strong>
                  </li>
                ))}
              </ol>
            </section>
            <section>
              <h3>已转化战术</h3>
              <ul className="tactic-list">
                {scenario.report.unlockedTactics.map(tactic => <li key={tactic}>{tactic}</li>)}
              </ul>
            </section>
          </div>

          <details className="clue-details">
            <summary>查看本局获得的 {scenario.clues.length} 条线索</summary>
            <ul>{scenario.clues.map(clue => <li key={clue.id}>{clue.label}</li>)}</ul>
          </details>

          <div className="dialog-actions">
            <button type="button" className="primary-action compact" onClick={save}>保存战果</button>
            <button type="button" className="secondary-action" onClick={reset}>重新开始</button>
          </div>
          {feedback && <p className="save-feedback">{feedback}</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="save-toolbar" aria-live="polite">
      <button type="button" onClick={save}>保存</button>
      <button type="button" disabled={!saveAvailable} onClick={load}>载入</button>
      {feedback && <span>{feedback}</span>}
    </div>
  );
}
