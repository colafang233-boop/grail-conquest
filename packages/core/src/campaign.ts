import type { AllDomainEvent } from "./all-events";
import type { FactionId } from "./ids";
import {
  EMIYA_FACTION_ID,
  RYOUDOU_FACTION_ID,
  STRATEGY_FACTION_ID,
  getStrategicFaction,
} from "./strategy";
import type {
  CampaignObjectiveProgress,
  CampaignResult,
  CampaignRouteId,
  CampaignState,
  GameState,
} from "./state";

export interface CampaignObjectiveDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly evaluate: (state: GameState) => boolean;
}

export interface CampaignRouteDefinition {
  readonly id: CampaignRouteId;
  readonly playerFactionId: FactionId;
  readonly title: string;
  readonly description: string;
  readonly objectives: readonly CampaignObjectiveDefinition[];
}

const survives = (state: GameState): boolean => {
  const player = getSelectedPlayerFaction(state);
  if (!player) return false;
  const master = state.battle.units[player.masterUnitId];
  return Boolean(
    master && !master.defeated &&
    player.servantUnitIds.some(unitId => !state.battle.units[unitId]?.defeated),
  );
};

export const CAMPAIGN_ROUTE_DEFINITIONS: Readonly<Record<CampaignRouteId, CampaignRouteDefinition>> = {
  "tohsaka-route": {
    id: "tohsaka-route",
    playerFactionId: STRATEGY_FACTION_ID,
    title: "远坂路线 · 真名追猎",
    description: "依靠情报、投影与有限令咒，在三夜内识破并压制主要威胁。",
    objectives: [
      {
        id: "tohsaka-intel",
        label: "真名推理",
        description: "取得至少两条英灵身份线索。",
        evaluate: state => state.scenario.clues.length >= 2,
      },
      {
        id: "tohsaka-seal",
        label: "保留令咒",
        description: "战役结束时至少保留一划令咒。",
        evaluate: state => (state.battle.contracts[STRATEGY_FACTION_ID]?.commandSeals ?? 0) >= 1,
      },
      {
        id: "tohsaka-survive",
        label: "契约存续",
        description: "凛与Archer存活至第三夜结束。",
        evaluate: survives,
      },
    ],
  },
  "emiya-route": {
    id: "emiya-route",
    playerFactionId: EMIYA_FACTION_ID,
    title: "卫宫路线 · 守护誓约",
    description: "保护Master、争取可信盟友，并让Saber撑过三夜战争。",
    objectives: [
      {
        id: "emiya-diplomacy",
        label: "共同战线",
        description: "与至少一个阵营达成停战或联盟。",
        evaluate: state => Object.values(state.strategy.diplomacy).some(
          relation =>
            (relation.firstFactionId === EMIYA_FACTION_ID || relation.secondFactionId === EMIYA_FACTION_ID) &&
            (relation.status === "truce" || relation.status === "allied"),
        ),
      },
      {
        id: "emiya-encounter",
        label: "直面战争",
        description: "至少完成一场遭遇。",
        evaluate: state => state.strategy.completedEncounterIds.length >= 1,
      },
      {
        id: "emiya-survive",
        label: "誓约未断",
        description: "士郎与Saber存活至第三夜结束。",
        evaluate: survives,
      },
    ],
  },
  "ryudou-route": {
    id: "ryudou-route",
    playerFactionId: RYOUDOU_FACTION_ID,
    title: "柳洞寺路线 · 工房支配",
    description: "强化柳洞寺工房、控制灵脉，并维持Caster阵营的存在。",
    objectives: [
      {
        id: "ryudou-workshop",
        label: "大工房",
        description: "将柳洞寺工房提升至三级。",
        evaluate: state => (state.strategy.factions[RYOUDOU_FACTION_ID]?.workshopLevel ?? 0) >= 3,
      },
      {
        id: "ryudou-leyline",
        label: "地脉支配",
        description: "确保柳洞寺灵脉由己方控制。",
        evaluate: state => state.strategy.regions["ryudou-temple"].controlledBy === RYOUDOU_FACTION_ID,
      },
      {
        id: "ryudou-survive",
        label: "阵地存续",
        description: "宗一郎与Caster存活至第三夜结束。",
        evaluate: survives,
      },
    ],
  },
};

