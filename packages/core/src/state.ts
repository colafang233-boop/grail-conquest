import type { HexCoord } from "./hex";
import type { BattleId, FactionId, UnitId } from "./ids";

export type UnitRole = "servant" | "master" | "familiar";

export interface HexTileState {
  readonly coord: HexCoord;
  readonly movementCost: number;
  readonly blocked: boolean;
  readonly terrain: "floor" | "wall" | "rubble";
}

export interface BattleUnitState {
  readonly id: UnitId;
  readonly factionId: FactionId;
  readonly role: UnitRole;
  readonly name: string;
  readonly position: HexCoord;
  readonly health: number;
  readonly maxHealth: number;
  readonly mana: number;
  readonly maxMana: number;
  readonly movement: number;
  readonly remainingMovement: number;
}

export interface BattleState {
  readonly id: BattleId;
  readonly round: number;
  readonly activeUnitId: UnitId;
  readonly initiative: readonly UnitId[];
  readonly tiles: Readonly<Record<string, HexTileState>>;
  readonly units: Readonly<Record<string, BattleUnitState>>;
}

export interface GameState {
  readonly sequence: number;
  readonly battle: BattleState;
}
