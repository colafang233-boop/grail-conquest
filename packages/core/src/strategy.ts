import { factionId, unitId } from "./ids";
import type {
  EncounterAdvantage,
  EncounterId,
  GameState,
  RegionId,
  StrategyRegionState,
  StrategyState,
} from "./state";

export const STRATEGY_MASTER_ID = unitId("rin");
export const STRATEGY_SERVANT_ID = unitId("archer");
export const STRATEGY_FACTION_ID = factionId("tohsaka");
export const ENEMY_STRATEGY_FACTION_ID = factionId("lancer-faction");

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
    subtitle: "异常结界 · 未知 Lancer",
    objective: "保全 Master，识别敌方宝具并带回有效情报。",
    regionId: "school",
    playerStart: { q: 1, r: 2 },
    enemyStart: { q: 6, r: 2 },
  },
  "bridge-duel": {
    id: "bridge-duel",
    title: "冬木大桥决斗",
    subtitle: "狭长战线 · 正面遭遇",
    objective: "利用桥面距离控制阻止 Lancer 接近 Master。",
    regionId: "fuyuki-bridge",
    playerStart: { q: 1, r: 3 },
    enemyStart: { q: 6, r: 2 },
  },
  "harbor-clash": {
    id: "harbor-clash",
    title: "港口仓库冲突",
    subtitle: "集装箱区 · 伏击风险",
    objective: "利用障碍与投影武装打断敌方宝具准备。",
    regionId: "harbor",
    playerStart: { q: 1, r: 1 },
    enemyStart: { q: 6, r: 4 },
  },
};

const region = (
  definition: Omit<StrategyRegionState, "discovered" | "investigated"> &
    Partial<Pick<StrategyRegionState, "discovered" | "investigated">>,
): StrategyRegionState => ({
  discovered: false,
  investigated: false,
  ...definition,
});

export function createInitialStrategyState(): StrategyState {
  const regions: Record<RegionId, StrategyRegionState> = {
    "tohsaka-residence": region({
      id: "tohsaka-residence",
      name: "远坂宅",
      x: 110,
      y: 170,
      connections: ["school", "shopping-street"],
      leylineStrength: 2,
      discovered: true,
      investigated: true,
      controlledBy: STRATEGY_FACTION_ID,
    }),
    school: region({
      id: "school",
      name: "穗群原学园",
      x: 310,
      y: 105,
      connections: ["tohsaka-residence", "shopping-street", "fuyuki-bridge"],
      leylineStrength: 1,
      discovered: true,
      encounterId: "school-night",
    }),
    "shopping-street": region({
      id: "shopping-street",
      name: "商店街",
      x: 300,
      y: 260,
      connections: ["tohsaka-residence", "school", "fuyuki-bridge", "harbor"],
      leylineStrength: 1,
      discovered: true,
    }),
    "fuyuki-bridge": region({
      id: "fuyuki-bridge",
      name: "冬木大桥",
      x: 500,
      y: 175,
      connections: ["school", "shopping-street", "harbor", "church"],
      leylineStrength: 2,
      encounterId: "bridge-duel",
    }),
    harbor: region({
      id: "harbor",
      name: "港口仓库",
      x: 505,
      y: 315,
      connections: ["shopping-street", "fuyuki-bridge", "church"],
      leylineStrength: 2,
      encounterId: "harbor-clash",
    }),
    church: region({
      id: "church",
      name: "冬木教会",
      x: 685,
      y: 225,
      connections: ["fuyuki-bridge", "harbor"],
      leylineStrength: 3,
    }),
  };

  return {
    day: 1,
    actionPoints: 3,
    maxActionPoints: 3,
    currentRegionId: "tohsaka-residence",
    enemyRegionId: "fuyuki-bridge",
    exposure: 0,
    enemyExposure: 25,
    objective: "为今晚选择一个行动。敌方命令将在计划锁定后秘密生成。",
    regions,
    phase: "planning",
    encounterQueue: [],
    resolutionTimeline: [],
    operationSeed: 0x5f3759df,
    workshopPrepared: false,
    completedEncounterIds: [],
  };
}

export function getCurrentStrategyRegion(state: GameState): StrategyRegionState {
  return state.strategy.regions[state.strategy.currentRegionId];
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
  return "bridge-duel";
}

export function getEncounterAdvantageLabel(advantage: EncounterAdvantage): string {
  if (advantage === "player") return "我方先制";
  if (advantage === "enemy") return "敌方伏击";
  return "正面遭遇";
}

export function isSafeRestRegion(regionId: RegionId): boolean {
  return regionId === "tohsaka-residence" || regionId === "church";
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
