import { factionId, unitId } from "./ids";
import type {
  DiplomacyRelation,
  DiplomacyStatus,
  EncounterAdvantage,
  EncounterId,
  GameState,
  RegionId,
  StrategicFactionState,
  StrategyRegionState,
  StrategyState,
} from "./state";

export const STRATEGY_MASTER_ID = unitId("rin");
export const STRATEGY_SERVANT_ID = unitId("archer");
export const STRATEGY_FACTION_ID = factionId("tohsaka");
export const ENEMY_STRATEGY_FACTION_ID = factionId("lancer-faction");
export const EMIYA_FACTION_ID = factionId("emiya");
export const RYOUDOU_FACTION_ID = factionId("ryudou");

export const SHIROU_UNIT_ID = unitId("shirou");
export const SABER_UNIT_ID = unitId("saber");
export const SOUICHIROU_UNIT_ID = unitId("souichirou");
export const CASTER_UNIT_ID = unitId("caster");
export const ASSASSIN_UNIT_ID = unitId("assassin");

export const ACTIVE_STRATEGY_FACTION_IDS = [
  STRATEGY_FACTION_ID,
  ENEMY_STRATEGY_FACTION_ID,
  EMIYA_FACTION_ID,
  RYOUDOU_FACTION_ID,
] as const;

export interface EncounterDefinition {
  readonly id: EncounterId;
  readonly title: string;
  readonly subtitle: string;
  readonly objective: string;
  readonly regionId: RegionId;
  readonly playerStart: { readonly q: number; readonly r: number };
  readonly enemyStart: { readonly q: number; readonly r: number };
}

export const ENCOUNTER_DEFINITIONS: Readonly<Record<EncounterId, EncounterDefinition>> = {
  "school-night": {
    id: "school-night",
    title: "穗群原学园夜战",
    subtitle: "异常结界 · 身份调查",
    objective: "在复杂接触中保全Master，并识别敌方从者能力。",
    regionId: "school",
    playerStart: { q: 1, r: 2 },
    enemyStart: { q: 6, r: 2 },
  },
  "bridge-duel": {
    id: "bridge-duel",
    title: "冬木大桥多方对峙",
    subtitle: "狭长战线 · 临时同盟",
    objective: "利用关系状态控制交战对象，避免被两支阵营同时夹击。",
    regionId: "fuyuki-bridge",
    playerStart: { q: 1, r: 1 },
    enemyStart: { q: 6, r: 3 },
  },
  "harbor-clash": {
    id: "harbor-clash",
    title: "港口仓库混战",
    subtitle: "障碍地形 · 三方接触",
    objective: "在多方混战中选择攻击目标，并保留撤离路线。",
    regionId: "harbor",
    playerStart: { q: 1, r: 4 },
    enemyStart: { q: 6, r: 1 },
  },
  "ryudou-siege": {
    id: "ryudou-siege",
    title: "柳洞寺工房攻防",
    subtitle: "结界阵地 · Assassin守门",
    objective: "突破Caster工房和Assassin防线，或迫使其接受停战条件。",
    regionId: "ryudou-temple",
    playerStart: { q: 1, r: 3 },
    enemyStart: { q: 6, r: 2 },
  },
};

const region = (
  definition: Omit<StrategyRegionState, "discovered" | "investigated"> &
    Partial<Pick<StrategyRegionState, "discovered" | "investigated">>,
): StrategyRegionState => ({ discovered: false, investigated: false, ...definition });

const faction = (
  definition: Omit<StrategicFactionState, "knownIntel" | "resources" | "status" | "order"> &
    Partial<Pick<StrategicFactionState, "knownIntel" | "resources" | "status">>,
): StrategicFactionState => ({
  status: "active",
  knownIntel: [],
  resources: { manaReserve: 0, intelligence: 0 },
  ...definition,
});

export function diplomacyKey(firstFactionId: string, secondFactionId: string): string {
  return [String(firstFactionId), String(secondFactionId)].sort().join("::");
}

