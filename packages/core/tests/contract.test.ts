import { describe, expect, it } from "vitest";
import {
  ARCHER_UNIT_ID,
  LANCER_UNIT_ID,
  RIN_UNIT_ID,
  SCHOOL_BATTLE_ID,
  TOHSAKA_FACTION_ID,
  calculateDamage,
  createSchoolBattleState,
  processCommand,
} from "../src";

describe("Master–Servant contracts", () => {
  it("lets a nearby Servant intercept an attack against the Master", () => {
    const initial = createSchoolBattleState();
    const threatened = {
      ...initial,
      battle: {
        ...initial.battle,
        activeUnitId: LANCER_UNIT_ID,
        units: {
          ...initial.battle.units,
          [LANCER_UNIT_ID]: {
            ...initial.battle.units[LANCER_UNIT_ID]!,
            position: { q: 1, r: 4 },
          },
        },
      },
    };

    const result = processCommand(threatened, {
      type: "battle.attack_unit",
      battleId: SCHOOL_BATTLE_ID,
      attackerId: LANCER_UNIT_ID,
      targetId: RIN_UNIT_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.battle.units[RIN_UNIT_ID]?.health).toBe(60);
    expect(result.state.battle.units[ARCHER_UNIT_ID]?.health).toBe(94);
    expect(result.state.battle.units[ARCHER_UNIT_ID]?.reactionAvailable).toBe(false);
    expect(result.events.map(event => event.type)).toContain("contract.master_guarded");
  });

  it("allows the Master to transfer mana within contract range", () => {
    const initial = createSchoolBattleState();
    const lowMana = {
      ...initial,
      battle: {
        ...initial.battle,
        activeUnitId: RIN_UNIT_ID,
        units: {
          ...initial.battle.units,
          [ARCHER_UNIT_ID]: {
            ...initial.battle.units[ARCHER_UNIT_ID]!,
            mana: 10,
            lowMana: true,
          },
        },
      },
    };

    const result = processCommand(lowMana, {
      type: "contract.transfer_mana",
      battleId: SCHOOL_BATTLE_ID,
      factionId: TOHSAKA_FACTION_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.battle.units[RIN_UNIT_ID]?.mana).toBe(65);
    expect(result.state.battle.units[RIN_UNIT_ID]?.mainActionAvailable).toBe(false);
    expect(result.state.battle.units[ARCHER_UNIT_ID]?.mana).toBe(35);
    expect(result.state.battle.units[ARCHER_UNIT_ID]?.lowMana).toBe(false);
  });

  it("charges upkeep at a new round and applies the low-mana damage penalty", () => {
    const initial = createSchoolBattleState();
    const beforeUpkeep = {
      ...initial,
      battle: {
        ...initial.battle,
        activeUnitId: RIN_UNIT_ID,
        units: {
          ...initial.battle.units,
          [ARCHER_UNIT_ID]: {
            ...initial.battle.units[ARCHER_UNIT_ID]!,
            mana: 35,
          },
        },
      },
    };

    const result = processCommand(beforeUpkeep, {
      type: "battle.end_turn",
      battleId: SCHOOL_BATTLE_ID,
      unitId: RIN_UNIT_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const archer = result.state.battle.units[ARCHER_UNIT_ID]!;
    const lancer = result.state.battle.units[LANCER_UNIT_ID]!;
    expect(result.state.battle.round).toBe(2);
    expect(archer.mana).toBe(23);
    expect(archer.lowMana).toBe(true);
    expect(calculateDamage(archer, lancer)).toBe(11);
  });

  it("recalls the Servant beside the Master with one command seal", () => {
    const result = processCommand(createSchoolBattleState(), {
      type: "contract.use_command_seal",
      battleId: SCHOOL_BATTLE_ID,
      factionId: TOHSAKA_FACTION_ID,
      effect: "recall",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contract = result.state.battle.contracts[TOHSAKA_FACTION_ID]!;
    expect(contract.commandSeals).toBe(2);
    expect(result.events.map(event => event.type)).toEqual([
      "contract.command_seal_used",
      "contract.servant_recalled",
    ]);
  });

  it("grants Archer a fresh turn through an extra-turn command seal", () => {
    const initial = createSchoolBattleState();
    const spent = {
      ...initial,
      battle: {
        ...initial.battle,
        activeUnitId: LANCER_UNIT_ID,
        units: {
          ...initial.battle.units,
          [ARCHER_UNIT_ID]: {
            ...initial.battle.units[ARCHER_UNIT_ID]!,
            remainingMovement: 0,
            mainActionAvailable: false,
            reactionAvailable: false,
          },
        },
      },
    };

    const result = processCommand(spent, {
      type: "contract.use_command_seal",
      battleId: SCHOOL_BATTLE_ID,
      factionId: TOHSAKA_FACTION_ID,
      effect: "extra_turn",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const archer = result.state.battle.units[ARCHER_UNIT_ID]!;
    expect(result.state.battle.activeUnitId).toBe(ARCHER_UNIT_ID);
    expect(archer.remainingMovement).toBe(archer.movement);
    expect(archer.mainActionAvailable).toBe(true);
    expect(archer.reactionAvailable).toBe(true);
  });

  it("uses Reject Death to survive one lethal hit", () => {
    const prepared = processCommand(createSchoolBattleState(), {
      type: "contract.use_command_seal",
      battleId: SCHOOL_BATTLE_ID,
      factionId: TOHSAKA_FACTION_ID,
      effect: "reject_death",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const lethal = {
      ...prepared.state,
      battle: {
        ...prepared.state.battle,
        activeUnitId: LANCER_UNIT_ID,
        units: {
          ...prepared.state.battle.units,
          [LANCER_UNIT_ID]: {
            ...prepared.state.battle.units[LANCER_UNIT_ID]!,
            position: { q: 2, r: 2 },
            attackPower: 999,
          },
          [ARCHER_UNIT_ID]: {
            ...prepared.state.battle.units[ARCHER_UNIT_ID]!,
            reactionAvailable: false,
          },
        },
      },
    };

    const result = processCommand(lethal, {
      type: "battle.attack_unit",
      battleId: SCHOOL_BATTLE_ID,
      attackerId: LANCER_UNIT_ID,
      targetId: ARCHER_UNIT_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const archer = result.state.battle.units[ARCHER_UNIT_ID]!;
    expect(archer.health).toBe(1);
    expect(archer.defeated).toBe(false);
    expect(archer.deathWardActive).toBe(false);
    expect(result.events.map(event => event.type)).toContain("contract.death_rejected");
  });
});
