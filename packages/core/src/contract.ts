import { getHexNeighbors, hexDistance, hexKey, type HexCoord } from "./hex";
import type { FactionId, UnitId } from "./ids";
import type { BattleState, BattleUnitState, ContractState } from "./state";

export function getContractByFaction(
  battle: BattleState,
  factionId: FactionId,
): ContractState | undefined {
  return battle.contracts[factionId];
}

export function getContractForUnit(
  battle: BattleState,
  unitId: UnitId,
): ContractState | undefined {
  return Object.values(battle.contracts).find(
    contract => contract.masterId === unitId || contract.servantId === unitId,
  );
}

export function findGuardingServant(
  battle: BattleState,
  master: BattleUnitState,
): BattleUnitState | undefined {
  if (master.role !== "master") return undefined;
  const contract = getContractByFaction(battle, master.factionId);
  if (!contract || contract.masterId !== master.id) return undefined;
  const servant = battle.units[contract.servantId];
  if (!servant || servant.defeated || !servant.reactionAvailable) return undefined;
  return hexDistance(master.position, servant.position) <= contract.guardRange + servant.guardBonus
    ? servant
    : undefined;
}

export function findRecallDestination(
  battle: BattleState,
  contract: ContractState,
): HexCoord | undefined {
  const master = battle.units[contract.masterId];
  const servant = battle.units[contract.servantId];
  if (!master || !servant) return undefined;

  const occupied = new Set(
    Object.values(battle.units)
      .filter(unit => !unit.defeated && unit.id !== servant.id)
      .map(unit => hexKey(unit.position)),
  );

  return [...getHexNeighbors(master.position)]
    .filter(coord => {
      const tile = battle.tiles[hexKey(coord)];
      return Boolean(tile && !tile.blocked && !occupied.has(hexKey(coord)));
    })
    .sort((left, right) => {
      const distanceDelta = hexDistance(left, servant.position) - hexDistance(right, servant.position);
      return distanceDelta !== 0 ? distanceDelta : hexKey(left).localeCompare(hexKey(right));
    })[0];
}

export function isLowMana(unit: BattleUnitState, mana = unit.mana): boolean {
  return unit.role === "servant" && mana < Math.ceil(unit.maxMana * 0.3);
}