function relation(
  firstFactionId: StrategicFactionState["id"],
  secondFactionId: StrategicFactionState["id"],
  status: DiplomacyStatus,
): DiplomacyRelation {
  return {
    id: diplomacyKey(firstFactionId, secondFactionId),
    firstFactionId,
    secondFactionId,
    status,
    sharedDetection: status === "allied",
    betrayalCount: 0,
  };
}

export function createInitialStrategyState(): StrategyState {
  const regions: Record<RegionId, StrategyRegionState> = {
    "tohsaka-residence": region({
      id: "tohsaka-residence", name: "远坂宅", x: 85, y: 145,
      connections: ["school", "shopping-street"], leylineStrength: 2,
      discovered: true, investigated: true, controlledBy: STRATEGY_FACTION_ID,
    }),
    "emiya-residence": region({
      id: "emiya-residence", name: "卫宫宅", x: 105, y: 315,
      connections: ["school", "shopping-street"], leylineStrength: 1, discovered: true,
    }),
    school: region({
      id: "school", name: "穗群原学园", x: 280, y: 105,
      connections: ["tohsaka-residence", "emiya-residence", "shopping-street", "fuyuki-bridge", "ryudou-temple"],
      leylineStrength: 1, discovered: true, encounterId: "school-night",
    }),
    "shopping-street": region({
      id: "shopping-street", name: "商店街", x: 285, y: 270,
      connections: ["tohsaka-residence", "emiya-residence", "school", "fuyuki-bridge", "harbor"],
      leylineStrength: 1, discovered: true,
    }),
    "fuyuki-bridge": region({
      id: "fuyuki-bridge", name: "冬木大桥", x: 480, y: 160,
      connections: ["school", "shopping-street", "harbor", "church"],
      leylineStrength: 2, encounterId: "bridge-duel",
    }),
    harbor: region({
      id: "harbor", name: "港口仓库", x: 500, y: 320,
      connections: ["shopping-street", "fuyuki-bridge", "church"],
      leylineStrength: 2, encounterId: "harbor-clash",
    }),
    church: region({
      id: "church", name: "冬木教会", x: 665, y: 225,
      connections: ["fuyuki-bridge", "harbor", "ryudou-temple"], leylineStrength: 3,
    }),
    "ryudou-temple": region({
      id: "ryudou-temple", name: "柳洞寺", x: 655, y: 65,
      connections: ["school", "church"], leylineStrength: 3,
      encounterId: "ryudou-siege", controlledBy: RYOUDOU_FACTION_ID,
    }),
  };

  const factions: Record<string, StrategicFactionState> = {
    [STRATEGY_FACTION_ID]: faction({
      id: STRATEGY_FACTION_ID, name: "远坂阵营", masterUnitId: STRATEGY_MASTER_ID,
      servantUnitIds: [STRATEGY_SERVANT_ID], regionId: "tohsaka-residence",
      exposure: 0, aiProfile: "player", workshopLevel: 1,
    }),
    [ENEMY_STRATEGY_FACTION_ID]: faction({
      id: ENEMY_STRATEGY_FACTION_ID, name: "Lancer阵营", masterUnitId: unitId("lancer-master"),
      servantUnitIds: [unitId("lancer")], regionId: "fuyuki-bridge",
      exposure: 25, aiProfile: "hunter", workshopLevel: 0,
    }),
    [EMIYA_FACTION_ID]: faction({
      id: EMIYA_FACTION_ID, name: "卫宫阵营", masterUnitId: SHIROU_UNIT_ID,
      servantUnitIds: [SABER_UNIT_ID], regionId: "emiya-residence",
      exposure: 8, aiProfile: "honorable", workshopLevel: 0,
    }),
    [RYOUDOU_FACTION_ID]: faction({
      id: RYOUDOU_FACTION_ID, name: "柳洞寺阵营", masterUnitId: SOUICHIROU_UNIT_ID,
      servantUnitIds: [CASTER_UNIT_ID, ASSASSIN_UNIT_ID], regionId: "ryudou-temple",
      exposure: 18, aiProfile: "fortifier", workshopLevel: 2,
      resources: { manaReserve: 30, intelligence: 10 },
    }),
  };

  const diplomacy: Record<string, DiplomacyRelation> = {};
  for (const item of [
    relation(STRATEGY_FACTION_ID, ENEMY_STRATEGY_FACTION_ID, "hostile"),
    relation(STRATEGY_FACTION_ID, EMIYA_FACTION_ID, "neutral"),
    relation(STRATEGY_FACTION_ID, RYOUDOU_FACTION_ID, "hostile"),
    relation(EMIYA_FACTION_ID, ENEMY_STRATEGY_FACTION_ID, "hostile"),
    relation(EMIYA_FACTION_ID, RYOUDOU_FACTION_ID, "neutral"),
    relation(ENEMY_STRATEGY_FACTION_ID, RYOUDOU_FACTION_ID, "hostile"),
  ]) diplomacy[item.id] = item;

  return {
    day: 1,
    actionPoints: 3,
    maxActionPoints: 3,
    currentRegionId: "tohsaka-residence",
    enemyRegionId: "fuyuki-bridge",
    exposure: 0,
    enemyExposure: 25,
    objective: "选择本夜行动，并判断是否与卫宫阵营建立临时合作。",
    regions,
    phase: "planning",
    factions,
    diplomacy,
    allianceOffers: [],
    encounterQueue: [],
    activeParticipantFactionIds: [],
    resolutionTimeline: [],
    lastDetections: [],
    operationSeed: 0x5f3759df,
    workshopPrepared: false,
    completedEncounterIds: [],
  };
}

