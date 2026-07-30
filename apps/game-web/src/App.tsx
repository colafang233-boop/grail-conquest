import { getEncounterDefinition } from "@grail/core";
import { useState } from "react";
import { CampaignEndingScreen, NewGameScreen } from "./campaign/CampaignScreens";
import { BattlePanel } from "./components/BattlePanel";
import { GameCanvas } from "./components/GameCanvas";
import { ReplayInspector } from "./replay/ReplayInspector";
import { ScenarioOverlay } from "./ScenarioOverlay";
import { useGameSnapshot } from "./hooks/useGameSnapshot";
import { StrategyScreen } from "./strategy/StrategyScreen";
import { useScenarioController } from "./useScenarioController";
import "./scenario.css";

export default function App() {
  useScenarioController();
  const snapshot = useGameSnapshot();
  const [replayOpen, setReplayOpen] = useState(false);

  if (replayOpen) return <ReplayInspector onClose={() => setReplayOpen(false)} />;
  if (snapshot.state.campaign.status === "not_started" || snapshot.state.mode === "setup") return <NewGameScreen />;
  if (snapshot.state.campaign.status === "completed") {
    return <CampaignEndingScreen onOpenReplay={() => setReplayOpen(true)} />;
  }

  if (snapshot.state.mode === "strategy") {
    return (
      <>
        <StrategyScreen />
        <button className="developer-tools-button" onClick={() => setReplayOpen(true)}>Replay</button>
      </>
    );
  }

  const encounter = getEncounterDefinition(snapshot.state.strategy.activeEncounterId ?? "school-night");
  const participantCount = snapshot.state.strategy.activeParticipantFactionIds.length;

  return (
    <main className="app-shell">
      <section className="battle-stage">
        <header className="topbar">
          <div>
            <p className="eyebrow">第 {snapshot.state.campaign.currentNight} 夜 · {encounter.title} · {participantCount}方接触</p>
            <h1>Grail Conquest</h1>
          </div>
          <div className="prototype-badge">CAMPAIGN SLICE 0.9</div>
        </header>

        <div className="mission-strip">
          <span className="mission-dot" />
          <div>
            <strong>{encounter.subtitle}</strong>
            <p>{encounter.objective}</p>
          </div>
        </div>

        <div className="battlefield-wrap">
          <GameCanvas />
          <ScenarioOverlay />
        </div>
      </section>
      <BattlePanel />
      <button className="developer-tools-button" onClick={() => setReplayOpen(true)}>Replay</button>
    </main>
  );
}
