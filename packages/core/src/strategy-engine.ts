import type { AllDomainEvent } from "./all-events";
import type { DomainError } from "./errors";
import type { StrategyGameCommand } from "./strategy-commands";
import {
  getControlledLeylineRegions,
  getCurrentStrategyRegion,
  isSafeRestRegion,
  STRATEGY_FACTION_ID,
  STRATEGY_MASTER_ID,
  STRATEGY_SERVANT_ID,
} from "./strategy";
import type { GameState } from "./state";

export type StrategyCommandResult =
  | { readonly ok: true; readonly events: readonly AllDomainEvent[] }
  | { readonly ok: false; readonly error: DomainError };

export function executeStrategyCommand(
  state: GameState,
  command: StrategyGameCommand,
): StrategyCommandResult {
  if (state.mode !== "strategy") {
    return failure("strategy_not_active", "Return to the Fuyuki map before issuing strategic orders");
  }

  switch (command.type) {
    case "strategy.move_region":
      return executeMove(state, command.destinationId);
    case "strategy.investigate":
      return executeInvestigate(state);
    case "strategy.control_leyline":
      return executeControlLeyline(state);
    case "strategy.rest":
      return executeRest(state);
    case "strategy.end_day":
      return executeEndDay(state);
    case "strategy.enter_encounter":
      return executeEnterEncounter(state);
    default:
      return assertNever(command);
  }
}

function executeMove(
  state: GameState,
  destinationId: GameState["strategy"]["currentRegionId"],
): StrategyCommandResult {
  if (state.strategy.actionPoints < 1) {
    return failure("strategy_action_points_exhausted", "No strategic action points remain today");
  }
  const current = getCurrentStrategyRegion(state);
  const destination = state.strategy.regions[destinationId];
  if (!current.connections.includes(destinationId)) {
    return failure("strategy_region_not_connected", `${destination.name} is not connected to ${current.name}`);
  }

  let sequence = state.sequence;
  const events: AllDomainEvent[] = [
    { type: "strategy.action_points_spent", sequence: ++sequence, amount: 1 },
    { type: "strategy.region_moved", sequence: ++sequence, from: current.id, to: destination.id },
  ];
  if (!destination.discovered) {
    events.push({ type: "strategy.region_discovered", sequence: ++sequence, regionId: destination.id });
  }
  events.push({
    type: "strategy.exposure_changed",
    sequence: ++sequence,
    exposure: Math.min(100, state.strategy.exposure + 5),
  });
  return { ok: true, events };
}

function executeInvestigate(state: GameState): StrategyCommandResult {
  if (state.strategy.actionPoints < 1) {
    return failure("strategy_action_points_exhausted", "No strategic action points remain today");
  }
  const current = getCurrentStrategyRegion(state);
  if (!current.discovered) {
    return failure("strategy_region_not_discovered", "This region has not been discovered");
  }
  if (current.investigated) {
    return failure("strategy_region_already_investigated", `${current.name} has already been investigated`);
  }

  let sequence = state.sequence;
  const events: AllDomainEvent[] = [
    { type: "strategy.action_points_spent", sequence: ++sequence, amount: 1 },
    { type: "strategy.region_investigated", sequence: ++sequence, regionId: current.id },
    {
      type: "strategy.exposure_changed",
      sequence: ++sequence,
      exposure: Math.min(100, state.strategy.exposure + 8),
    },
  ];

  if (
    current.encounterId === "school-night" &&
    !state.strategy.completedEncounterIds.includes("school-night")
  ) {
    events.push({
      type: "strategy.encounter_prepared",
      sequence: ++sequence,
      encounterId: "school-night",
      regionId: current.id,
    });
  }
  return { ok: true, events };
}