export function getCurrentStrategyRegion(state: GameState): StrategyRegionState {
  return state.strategy.regions[state.strategy.currentRegionId];
}

export function getStrategicFaction(state: GameState, factionId: string): StrategicFactionState | undefined {
  return state.strategy.factions[factionId];
}

export function getDiplomacyRelation(state: GameState, firstFactionId: string, secondFactionId: string): DiplomacyRelation | undefined {
  return state.strategy.diplomacy[diplomacyKey(firstFactionId, secondFactionId)];
}

export function areFactionsHostile(state: GameState, firstFactionId: string, secondFactionId: string): boolean {
  const status = getDiplomacyRelation(state, firstFactionId, secondFactionId)?.status ?? "neutral";
  return status === "hostile" || status === "betrayed";
}

export function shareDetection(state: GameState, firstFactionId: string, secondFactionId: string): boolean {
  const relationState = getDiplomacyRelation(state, firstFactionId, secondFactionId);
  return Boolean(relationState?.sharedDetection && (relationState.status === "allied" || relationState.status === "truce"));
}

export function getControlledLeylineRegions(state: GameState): readonly StrategyRegionState[] {
  return Object.values(state.strategy.regions)
    .filter(regionState => regionState.controlledBy === STRATEGY_FACTION_ID)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function getEncounterDefinition(encounterId: EncounterId): EncounterDefinition {
  return ENCOUNTER_DEFINITIONS[encounterId];
}

export function getEncounterIdForRegion(regionId: RegionId): EncounterId {
  if (regionId === "school") return "school-night";
  if (regionId === "harbor") return "harbor-clash";
  if (regionId === "ryudou-temple") return "ryudou-siege";
  return "bridge-duel";
}

export function getEncounterAdvantageLabel(advantage: EncounterAdvantage): string {
  if (advantage === "player") return "我方先制";
  if (advantage === "enemy") return "敌方伏击";
  return "正面遭遇";
}

export function isSafeRestRegion(regionId: RegionId): boolean {
  return regionId === "tohsaka-residence" || regionId === "emiya-residence" || regionId === "church";
}

export function findNextRegionToward(
  regions: StrategyState["regions"],
  from: RegionId,
  target: RegionId,
): RegionId {
  if (from === target) return from;
  const visited = new Set<RegionId>([from]);
  const queue: Array<{ readonly regionId: RegionId; readonly firstStep: RegionId }> = [];
  for (const neighbor of [...regions[from].connections].sort()) {
    queue.push({ regionId: neighbor, firstStep: neighbor });
    visited.add(neighbor);
  }
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.regionId === target) return current.firstStep;
    for (const neighbor of [...regions[current.regionId].connections].sort()) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push({ regionId: neighbor, firstStep: current.firstStep });
    }
  }
  return from;
}