export function createInitialCampaignState(started = true): CampaignState {
  const route = CAMPAIGN_ROUTE_DEFINITIONS["tohsaka-route"];
  return started
    ? {
        id: "three-night-war",
        status: "active",
        routeId: route.id,
        selectedPlayerFactionId: route.playerFactionId,
        currentNight: 1,
        maxNights: 3,
        objectives: route.objectives.map(toProgress),
        flags: {},
        consequences: [],
      }
    : {
        id: "three-night-war",
        status: "not_started",
        currentNight: 1,
        maxNights: 3,
        objectives: [],
        flags: {},
        consequences: [],
      };
}

export function getCampaignRoute(routeId: CampaignRouteId): CampaignRouteDefinition {
  return CAMPAIGN_ROUTE_DEFINITIONS[routeId];
}

export function getRouteForFaction(factionId: FactionId): CampaignRouteDefinition | undefined {
  return Object.values(CAMPAIGN_ROUTE_DEFINITIONS).find(route => route.playerFactionId === factionId);
}

export function getSelectedPlayerFaction(state: GameState) {
  const selected = state.campaign.selectedPlayerFactionId ?? STRATEGY_FACTION_ID;
  return state.strategy.factions[selected];
}

export function evaluateCampaignProgress(
  before: GameState,
  after: GameState,
): readonly AllDomainEvent[] {
  if (after.campaign.status !== "active" || !after.campaign.routeId) return [];
  const route = getCampaignRoute(after.campaign.routeId);
  let sequence = after.sequence;
  const events: AllDomainEvent[] = [];
  const completed = new Set(after.campaign.objectives.filter(item => item.completed).map(item => item.id));

  for (const objective of route.objectives) {
    if (!completed.has(objective.id) && objective.evaluate(after)) {
      events.push({
        type: "campaign.objective_completed",
        sequence: ++sequence,
        objectiveId: objective.id,
      });
    }
  }

  const nextNight = Math.min(after.campaign.maxNights, after.strategy.day);
  if (nextNight !== after.campaign.currentNight) {
    events.push({ type: "campaign.night_advanced", sequence: ++sequence, night: nextNight });
  }

  const selected = getSelectedPlayerFaction(after);
  const selectedMaster = selected ? after.battle.units[selected.masterUnitId] : undefined;
  const selectedServants = selected?.servantUnitIds.map(id => after.battle.units[id]).filter(Boolean) ?? [];
  const partyDefeated = !selectedMaster || selectedMaster.defeated || selectedServants.every(unit => unit?.defeated);
  const campaignFinished = after.strategy.day > after.campaign.maxNights || partyDefeated;

  if (campaignFinished) {
    const completedAfter = new Set([
      ...completed,
      ...events
        .filter((event): event is Extract<AllDomainEvent, { type: "campaign.objective_completed" }> => event.type === "campaign.objective_completed")
        .map(event => event.objectiveId),
    ]);
    const result = createCampaignResult(route, completedAfter.size, partyDefeated);
    events.push({ type: "campaign.completed", sequence: ++sequence, result });
  }

  return events;
}

function createCampaignResult(
  route: CampaignRouteDefinition,
  completedObjectives: number,
  partyDefeated: boolean,
): CampaignResult {
  if (partyDefeated) {
    return {
      outcome: "defeat",
      title: `${route.title} · 契约断绝`,
      summary: "Master–Servant核心战力在三夜结束前失去行动能力。",
      score: completedObjectives * 25,
    };
  }
  if (completedObjectives >= 2) {
    return {
      outcome: "victory",
      title: `${route.title} · 战役胜利`,
      summary: `完成${completedObjectives}/3项路线目标，并从三夜战争中存续。`,
      score: 60 + completedObjectives * 10,
    };
  }
  return {
    outcome: "partial",
    title: `${route.title} · 未竟之战`,
    summary: `完成${completedObjectives}/3项路线目标，阵营仍然存活，但未建立决定性优势。`,
    score: 30 + completedObjectives * 15,
  };
}

function toProgress(definition: CampaignObjectiveDefinition): CampaignObjectiveProgress {
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    completed: false,
    failed: false,
  };
}
