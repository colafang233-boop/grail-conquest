import {
  createNewGameState,
  type CampaignRouteId,
} from "@grail/core";
import { useState } from "react";
import { useBrowserContent } from "../content/browser-content";
import { gameEngine } from "../game-engine";
import {
  getAutosaveSummary,
  hasAutosave,
  hasSavedGame,
  loadLatestAutosave,
  loadSavedGame,
} from "../save-game";
import "./campaign.css";

export function NewGameScreen() {
  const [feedback, setFeedback] = useState<string>();
  const content = useBrowserContent();
  const routes = content.pack?.routes.filter(route => isCampaignRouteId(route.id)) ?? [];
  const autosaves = getAutosaveSummary();

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

  const recover = () => {
    try {
      const savedAt = loadLatestAutosave();
      setFeedback(savedAt ? `已恢复自动存档：${new Date(savedAt).toLocaleString()}` : "没有可恢复的自动存档");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "自动存档恢复失败");
    }
  };

  if (content.status === "error") {
    return (
      <main className="campaign-shell new-game-shell">
        <section className="campaign-hero content-load-error" role="alert">
          <p className="eyebrow">CONTENT PACK ERROR</p>
          <h1>内容包无法启动</h1>
          <pre>{content.error}</pre>
          <p>请检查 public/content/base-content.json，修复后刷新浏览器。</p>
        </section>
      </main>
    );
  }

  return (
    <main className="campaign-shell new-game-shell">
      <section className="campaign-hero">
        <p className="eyebrow">THREE-NIGHT BROWSER CAMPAIGN</p>
        <h1>Grail Conquest</h1>
        <p>选择一个Master–Servant阵营，在三夜内完成路线目标。无需账号或安装，进度会自动保存在当前浏览器。</p>
        <small>Web Pre‑Alpha · Content {content.pack?.version ?? "loading"}</small>
      </section>

      <section className="route-grid" aria-label="可选战役路线">
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
            <button onClick={() => start(route.id as CampaignRouteId)}>选择该路线</button>
          </article>
        ))}
      </section>

      <div className="campaign-secondary-actions">
        <button disabled={!hasSavedGame()} onClick={load}>继续手动存档</button>
        <button disabled={!hasAutosave()} onClick={recover}>恢复最新自动存档</button>
      </div>
      {autosaves.length > 0 && (
        <details className="autosave-summary">
          <summary>自动存档恢复点 · {autosaves.length}</summary>
          <ol>{autosaves.map((item, index) => <li key={`${item.savedAt}-${index}`} className={item.valid ? "" : "invalid"}>{item.valid ? new Date(item.savedAt).toLocaleString() : item.savedAt}</li>)}</ol>
        </details>
      )}
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

function isCampaignRouteId(value: string): value is CampaignRouteId {
  return value === "tohsaka-route" || value === "emiya-route" || value === "ryudou-route";
}
