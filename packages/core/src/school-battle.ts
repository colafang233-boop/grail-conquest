import { createInitialCampaignState } from "./campaign";
import { hexKey } from "./hex";
import { battleId, factionId, unitId } from "./ids";
import { createInitialScenarioState } from "./scenario";
import {
  ASSASSIN_UNIT_ID,
  CASTER_UNIT_ID,
  EMIYA_FACTION_ID,
  RYOUDOU_FACTION_ID,
  SABER_UNIT_ID,
  SHIROU_UNIT_ID,
  SOUICHIROU_UNIT_ID,
  createInitialStrategyState,
} from "./strategy";
import type { BattleUnitState, GameState, HexTileState } from "./state";

export const SCHOOL_BATTLE_ID = battleId("school-night");
export const ARCHER_UNIT_ID = unitId("archer");
export const RIN_UNIT_ID = unitId("rin");
export const LANCER_UNIT_ID = unitId("lancer");
export const TOHSAKA_FACTION_ID = factionId("tohsaka");
export const LANCER_FACTION_ID = factionId("lancer-faction");

function baseUnit(
  definition: Omit<BattleUnitState, "remainingMovement" | "mainActionAvailable" | "reactionAvailable" | "defeated" | "deployed" | "lowMana" | "deathWardActive" | "barrier" | "guardBonus" | "battleContinuationActive"> &
    Partial<Pick<BattleUnitState, "deployed">>,
): BattleUnitState {
  return {
    ...definition,
    remainingMovement: definition.movement,
    mainActionAvailable: true,
    reactionAvailable: true,
    defeated: false,
    deployed: definition.deployed ?? false,
    lowMana: false,
    deathWardActive: false,
    barrier: 0,
    guardBonus: 0,
    battleContinuationActive: false,
  };
}

