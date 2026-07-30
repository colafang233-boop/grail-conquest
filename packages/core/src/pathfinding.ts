import { getHexNeighbors, hexKey, parseHexKey, type HexCoord } from "./hex";
import type { BattleState } from "./state";
import type { UnitId } from "./ids";

export interface ReachableHex { readonly coord: HexCoord; readonly cost: number; readonly path: readonly HexCoord[]; }
interface SearchNode { readonly key: string; readonly cost: number; }

export function findReachableHexes(battle: BattleState, unitId: UnitId): Readonly<Record<string, ReachableHex>> {
  const unit = battle.units[unitId];
  if (!unit || !unit.deployed || unit.defeated) return {};
  const startKey = hexKey(unit.position);
  const occupied = new Set(Object.values(battle.units)
    .filter(candidate => candidate.deployed && candidate.id !== unitId && !candidate.defeated)
    .map(candidate => hexKey(candidate.position)));
  const costs = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<string, string>();
  const frontier: SearchNode[] = [{ key: startKey, cost: 0 }];
  while (frontier.length > 0) {
    frontier.sort((left, right) => left.cost - right.cost);
    const current = frontier.shift();
    if (!current) break;
    if (current.cost !== costs.get(current.key)) continue;
    for (const neighbor of getHexNeighbors(parseHexKey(current.key))) {
      const neighborKey = hexKey(neighbor);
      const tile = battle.tiles[neighborKey];
      if (!tile || tile.blocked || occupied.has(neighborKey)) continue;
      const nextCost = current.cost + tile.movementCost;
      if (nextCost > unit.remainingMovement) continue;
      const knownCost = costs.get(neighborKey);
      if (knownCost !== undefined && knownCost <= nextCost) continue;
      costs.set(neighborKey, nextCost);
      previous.set(neighborKey, current.key);
      frontier.push({ key: neighborKey, cost: nextCost });
    }
  }
  const reachable: Record<string, ReachableHex> = {};
  for (const [destinationKey, cost] of costs) {
    if (destinationKey === startKey) continue;
    const reversedPath: HexCoord[] = [];
    let cursor = destinationKey;
    while (cursor !== startKey) {
      reversedPath.push(parseHexKey(cursor));
      const parent = previous.get(cursor);
      if (!parent) throw new Error(`Path reconstruction failed for ${destinationKey}`);
      cursor = parent;
    }
    reachable[destinationKey] = { coord: parseHexKey(destinationKey), cost, path: reversedPath.reverse() };
  }
  return reachable;
}
