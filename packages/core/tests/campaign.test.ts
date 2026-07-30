import { describe, expect, it } from "vitest";
import {
  EMIYA_FACTION_ID,
  RYOUDOU_FACTION_ID,
  STRATEGY_FACTION_ID,
  createNewGameState,
  createSchoolBattleState,
  processCommand,
  type CampaignRouteId,
  type GameState,
} from "../src";

function start(routeId: CampaignRouteId): GameState {
  const result = processCommand(createNewGameState(), { type: "campaign.start", routeId });
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

describe("three-night campaign", () => {
  it("starts in route selection without an active campaign", () => {
    const state = createNewGameState();
    expect(state.schemaVersion).toBe(5);
    expect(state.mode).toBe("setup");
    expect(state.campaign.status).toBe("not_started");
  });

  it.each([
    ["tohsaka-route", STRATEGY_FACTION_ID, "tohsaka-residence"],
    ["emiya-route", EMIYA_FACTION_ID, "emiya-residence"],
    ["ryudou-route", RYOUDOU_FACTION_ID, "ryudou-temple"],
  ] as const)("starts %s with its faction and home region", (routeId, factionId, regionId) => {
    const state = start(routeId);
    expect(state.mode).toBe("strategy");
    expect(state.campaign.routeId).toBe(routeId);
    expect(state.campaign.selectedPlayerFactionId).toBe(factionId);
    expect(state.strategy.currentRegionId).toBe(regionId);
    expect(state.strategy.factions[factionId]?.aiProfile).toBe("player");
    expect(state.campaign.objectives).toHaveLength(3);
  });

  it("does not complete survival or seal objectives before the ending", () => {
    const state = start("tohsaka-route");
    expect(state.campaign.objectives.every(objective => !objective.completed)).toBe(true);
  });

  it("completes the Tohsaka route after the third night", () => {
    const initial = createSchoolBattleState();
    const lateCampaign: GameState = {
      ...initial,
      strategy: { ...initial.strategy, day: 4, phase: "planning" },
      campaign: { ...initial.campaign, currentNight: 3 },
    };
    const result = processCommand(lateCampaign, {
      type: "operations.submit_order",
      orderType: "ambush",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.campaign.status).toBe("completed");
    expect(result.state.campaign.result?.outcome).toBe("victory");
    expect(result.state.campaign.objectives.filter(item => item.completed).map(item => item.id)).toEqual(
      expect.arrayContaining(["tohsaka-seal", "tohsaka-survive"]),
    );
  });
});