export function createSchoolBattleState(): GameState {
  const tiles: Record<string, HexTileState> = {};
  for (let q = 0; q < 8; q += 1) {
    for (let r = 0; r < 6; r += 1) {
      const coord = { q, r };
      const blocked = (q === 3 && r === 1) || (q === 3 && r === 2) || (q === 4 && r === 4);
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
    schemaVersion: 5,
    sequence: 0,
    mode: "strategy",
    campaign: createInitialCampaignState(true),
    strategy: createInitialStrategyState(),
    scenario: createInitialScenarioState(),
    battle: {
      id: SCHOOL_BATTLE_ID,
      round: 1,
      activeUnitId: ARCHER_UNIT_ID,
      initiative: [ARCHER_UNIT_ID, LANCER_UNIT_ID, RIN_UNIT_ID],
      participatingFactionIds: [TOHSAKA_FACTION_ID, LANCER_FACTION_ID],
      tiles,
      units: {
        [ARCHER_UNIT_ID]: baseUnit({
          id: ARCHER_UNIT_ID, factionId: TOHSAKA_FACTION_ID, role: "servant", name: "Archer",
          position: { q: 1, r: 2 }, health: 120, maxHealth: 120, mana: 80, maxMana: 100,
          movement: 4, attackPower: 28, defense: 8, attackRange: 5, counterRange: 1,
          abilityIds: ["archer_projected_shot", "archer_projected_shield", "archer_guard_support"],
          deployed: true,
          noblePhantasm: {
            definitionId: "archer_reality_marble", phase: "hidden", charge: 0,
            requiredCharge: 2, cooldownRemaining: 0, interruptThreshold: 18,
          },
        }),
        [RIN_UNIT_ID]: baseUnit({
          id: RIN_UNIT_ID, factionId: TOHSAKA_FACTION_ID, role: "master", name: "远坂凛",
          position: { q: 0, r: 4 }, health: 60, maxHealth: 60, mana: 90, maxMana: 100,
          movement: 3, attackPower: 16, defense: 4, attackRange: 3, counterRange: 1,
          abilityIds: [], deployed: true,
        }),
        [LANCER_UNIT_ID]: baseUnit({
          id: LANCER_UNIT_ID, factionId: LANCER_FACTION_ID, role: "servant", name: "未知 Lancer",
          position: { q: 6, r: 2 }, health: 140, maxHealth: 140, mana: 100, maxMana: 100,
          movement: 5, attackPower: 34, defense: 10, attackRange: 1, counterRange: 1,
          abilityIds: ["lancer_high_speed_thrust", "lancer_battle_continuation", "lancer_sweeping_strike"],
          deployed: true,
          noblePhantasm: {
            definitionId: "lancer_causality_spear", phase: "hidden", charge: 0,
            requiredCharge: 1, cooldownRemaining: 0, interruptThreshold: 18,
          },
        }),
        [SHIROU_UNIT_ID]: baseUnit({
          id: SHIROU_UNIT_ID, factionId: EMIYA_FACTION_ID, role: "master", name: "卫宫士郎",
          position: { q: 0, r: 5 }, health: 70, maxHealth: 70, mana: 55, maxMana: 80,
          movement: 3, attackPower: 14, defense: 5, attackRange: 2, counterRange: 1,
          abilityIds: [],
        }),
        [SABER_UNIT_ID]: baseUnit({
          id: SABER_UNIT_ID, factionId: EMIYA_FACTION_ID, role: "servant", name: "Saber",
          position: { q: 1, r: 4 }, health: 155, maxHealth: 155, mana: 72, maxMana: 110,
          movement: 5, attackPower: 37, defense: 13, attackRange: 1, counterRange: 1,
          abilityIds: ["saber_invisible_air", "saber_instinct", "saber_mana_burst"],
          noblePhantasm: {
            definitionId: "saber_excalibur", phase: "hidden", charge: 0,
            requiredCharge: 1, cooldownRemaining: 0, interruptThreshold: 20,
          },
        }),
        [SOUICHIROU_UNIT_ID]: baseUnit({
          id: SOUICHIROU_UNIT_ID, factionId: RYOUDOU_FACTION_ID, role: "master", name: "葛木宗一郎",
          position: { q: 7, r: 5 }, health: 82, maxHealth: 82, mana: 45, maxMana: 65,
          movement: 4, attackPower: 25, defense: 9, attackRange: 1, counterRange: 1,
          abilityIds: [],
        }),
        [CASTER_UNIT_ID]: baseUnit({
          id: CASTER_UNIT_ID, factionId: RYOUDOU_FACTION_ID, role: "servant", name: "Caster",
          position: { q: 6, r: 3 }, health: 108, maxHealth: 108, mana: 130, maxMana: 140,
          movement: 4, attackPower: 23, defense: 8, attackRange: 5, counterRange: 2,
          abilityIds: ["caster_dragon_tooth", "caster_boundary_field", "caster_mana_drain", "caster_workshop_reinforcement"],
          noblePhantasm: {
            definitionId: "caster_rule_breaker", phase: "hidden", charge: 0,
            requiredCharge: 1, cooldownRemaining: 0, interruptThreshold: 16,
          },
        }),
        [ASSASSIN_UNIT_ID]: baseUnit({
          id: ASSASSIN_UNIT_ID, factionId: RYOUDOU_FACTION_ID, role: "servant", name: "Assassin",
          position: { q: 7, r: 2 }, health: 98, maxHealth: 98, mana: 55, maxMana: 70,
          movement: 5, attackPower: 33, defense: 10, attackRange: 1, counterRange: 1,
          abilityIds: ["saber_instinct"],
        }),
      },
      contracts: {
        [TOHSAKA_FACTION_ID]: {
          factionId: TOHSAKA_FACTION_ID, masterId: RIN_UNIT_ID, servantId: ARCHER_UNIT_ID,
          commandSeals: 3, transferRange: 3, transferAmount: 25, guardRange: 2,
          upkeep: 12, trust: 42, stability: 100,
        },
        [EMIYA_FACTION_ID]: {
          factionId: EMIYA_FACTION_ID, masterId: SHIROU_UNIT_ID, servantId: SABER_UNIT_ID,
          commandSeals: 3, transferRange: 2, transferAmount: 18, guardRange: 2,
          upkeep: 16, trust: 58, stability: 82,
        },
        [RYOUDOU_FACTION_ID]: {
          factionId: RYOUDOU_FACTION_ID, masterId: SOUICHIROU_UNIT_ID, servantId: CASTER_UNIT_ID,
          commandSeals: 2, transferRange: 4, transferAmount: 22, guardRange: 1,
          upkeep: 14, trust: 68, stability: 95,
        },
      },
    },
  };
}

export function createNewGameState(): GameState {
  const state = createSchoolBattleState();
  return {
    ...state,
    mode: "setup",
    campaign: createInitialCampaignState(false),
  };
}
