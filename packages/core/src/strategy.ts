import { factionId, unitId } from "./ids";
import type { GameState, RegionId, StrategyRegionState, StrategyState } from "./state";

export const STRATEGY_MASTER_ID = unitId("rin");
export const STRATEGY_SERVANT_ID = unitId("archer");
export const STRATEGY_FACTION_ID = factionId("tohsaka");

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
    }),
    harbor: region({
      id: "harbor",
      name: "港口仓库",
      x: 505,
      y: 315,
      connections: ["shopping-street", "fuyuki-bridge", "church"],
      leylineStrength: 2,
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
    exposure: 0,
    objective: "前往穗群原学园调查异常魔力，并在保全战力的前提下带回敌方情报。",
    regions,
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

export function isSafeRestRegion(regionId: RegionId): boolean {
  return regionId === "tohsaka-residence" || regionId === "church";
}
