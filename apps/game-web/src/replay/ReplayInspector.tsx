import {
  createReplayDocument,
  parseReplayDocument,
  replayToStep,
  serializeReplayDocument,
  type ReplayDocument,
} from "@grail/core";
import { useMemo, useRef, useState } from "react";
import { gameEngine } from "../game-engine";
import "./replay.css";

export function ReplayInspector(props: { readonly onClose: () => void }) {
  const [document, setDocument] = useState<ReplayDocument>(() => createCurrentReplay());
  const [step, setStep] = useState(document.events.length);
  const [filter, setFilter] = useState("");
  const [feedback, setFeedback] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  const state = useMemo(() => replayToStep(document, step), [document, step]);
  const filteredEvents = useMemo(() => document.events
    .map((event, index) => ({ event, index }))
    .filter(item => !filter || item.event.type.includes(filter)), [document, filter]);

  const importReplay = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parseReplayDocument(await file.text());
      setDocument(parsed);
      setStep(parsed.events.length);
      setFeedback(`已载入Replay：${parsed.metadata.title}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Replay载入失败");
    }
  };

  const exportReplay = () => {
    const blob = new Blob([serializeReplayDocument(document)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `grail-conquest-replay-${document.finalFingerprint}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadIntoGame = () => {
    gameEngine.restore(document.finalState, document.events, document.initialState);
    props.onClose();
  };

  return (
    <main className="replay-shell">
      <header className="replay-header">
        <div>
          <p className="eyebrow">DEVELOPER REPLAY INSPECTOR</p>
          <h1>{document.metadata.title}</h1>
          <p>指纹 {document.finalFingerprint} · {document.events.length} 个领域事件</p>
        </div>
        <button onClick={props.onClose}>返回游戏</button>
      </header>

      <section className="replay-toolbar">
        <label>
          <span>事件步数</span>
          <input
            type="range"
            min={0}
            max={document.events.length}
            value={step}
            onChange={event => setStep(Number(event.target.value))}
          />
          <strong>{step}/{document.events.length}</strong>
        </label>
        <input
          className="replay-filter"
          value={filter}
          onChange={event => setFilter(event.target.value)}
          placeholder="筛选事件类型，例如 campaign."
        />
        <button onClick={() => setStep(Math.max(0, step - 1))}>上一步</button>
        <button onClick={() => setStep(Math.min(document.events.length, step + 1))}>下一步</button>
        <button onClick={exportReplay}>导出JSON</button>
        <button onClick={() => inputRef.current?.click()}>导入JSON</button>
        <button onClick={loadIntoGame}>载入最终状态</button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={event => void importReplay(event.target.files?.[0])}
        />
      </section>

      {feedback && <p className="replay-feedback" role="status">{feedback}</p>}

      <section className="replay-grid">
        <aside className="replay-events">
          <div className="section-title"><h2>事件流</h2><span>{filteredEvents.length}</span></div>
          <ol>
            {filteredEvents.map(({ event, index }) => (
              <li key={`${event.sequence}-${index}`} className={index < step ? "applied" : "pending"}>
                <button onClick={() => setStep(index + 1)}>
                  <span>#{event.sequence}</span>
                  <code>{event.type}</code>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <section className="replay-state">
          <div className="section-title"><h2>状态快照</h2><span>STEP {step}</span></div>
          <div className="replay-state-cards">
            <article><span>模式</span><strong>{state.mode}</strong></article>
            <article><span>路线</span><strong>{state.campaign.routeId ?? "未选择"}</strong></article>
            <article><span>夜数</span><strong>{state.campaign.currentNight}/{state.campaign.maxNights}</strong></article>
            <article><span>阶段</span><strong>{state.strategy.phase}</strong></article>
            <article><span>区域</span><strong>{state.strategy.regions[state.strategy.currentRegionId].name}</strong></article>
            <article><span>战役状态</span><strong>{state.campaign.status}</strong></article>
          </div>
          <h3>路线目标</h3>
          <ul className="replay-objectives">
            {state.campaign.objectives.map(objective => (
              <li key={objective.id} className={objective.completed ? "completed" : ""}>
                {objective.completed ? "✓" : "○"} {objective.label}
              </li>
            ))}
          </ul>
          <details>
            <summary>查看完整状态JSON</summary>
            <pre>{JSON.stringify(state, null, 2)}</pre>
          </details>
        </section>
      </section>
    </main>
  );
}

function createCurrentReplay(): ReplayDocument {
  const snapshot = gameEngine.getSnapshot();
  return createReplayDocument({
    title: snapshot.state.campaign.routeId
      ? `Grail Conquest · ${snapshot.state.campaign.routeId}`
      : "Grail Conquest · Route Selection",
    createdAt: new Date().toISOString(),
    initialState: snapshot.initialState,
    events: snapshot.eventLog,
    finalState: snapshot.state,
  });
}
