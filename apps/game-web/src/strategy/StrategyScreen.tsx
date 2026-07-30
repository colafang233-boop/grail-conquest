import { getCampaignRoute, getPlayerFactionId } from "@grail/core";
import { useGameSnapshot } from "../hooks/useGameSnapshot";
import { StrategyCanvas } from "./StrategyCanvas";
import { StrategyPanel } from "./StrategyPanel";
import "./strategy.css";
import "./factions.css";
import "./campaign-progress.css";

export function StrategyScreen() {
  const state = useGameSnapshot().state;
  const route = state.campaign.routeId ? getCampaignRoute(state.campaign.routeId) : undefined;
  const playerFactionId = getPlayerFactionId(state);
  const playerFaction = state.strategy.factions[playerFactionId];

  return (
    <main className="strategy-shell">
      <section className="strategy-stage">
        <header className="topbar">
          <div>
            <p className="eyebrow">第 {state.campaign.currentNight}/{state.campaign.maxNights} 夜 · {route?.title}</p>
            <h1>Grail Conquest</h1>
          </div>
          <div className="prototype-badge">CAMPAIGN SLICE 0.9</div>
        </header>

        <div className="mission-strip">
          <span className="mission-dot" />
          <div>
            <strong>{playerFaction?.name ?? "玩家阵营"} · 三夜目标</strong>
            <p>{route?.description ?? "选择命令、控制外交关系，并在三夜结束前完成路线目标。"}</p>
          </div>
        </div>

        <StrategyCanvas />

        <div className="strategy-legend">
          <span><i className="current" />当前玩家</span>
          <span><i className="ally" />已知盟友</span>
          <span><i className="enemy" />已知敌对</span>
          <span><i className="caster" />其他阵营</span>
          <span><i className="planned" />计划路线</span>
          <span><i className="danger" />多方遭遇</span>
          <span><i className="unknown" />战争迷雾</span>
        </div>
      </section>
      <StrategyPanel />
    </main>
  );
}
