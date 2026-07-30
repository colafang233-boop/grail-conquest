import {
  CAMPAIGN_ROUTE_DEFINITIONS,
  createNewGameState,
  type CampaignRouteId,
} from "@grail/core";
import { gameEngine } from "../game-engine";
import { hasSavedGame, loadSavedGame } from "../save-game";
import { useState } from "react";
import "./campaign.css";

export function NewGameScreen() {
  const [feedback, setFeedback] = useState<string>();
  const routes = Object.values(CAMPAIGN_ROUTE_DEFINITIONS);

  const start = (routeId: CampaignRouteId) => {
    const result = gameEngine.dispatch({ type: "campaign.start", routeId });
    if (!result.ok) setFeedback(result.error?.message);
  };

  const load = () => {
    try {
      const savedAt = loadSavedGame();
      setFeedback(savedAt ? `已载入：${new Date(savedAt).toLocaleString()}` : "没有可载入的战役存档");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "存档载入失败");
    }
  };

  return (
    <main className="campaign-shell new-game-shell">
      <section className="campaign-hero">
        <p className="eyebrow">THREE-NIGHT MINI CAMPAIGN</p>
        <h1>Grail Conquest</h1>
        <p>选择一个Master–Servant阵营，在三夜内完成路线目标。所有命令、外交、战斗和结局均可导出为确定性Replay。</p>
      </section>

      <section className="route-grid">
        {routes.map(route => (
          <article className={`route-card route-${route.id}`} key={route.id}>
            <p className="eyebrow">{route.id.replace("-route", "").toUpperCase()}</p>
            <h2>{route.title}</h2>
            <p>{route.description}</p>
            <ol>
              {route.objectives.map(objective => (
                <li key={objective.id}>
                  <strong>{objective.label}</strong>
                  <span>{objective.description}</span>
                </li>
              ))}
            </ol>
            <button onClick={() => start(route.id)}>选择该路线</button>
          </article>
        ))}
      </section>

      <div className="campaign-secondary-actions">
        <button disabled={!hasSavedGame()} onClick={load}>继续已有战役</button>
      </div>
      {feedback && <p className="campaign-feedback" role="status">{feedback}</p>}
    </main>
  );
}

export function CampaignEndingScreen(props: { readonly onOpenReplay: () => void }) {
  const state = gameEngine.getSnapshot().state;
  const result = state.campaign.result;

  const restart = () => gameEngine.reset(createNewGameState());

  return (
    <main className="campaign-shell ending-shell">
      <section className={`ending-card ending-${result?.outcome ?? "partial"}`}>
        <p className="eyebrow">CAMPAIGN COMPLETE</p>
        <h1>{result?.title ?? "三夜战役结束"}</h1>
        <p>{result?.summary}</p>
        <div className="ending-score">
          <span>战役评分</span>
          <strong>{result?.score ?? 0}</strong>
        </div>
        <section className="campaign-objective-list">
          {state.campaign.objectives.map(objective => (
            <article key={objective.id} className={objective.completed ? "completed" : "incomplete"}>
              <span>{objective.completed ? "✓" : "—"}</span>
              <div><strong>{objective.label}</strong><p>{objective.description}</p></div>
            </article>
          ))}
        </section>
        {state.campaign.consequences.length > 0 && (
          <section className="campaign-consequences">
            <h2>战役后果</h2>
            {state.campaign.consequences.map(item => <p key={item}>{item}</p>)}
          </section>
        )}
        <div className="ending-actions">
          <button onClick={props.onOpenReplay}>打开Replay检查器</button>
          <button onClick={restart}>重新选择路线</button>
        </div>
      </section>
    </main>
  );
}
