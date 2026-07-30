import type { FactionId } from "./ids";
import {
  ACTIVE_STRATEGY_FACTION_IDS,
  EMIYA_FACTION_ID,
  ENEMY_STRATEGY_FACTION_ID,
  RYOUDOU_FACTION_ID,
  STRATEGY_FACTION_ID,
  areFactionsHostile,
  findNextRegionToward,
  getEncounterIdForRegion,
  getStrategicFaction,
  shareDetection,
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

const HUNTER_PATROL: readonly RegionId[] = ["school", "harbor", "fuyuki-bridge", "shopping-street"];
const HONORABLE_PATROL: readonly RegionId[] = ["school", "fuyuki-bridge", "church", "shopping-street"];

export function createStrategicOrder(
  factionId: FactionId,
  type: StrategicOrderType,
  originRegionId: RegionId,
  destinationRegionId: RegionId,
  day: number,
): StrategicOrder {
  return { factionId, type, originRegionId, destinationRegionId, day };
}

export function createAiOrder(state: GameState, factionId: FactionId, playerOrder: StrategicOrder): StrategicOrder {
  const faction = getStrategicFaction(state, factionId);
  if (!faction) throw new Error(`Missing strategic faction ${factionId}`);
  const origin = faction.regionId;

  if (faction.aiProfile === "fortifier") {
    const threatened = playerOrder.destinationRegionId === origin;
    if (!threatened) return createStrategicOrder(factionId, "prepare_workshop", origin, origin, state.strategy.day);
    return createStrategicOrder(factionId, "ambush", origin, origin, state.strategy.day);
  }

  let target: RegionId;
  if (faction.aiProfile === "honorable") {
    target = HONORABLE_PATROL[(state.strategy.day - 1) % HONORABLE_PATROL.length] ?? "school";
    if (shareDetection(state, factionId, STRATEGY_FACTION_ID)) target = playerOrder.destinationRegionId;
  } else {
    target = HUNTER_PATROL[(state.strategy.day - 1) % HUNTER_PATROL.length] ?? "school";
    if (state.strategy.exposure >= 55) target = playerOrder.destinationRegionId;
  }

  const destination = findNextRegionToward(state.strategy.regions, origin, target);
  const type: StrategicOrderType = destination === origin ? "ambush" : "move";
  return createStrategicOrder(factionId, type, origin, destination, state.strategy.day);
}

export function createAllFactionOrders(
  state: GameState,
  playerOrder: StrategicOrder,
): Readonly<Record<string, StrategicOrder>> {
  const orders: Record<string, StrategicOrder> = { [STRATEGY_FACTION_ID]: playerOrder };
  for (const factionId of ACTIVE_STRATEGY_FACTION_IDS) {
    if (factionId === STRATEGY_FACTION_ID) continue;
    const faction = getStrategicFaction(state, factionId);
    if (!faction || faction.status !== "active") continue;
    orders[factionId] = createAiOrder(state, factionId, playerOrder);
  }
  return orders;
}

export function createEnemyOrder(state: GameState, playerOrder: StrategicOrder): StrategicOrder {
  return createAiOrder(state, ENEMY_STRATEGY_FACTION_ID, playerOrder);
}

export function getContactRegion(firstOrder: StrategicOrder, secondOrder: StrategicOrder): RegionId | undefined {
  if (firstOrder.destinationRegionId === secondOrder.destinationRegionId) return firstOrder.destinationRegionId;
  const crossed = firstOrder.destinationRegionId === secondOrder.originRegionId &&
    secondOrder.destinationRegionId === firstOrder.originRegionId;
  return crossed ? firstOrder.destinationRegionId : undefined;
}

export interface ContactGroup {
  readonly regionId: RegionId;
  readonly factionIds: readonly FactionId[];
}

export function createContactGroups(orders: Readonly<Record<string, StrategicOrder>>): readonly ContactGroup[] {
  const groups = new Map<string, Set<FactionId>>();
  const orderList = Object.values(orders).sort((a, b) => String(a.factionId).localeCompare(String(b.factionId)));

  for (const order of orderList) {
    const key = `region:${order.destinationRegionId}`;
    const set = groups.get(key) ?? new Set<FactionId>();
    set.add(order.factionId);
    groups.set(key, set);
  }

  for (let left = 0; left < orderList.length; left += 1) {
    for (let right = left + 1; right < orderList.length; right += 1) {
      const first = orderList[left];
      const second = orderList[right];
      if (!first || !second) continue;
      const crossed = first.destinationRegionId === second.originRegionId &&
        second.destinationRegionId === first.originRegionId &&
        first.destinationRegionId !== first.originRegionId;
      if (!crossed) continue;
      const key = `cross:${[String(first.factionId), String(second.factionId)].sort().join(":")}:${first.destinationRegionId}`;
      groups.set(key, new Set([first.factionId, second.factionId]));
    }
  }

  const result: ContactGroup[] = [];
  for (const [key, factionIds] of groups) {
    if (factionIds.size < 2) continue;
    const factionList = [...factionIds].sort((a, b) => String(a).localeCompare(String(b)));
    const firstOrder = orders[factionList[0] ?? ""];
    if (!firstOrder) continue;
    const regionId = key.startsWith("region:")
      ? firstOrder.destinationRegionId
      : firstOrder.destinationRegionId;
    result.push({ regionId, factionIds: factionList });
  }
  return result.sort((a, b) => a.regionId.localeCompare(b.regionId));
}

export function classifyDetection(firstDetected: boolean, secondDetected: boolean): DetectionOutcome {
  if (firstDetected && secondDetected) return "mutual";
  if (firstDetected) return "player_only";
  if (secondDetected) return "enemy_only";
  return "missed";
}

export function resolveFactionDetection(
  state: GameState,
  firstOrder: StrategicOrder,
  secondOrder: StrategicOrder,
  regionId: RegionId,
): OperationDetection {
  const firstFaction = getStrategicFaction(state, firstOrder.factionId);
  const secondFaction = getStrategicFaction(state, secondOrder.factionId);
  if (!firstFaction || !secondFaction) throw new Error("Missing faction during detection");

  const firstIntel = Math.min(20, firstFaction.resources.intelligence + firstFaction.knownIntel.length * 3);
  const secondIntel = Math.min(20, secondFaction.resources.intelligence + secondFaction.knownIntel.length * 3);
  const firstScore = clampScore(58 + Math.floor(secondFaction.exposure * 0.3) + firstIntel + actionDetectionBonus(firstOrder.type) - actionStealthBonus(secondOrder.type));
  const secondScore = clampScore(58 + Math.floor(firstFaction.exposure * 0.3) + secondIntel + actionDetectionBonus(secondOrder.type) - actionStealthBonus(firstOrder.type));
  const firstRoll = deterministicRoll(state.strategy.operationSeed, `${state.strategy.day}:${regionId}:${firstOrder.factionId}:${secondOrder.factionId}`);
  const secondRoll = deterministicRoll(state.strategy.operationSeed, `${state.strategy.day}:${regionId}:${secondOrder.factionId}:${firstOrder.factionId}`);
  const firstDetectedSecond = firstRoll <= firstScore;
  const secondDetectedFirst = secondRoll <= secondScore;

  const playerIsFirst = firstOrder.factionId === STRATEGY_FACTION_ID;
  const playerIsSecond = secondOrder.factionId === STRATEGY_FACTION_ID;
  const playerScore = playerIsFirst ? firstScore : playerIsSecond ? secondScore : firstScore;
  const enemyScore = playerIsFirst ? secondScore : playerIsSecond ? firstScore : secondScore;
  const playerRoll = playerIsFirst ? firstRoll : playerIsSecond ? secondRoll : firstRoll;
  const enemyRoll = playerIsFirst ? secondRoll : playerIsSecond ? firstRoll : secondRoll;

  return {
    regionId,
    outcome: classifyDetection(firstDetectedSecond, secondDetectedFirst),
    playerScore,
    enemyScore,
    playerRoll,
    enemyRoll,
    firstFactionId: firstOrder.factionId,
    secondFactionId: secondOrder.factionId,
    firstDetectedSecond,
    secondDetectedFirst,
  };
}

export function resolveOperationDetection(
  state: GameState,
  playerOrder: StrategicOrder,
  enemyOrder: StrategicOrder,
  regionId: RegionId,
): OperationDetection {
  return resolveFactionDetection(state, playerOrder, enemyOrder, regionId);
}

export function createMultiPartyEncounter(
  state: GameState,
  group: ContactGroup,
  orders: Readonly<Record<string, StrategicOrder>>,
  detections: readonly OperationDetection[],
): StrategyEncounterQueueItem | undefined {
  const hostilePairs: string[] = [];
  for (let left = 0; left < group.factionIds.length; left += 1) {
    for (let right = left + 1; right < group.factionIds.length; right += 1) {
      const first = group.factionIds[left];
      const second = group.factionIds[right];
      if (first && second && areFactionsHostile(state, first, second)) {
        hostilePairs.push([String(first), String(second)].sort().join("::"));
      }
    }
  }
  if (hostilePairs.length === 0) return undefined;

  const playerInvolved = group.factionIds.includes(STRATEGY_FACTION_ID);
  const playerOrder = orders[STRATEGY_FACTION_ID];
  let playerDetectedHostile = false;
  let hostileDetectedPlayer = false;
  for (const detection of detections) {
    const first = detection.firstFactionId;
    const second = detection.secondFactionId;
    if (!first || !second) continue;
    if (first === STRATEGY_FACTION_ID && areFactionsHostile(state, first, second)) {
      playerDetectedHostile ||= Boolean(detection.firstDetectedSecond);
      hostileDetectedPlayer ||= Boolean(detection.secondDetectedFirst);
    } else if (second === STRATEGY_FACTION_ID && areFactionsHostile(state, first, second)) {
      playerDetectedHostile ||= Boolean(detection.secondDetectedFirst);
      hostileDetectedPlayer ||= Boolean(detection.firstDetectedSecond);
    }
  }

  if (playerInvolved && !playerDetectedHostile && !hostileDetectedPlayer) {
    const alliedDetection = group.factionIds.some(factionId =>
      factionId !== STRATEGY_FACTION_ID && shareDetection(state, factionId, STRATEGY_FACTION_ID) &&
      detections.some(item =>
        (item.firstFactionId === factionId && item.firstDetectedSecond) ||
        (item.secondFactionId === factionId && item.secondDetectedFirst),
      ),
    );
    playerDetectedHostile = alliedDetection;
  }

  if (playerInvolved && !playerDetectedHostile && !hostileDetectedPlayer) return undefined;

  let advantage: EncounterAdvantage = "none";
  let advantagedFactionId: FactionId | undefined;
  if (playerInvolved && playerDetectedHostile && !hostileDetectedPlayer) {
    advantage = "player";
    advantagedFactionId = STRATEGY_FACTION_ID;
  } else if (playerInvolved && hostileDetectedPlayer && !playerDetectedHostile) {
    advantage = "enemy";
    advantagedFactionId = group.factionIds.find(id => id !== STRATEGY_FACTION_ID && areFactionsHostile(state, id, STRATEGY_FACTION_ID));
  } else if (playerOrder?.type === "ambush") {
    advantage = "player";
    advantagedFactionId = STRATEGY_FACTION_ID;
  }

  return {
    id: `night-${state.strategy.day}-${group.regionId}-${group.factionIds.map(String).join("-")}`,
    encounterId: getEncounterIdForRegion(group.regionId),
    regionId: group.regionId,
    detection: playerDetectedHostile && hostileDetectedPlayer ? "mutual" : playerDetectedHostile ? "player_only" : hostileDetectedPlayer ? "enemy_only" : "mutual",
    advantage,
    mandatory: !playerInvolved || hostileDetectedPlayer,
    participantFactionIds: group.factionIds,
    hostilePairs,
    ...(advantagedFactionId ? { advantagedFactionId } : {}),
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
    participantFactionIds: [playerOrder.factionId, enemyOrder.factionId],
    hostilePairs: [[String(playerOrder.factionId), String(enemyOrder.factionId)].sort().join("::")],
    ...(advantage === "player" ? { advantagedFactionId: playerOrder.factionId } : advantage === "enemy" ? { advantagedFactionId: enemyOrder.factionId } : {}),
  };
}

export function determineAdvantage(outcome: DetectionOutcome, playerOrderType: StrategicOrderType, enemyOrderType: StrategicOrderType): EncounterAdvantage {
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

export { EMIYA_FACTION_ID, ENEMY_STRATEGY_FACTION_ID, RYOUDOU_FACTION_ID };
