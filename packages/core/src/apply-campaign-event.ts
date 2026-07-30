import { createInitialCampaignState, getCampaignRoute } from "./campaign";
import type { CampaignDomainEvent } from "./campaign-events";
import {
  ENEMY_STRATEGY_FACTION_ID,
  STRATEGY_FACTION_ID,
} from "./strategy";
import type { GameState, StrategicFactionState } from "./state";

export function applyCampaignEvent(
  state: GameState,
  event: CampaignDomainEvent,
): GameState {
  switch (event.type) {
    case "campaign.started":
      return applyCampaignStarted(state, event);
    case "campaign.objective_completed":
      return {
        ...state,
        sequence: event.sequence,
        campaign: {
          ...state.campaign,
          objectives: state.campaign.objectives.map(objective =>
            objective.id === event.objectiveId
              ? { ...objective, completed: true }
              : objective,
          ),
        },
      };
    case "campaign.night_advanced":
      return {
        ...state,
        sequence: event.sequence,
        campaign: { ...state.campaign, currentNight: event.night },
      };
    case "campaign.consequence_added":
      return {
        ...state,
        sequence: event.sequence,
        campaign: {
          ...state.campaign,
          consequences: [...state.campaign.consequences, event.consequence],
        },
      };
    case "campaign.completed":
      return {
        ...state,
        sequence: event.sequence,
        campaign: {
          ...state.campaign,
          status: "completed",
          result: event.result,
        },
      };
  }
}

function applyCampaignStarted(
  state: GameState,
  event: Extract<CampaignDomainEvent, { type: "campaign.started" }>,
): GameState {
  const route = getCampaignRoute(event.routeId);
  const selectedFaction = state.strategy.factions[event.playerFactionId];
  if (!selectedFaction) throw new Error(`Missing campaign faction ${event.playerFactionId}`);

  const factions: Record<string, StrategicFactionState> = {};
  for (const faction of Object.values(state.strategy.factions)) {
    const { order: _order, knownRegionId: _knownRegionId, ...withoutTransient } = faction;
    const aiProfile = faction.id === event.playerFactionId
      ? "player"
      : faction.id === STRATEGY_FACTION_ID
        ? "honorable"
        : faction.id === ENEMY_STRATEGY_FACTION_ID
          ? "hunter"
          : faction.aiProfile === "player"
            ? "honorable"
            : faction.aiProfile;
    factions[faction.id] = {
      ...withoutTransient,
      aiProfile,
      exposure: 0,
      status: "active",
      knownIntel: [],
    };
  }

  const homeRegion = state.strategy.regions[selectedFaction.regionId];
  const regions = {
    ...state.strategy.regions,
    [homeRegion.id]: { ...homeRegion, discovered: true, investigated: true },
  };

  return {
    ...state,
    sequence: event.sequence,
    mode: "strategy",
    campaign: {
      ...createInitialCampaignState(true),
      routeId: route.id,
      selectedPlayerFactionId: route.playerFactionId,
      objectives: route.objectives.map(objective => ({
        id: objective.id,
        label: objective.label,
        description: objective.description,
        completed: false,
        failed: false,
      })),
    },
    strategy: {
      ...state.strategy,
      day: 1,
      actionPoints: state.strategy.maxActionPoints,
      currentRegionId: selectedFaction.regionId,
      exposure: 0,
      objective: route.description,
      regions,
      phase: "planning",
      factions,
      allianceOffers: [],
      encounterQueue: [],
      activeParticipantFactionIds: [],
      resolutionTimeline: [],
      lastDetections: [],
      operationSeed: 0x5f3759df,
      workshopPrepared: false,
      completedEncounterIds: [],
    },
  };
}
