import type { FactionId } from "./ids";
import {
  ENEMY_STRATEGY_FACTION_ID,
  STRATEGY_FACTION_ID,
  findNextRegionToward,
  getEncounterIdForRegion,
} from "./strategy";
import type {
  DetectionOutcome,
  EncounterAdvantage,
  GameState,
  OperationDetection,
  RegionId,
  StrategicOrder,
  StrategicOrderType,
  StrategyEncounterQueueItem,
} from "./state";

export const ORDER_LABELS: Readonly<Record<StrategicOrderType, string>> = {
  move: "区域移动",
  investigate: "调查",
  defend_leyline: "灵脉防卫",
  ambush: "伏击",
  rest: "休整",
  prepare_workshop: "工房准备",
};

const PATROL_TARGETS: readonly RegionId[] = [
  "school",
  "harbor",
  "fuyuki-bridge",
  "shopping-street",
];

export function createStrategicOrder(
  factionId: FactionId,
  type: StrategicOrderType,
  originRegionId: RegionId,
  destinationRegionId: RegionId,
  day: number,
): StrategicOrder {
  return { factionId, type, originRegionId, destinationRegionId, day };
}

export function createEnemyOrder(state: GameState, playerOrder: StrategicOrder): StrategicOrder {
  const origin = state.strategy.enemyRegionId;
  let target = PATROL_TARGETS[(state.strategy.day - 1) % PATROL_TARGETS.length] ?? "school";

  if (state.strategy.exposure >= 60) {
    const inferred = playerOrder.type === "move"
      ? playerOrder.destinationRegionId
      : playerOrder.originRegionId;
    target = inferred;
  }

  const destination = findNextRegionToward(state.strategy.regions, origin, target);
  const type: StrategicOrderType = destination === origin ? "ambush" : "move";
  return createStrategicOrder(
    ENEMY_STRATEGY_FACTION_ID,
    type,
    origin,
    destination,
    state.strategy.day,
  );
}

export function getContactRegion(
  playerOrder: StrategicOrder,
  enemyOrder: StrategicOrder,
): RegionId | undefined {
  if (playerOrder.destinationRegionId === enemyOrder.destinationRegionId) {
    return playerOrder.destinationRegionId;
  }
  const crossed = playerOrder.destinationRegionId === enemyOrder.originRegionId &&
    enemyOrder.destinationRegionId === playerOrder.originRegionId;
  return crossed ? playerOrder.destinationRegionId : undefined;
}

export function classifyDetection(
  playerDetected: boolean,
  enemyDetected: boolean,
): DetectionOutcome {
  if (playerDetected && enemyDetected) return "mutual";
  if (playerDetected) return "player_only";
  if (enemyDetected) return "enemy_only";
  return "missed";
}

export function resolveOperationDetection(
  state: GameState,
  playerOrder: StrategicOrder,
  enemyOrder: StrategicOrder,
  regionId: RegionId,
): OperationDetection {
  const intelBonus = Math.min(20, state.scenario.clues.length * 4);
  const playerActionBonus = actionDetectionBonus(playerOrder.type);
  const enemyActionBonus = actionDetectionBonus(enemyOrder.type);
  const playerStealth = actionStealthBonus(playerOrder.type);
  const enemyStealth = actionStealthBonus(enemyOrder.type);

  const playerScore = clampScore(
    65 + Math.floor(state.strategy.enemyExposure * 0.25) + intelBonus + playerActionBonus - enemyStealth,
  );
  const enemyScore = clampScore(
    55 + Math.floor(state.strategy.exposure * 0.35) + enemyActionBonus - playerStealth,
  );
  const playerRoll = deterministicRoll(
    state.strategy.operationSeed,
    `${state.strategy.day}:${regionId}:player`,
  );
  const enemyRoll = deterministicRoll(
    state.strategy.operationSeed,
    `${state.strategy.day}:${regionId}:enemy`,
  );

  return {
    regionId,
    outcome: classifyDetection(playerRoll <= playerScore, enemyRoll <= enemyScore),
    playerScore,
    enemyScore,
    playerRoll,
    enemyRoll,
  };
}

export function createEncounterFromDetection(
  state: GameState,
  detection: OperationDetection,
  playerOrder: StrategicOrder,
  enemyOrder: StrategicOrder,
): StrategyEncounterQueueItem | undefined {
  if (detection.outcome === "missed") return undefined;
  const advantage = determineAdvantage(detection.outcome, playerOrder.type, enemyOrder.type);
  return {
    id: `night-${state.strategy.day}-${detection.regionId}-${detection.outcome}`,
    encounterId: getEncounterIdForRegion(detection.regionId),
    regionId: detection.regionId,
    detection: detection.outcome,
    advantage,
    mandatory: detection.outcome === "mutual" || detection.outcome === "enemy_only",
  };
}

export function determineAdvantage(
  outcome: DetectionOutcome,
  playerOrderType: StrategicOrderType,
  enemyOrderType: StrategicOrderType,
): EncounterAdvantage {
  if (outcome === "player_only") return "player";
  if (outcome === "enemy_only") return "enemy";
  if (playerOrderType === "ambush" && enemyOrderType !== "ambush") return "player";
  if (enemyOrderType === "ambush" && playerOrderType !== "ambush") return "enemy";
  if (playerOrderType === "defend_leyline" && enemyOrderType === "move") return "player";
  return "none";
}

export function deterministicRoll(seed: number, key: string): number {
  let hash = (seed ^ 0x811c9dc5) >>> 0;
  for (const character of key) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash % 100) + 1;
}

export function advanceOperationSeed(seed: number): number {
  let next = seed | 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next === 0 ? 0x6d2b79f5 : next >>> 0;
}

function actionDetectionBonus(type: StrategicOrderType): number {
  switch (type) {
    case "investigate": return 20;
    case "ambush": return 25;
    case "defend_leyline": return 15;
    case "prepare_workshop": return 5;
    case "rest": return -15;
    case "move": return 0;
  }
}

function actionStealthBonus(type: StrategicOrderType): number {
  switch (type) {
    case "ambush": return 25;
    case "prepare_workshop": return 15;
    case "defend_leyline": return 10;
    case "move": return 8;
    case "investigate": return 4;
    case "rest": return 0;
  }
}

function clampScore(value: number): number {
  return Math.max(5, Math.min(95, value));
}

export function isPlayerFaction(factionId: FactionId): boolean {
  return factionId === STRATEGY_FACTION_ID;
}
