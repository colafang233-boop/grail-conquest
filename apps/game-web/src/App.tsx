import { lazy, Suspense, useEffect, useState } from "react";
import { CampaignEndingScreen, NewGameScreen } from "./campaign/CampaignScreens";
import { gameEngine } from "./game-engine";
import { useGameSnapshot } from "./hooks/useGameSnapshot";
import { useScenarioController } from "./useScenarioController";
import type { GameState } from "@grail/core";
import "./scenario.css";

const StrategyScreen = lazy(() => import("./strategy/StrategyScreen").then(module => ({ default: module.StrategyScreen })));
const BattleScreen = lazy(() => import("./screens/BattleScreen").then(module => ({ default: module.BattleScreen })));
const ReplayInspector = lazy(() => import("./replay/ReplayInspector").then(module => ({ default: module.ReplayInspector })));
const ScenarioEditor = lazy(() => import("./editor/ScenarioEditor").then(module => ({ default: module.ScenarioEditor })));
const BrowserSettingsPanel = lazy(() => import("./settings/BrowserSettingsPanel").then(module => ({ default: module.BrowserSettingsPanel })));

type BrowserTool = "replay" | "editor" | "settings";

interface PreviewReturnPoint {
  readonly state: GameState;
  readonly initialState: GameState;
  readonly eventLog: ReturnType<typeof gameEngine.getSnapshot>["eventLog"];
}

export default function App() {
  useScenarioController();
  const snapshot = useGameSnapshot();
  const [tool, setTool] = useState<BrowserTool>();
  const [previewReturn, setPreviewReturn] = useState<PreviewReturnPoint>();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === "Escape") setTool(undefined);
      if (event.key.toLowerCase() === "r") setTool("replay");
      if (event.key.toLowerCase() === "e" && snapshot.state.campaign.status === "active") setTool("editor");
      if (event.key.toLowerCase() === "s") setTool("settings");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [snapshot.state.campaign.status]);

  const launchPreview = (state: GameState) => {
    const current = gameEngine.getSnapshot();
    setPreviewReturn({ state: current.state, initialState: current.initialState, eventLog: current.eventLog });
    gameEngine.reset(state);
    setTool(undefined);
  };

  const restorePreview = () => {
    if (!previewReturn) return;
    gameEngine.restore(previewReturn.state, previewReturn.eventLog, previewReturn.initialState);
    setPreviewReturn(undefined);
  };

  if (tool) {
    return (
      <Suspense fallback={<LoadingScreen label="加载浏览器工具…" />}>
        {tool === "replay" && <ReplayInspector onClose={() => setTool(undefined)} />}
        {tool === "editor" && <ScenarioEditor onClose={() => setTool(undefined)} onLaunchPreview={launchPreview} />}
        {tool === "settings" && <BrowserSettingsPanel onClose={() => setTool(undefined)} />}
      </Suspense>
    );
  }

  const toolNav = (
    <nav className="developer-tool-stack" aria-label="浏览器工具">
      {snapshot.state.campaign.status === "active" && <button onClick={() => setTool("editor")} aria-keyshortcuts="E">编辑器</button>}
      {snapshot.state.campaign.status !== "not_started" && <button onClick={() => setTool("replay")} aria-keyshortcuts="R">Replay</button>}
      <button onClick={() => setTool("settings")} aria-keyshortcuts="S">设置</button>
    </nav>
  );

  if (snapshot.state.campaign.status === "not_started" || snapshot.state.mode === "setup") {
    return <><NewGameScreen />{toolNav}</>;
  }
  if (snapshot.state.campaign.status === "completed") {
    return <><CampaignEndingScreen onOpenReplay={() => setTool("replay")} />{toolNav}</>;
  }

  return (
    <Suspense fallback={<LoadingScreen label="加载游戏引擎…" />}>
      {snapshot.state.mode === "strategy"
        ? <><StrategyScreen />{toolNav}</>
        : <BattleScreen onOpenReplay={() => setTool("replay")} onOpenSettings={() => setTool("settings")} />}
      {previewReturn && <button className="preview-return-button" onClick={restorePreview}>退出场景试玩 · 恢复战役</button>}
    </Suspense>
  );
}

function LoadingScreen(props: { readonly label: string }) {
  return (
    <main className="loading-screen" role="status" aria-live="polite">
      <div className="loading-sigil">GC</div>
      <p>{props.label}</p>
    </main>
  );
}
