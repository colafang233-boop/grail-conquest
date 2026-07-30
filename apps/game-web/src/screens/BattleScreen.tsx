import { getEncounterDefinition } from "@grail/core";
import { BattlePanel } from "../components/BattlePanel";
import { GameCanvas } from "../components/GameCanvas";
import { ScenarioOverlay } from "../ScenarioOverlay";
import { useGameSnapshot } from "../hooks/useGameSnapshot";

export function BattleScreen(props: { readonly onOpenReplay: () => void; readonly onOpenSettings: () => void }) {
  const snapshot = useGameSnapshot();
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
          <div className="prototype-badge">BROWSER PRE‑ALPHA 1.0</div>
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
      <nav className="developer-tool-stack" aria-label="浏览器工具">
        <button onClick={props.onOpenReplay} aria-keyshortcuts="R">Replay</button>
        <button onClick={props.onOpenSettings} aria-keyshortcuts="S">设置</button>
      </nav>
    </main>
  );
}