function executeControlLeyline(state: GameState): StrategyCommandResult {
  if (state.strategy.actionPoints < 2) {
    return failure("strategy_action_points_exhausted", "Controlling a leyline requires 2 action points");
  }
  const current = getCurrentStrategyRegion(state);
  if (current.leylineStrength <= 0) {
    return failure("strategy_leyline_unavailable", `${current.name} has no controllable leyline`);
  }
  if (current.controlledBy === STRATEGY_FACTION_ID) {
    return failure("strategy_leyline_already_controlled", `${current.name} is already controlled`);
  }

  let sequence = state.sequence;
  return {
    ok: true,
    events: [
      { type: "strategy.action_points_spent", sequence: ++sequence, amount: 2 },
      {
        type: "strategy.leyline_controlled",
        sequence: ++sequence,
        regionId: current.id,
        factionId: STRATEGY_FACTION_ID,
      },
      {
        type: "strategy.exposure_changed",
        sequence: ++sequence,
        exposure: Math.min(100, state.strategy.exposure + 12),
      },
    ],
  };
}

function executeRest(state: GameState): StrategyCommandResult {
  if (state.strategy.actionPoints < 1) {
    return failure("strategy_action_points_exhausted", "No strategic action points remain today");
  }
  const current = getCurrentStrategyRegion(state);
  if (!isSafeRestRegion(current.id)) {
    return failure("strategy_rest_unavailable", "Rest is only safe at the Tohsaka residence or the church");
  }
  const master = state.battle.units[STRATEGY_MASTER_ID];
  const servant = state.battle.units[STRATEGY_SERVANT_ID];
  if (!master || !servant) {
    return failure("unit_not_found", "The active Master–Servant pair is missing");
  }

  let sequence = state.sequence;
  return {
    ok: true,
    events: [
      { type: "strategy.action_points_spent", sequence: ++sequence, amount: 1 },
      {
        type: "strategy.rested",
        sequence: ++sequence,
        masterId: master.id,
        servantId: servant.id,
        healthRestored: 12,
        masterManaRestored: 20,
        servantManaRestored: 15,
      },
      {
        type: "strategy.exposure_changed",
        sequence: ++sequence,
        exposure: Math.max(0, state.strategy.exposure - 8),
      },
    ],
  };
}

function executeEndDay(state: GameState): StrategyCommandResult {
  const controlled = getControlledLeylineRegions(state);
  const power = controlled.reduce((sum, region) => sum + region.leylineStrength, 0);
  let sequence = state.sequence;
  const events: AllDomainEvent[] = [];

  if (power > 0) {
    events.push({
      type: "strategy.mana_income",
      sequence: ++sequence,
      masterId: STRATEGY_MASTER_ID,
      servantId: STRATEGY_SERVANT_ID,
      masterAmount: power * 5,
      servantAmount: power * 8,
      sourceRegionIds: controlled.map(region => region.id),
    });
  }
  events.push(
    {
      type: "strategy.exposure_changed",
      sequence: ++sequence,
      exposure: Math.max(0, state.strategy.exposure - 10),
    },
    {
      type: "strategy.day_advanced",
      sequence: ++sequence,
      day: state.strategy.day + 1,
      actionPoints: state.strategy.maxActionPoints,
    },
  );
  return { ok: true, events };
}

function executeEnterEncounter(state: GameState): StrategyCommandResult {
  if (
    state.strategy.pendingEncounterId !== "school-night" ||
    state.strategy.currentRegionId !== "school"
  ) {
    return failure("strategy_encounter_unavailable", "Investigate the school before entering the encounter");
  }

  let sequence = state.sequence;
  return {
    ok: true,
    events: [
      {
        type: "strategy.encounter_entered",
        sequence: ++sequence,
        encounterId: "school-night",
      },
      {
        type: "scenario.encounter_started",
        sequence: ++sequence,
        scenarioId: "school-night",
      },
    ],
  };
}

function failure(code: DomainError["code"], message: string): StrategyCommandResult {
  return { ok: false, error: { code, message } };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled strategic command: ${JSON.stringify(value)}`);
}
