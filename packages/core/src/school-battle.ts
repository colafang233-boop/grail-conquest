import { hexKey } from "./hex";
import { battleId, factionId, unitId } from "./ids";
import { createInitialScenarioState } from "./scenario";
import type { GameState, HexTileState } from "./state";

export const SCHOOL_BATTLE_ID = battleId("school-night");
export const ARCHER_UNIT_ID = unitId("archer");
export const RIN_UNIT_ID = unitId("rin");
export const LANCER_UNIT_ID = unitId("lancer");
export const TOHSAKA_FACTION_ID = factionId("tohsaka");
export const LANCER_FACTION_ID = factionId("lancer-faction");

export function createSchoolBattleState(): GameState {
  const tiles: Record<string, HexTileState> = {};

  for (let q = 0; q < 8; q += 1) {
    for (let r = 0; r < 6; r += 1) {
      const coord = { q, r };
      const blocked =
        (q === 3 && r === 1) ||
        (q === 3 && r === 2) ||
        (q === 4 && r === 4);
      const rubble = (q === 2 && r === 3) || (q === 5 && r === 1);

      tiles[hexKey(coord)] = {
        coord,
        blocked,
        terrain: blocked ? "wall" : rubble ? "rubble" : "floor",
        movementCost: rubble ? 2 : 1,
      };
    }
  }

  return {
    schemaVersion: 1,
    sequence: 0,
    scenario: createInitialScenarioState(),
    battle: {
      id: SCHOOL_BATTLE_ID,
      round: 1,
      activeUnitId: ARCHER_UNIT_ID,
      initiative: [ARCHER_UNIT_ID, LANCER_UNIT_ID, RIN_UNIT_ID],
      tiles,
      units: {
        [ARCHER_UNIT_ID]: {
          id: ARCHER_UNIT_ID,
          factionId: TOHSAKA_FACTION_ID,
          role: "servant",
          name: "Archer",
          position: { q: 1, r: 2 },
          health: 120,
          maxHealth: 120,
          mana: 80,
          maxMana: 100,
          movement: 4,
          remainingMovement: 4,
          attackPower: 28,
          defense: 8,
          attackRange: 5,
          counterRange: 1,
          mainActionAvailable: true,
          reactionAvailable: true,
          defeated: false,
          lowMana: false,
          deathWardActive: false,
        },
        [RIN_UNIT_ID]: {
          id: RIN_UNIT_ID,
          factionId: TOHSAKA_FACTION_ID,
          role: "master",
          name: "远坂凛",
          position: { q: 0, r: 4 },
          health: 60,
          maxHealth: 60,
          mana: 90,
          maxMana: 100,
          movement: 3,
          remainingMovement: 3,
          attackPower: 16,
          defense: 4,
          attackRange: 3,
          counterRange: 1,
          mainActionAvailable: true,
          reactionAvailable: true,
          defeated: false,
          lowMana: false,
          deathWardActive: false,
        },
        [LANCER_UNIT_ID]: {
          id: LANCER_UNIT_ID,
          factionId: LANCER_FACTION_ID,
          role: "servant",
          name: "未知 Lancer",
          position: { q: 6, r: 2 },
          health: 140,
          maxHealth: 140,
          mana: 70,
          maxMana: 100,
          movement: 5,
          remainingMovement: 5,
          attackPower: 34,
          defense: 10,
          attackRange: 1,
          counterRange: 1,
          mainActionAvailable: true,
          reactionAvailable: true,
          defeated: false,
          lowMana: false,
          deathWardActive: false,
        },
      },
      contracts: {
        [TOHSAKA_FACTION_ID]: {
          factionId: TOHSAKA_FACTION_ID,
          masterId: RIN_UNIT_ID,
          servantId: ARCHER_UNIT_ID,
          commandSeals: 3,
          transferRange: 3,
          transferAmount: 25,
          guardRange: 2,
          upkeep: 12,
          trust: 42,
          stability: 100,
        },
      },
    },
  };
}
