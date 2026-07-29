import { applyAllEvent } from "./apply-all-event";
import type { AllDomainEvent } from "./all-events";
import { isStrategyDomainEvent } from "./all-events";
import type { AllGameCommand, AbilityGameCommand, GameCommand } from "./commands";
import type { DomainError } from "./errors";
import type { DomainEvent as TacticalDomainEvent } from "./events";
import type { StrategyGameCommand } from "./strategy-commands";
import type { GameState } from "./state";
import { executeAbilityCommand } from "./ability-engine";
import { normalizeCombatEvents } from "./combat-event-normalizer";
import { executeCommand } from "./execute-command";
import { evaluateScenarioTriggers } from "./scenario";
import { executeStrategyCommand } from "./strategy-engine";

export type ProcessCommandResult =
  | {
      readonly ok: true;
      readonly state: GameState;
      readonly events: readonly AllDomainEvent[];
    }
  | {
      readonly ok: false;
      readonly state: GameState;
      readonly events: readonly [];
      readonly error: DomainError;
    };

export function processCommand(
  state: GameState,
  command: AllGameCommand,
): ProcessCommandResult {
  if (isStrategyCommand(command)) {
    const execution = executeStrategyCommand(state, command);
    if (!execution.ok) return failed(state, execution.error);
    return finalize(state, execution.events);
  }

  if (state.mode === "strategy" && command.type !== "scenario.begin_encounter") {
    return failed(state, {
      code: "strategy_not_active",
      message: "Enter a discovered encounter before issuing tactical commands",
    });
  }

  if (state.mode === "strategy" && command.type === "scenario.begin_encounter") {
    return finalize(state, [
      {
        type: "strategy.encounter_entered",
        sequence: state.sequence + 1,
        encounterId: "school-night",
      },
      {
        type: "scenario.encounter_started",
        sequence: state.sequence + 2,
        scenarioId: "school-night",
      },
    ]);
  }

  const execution = isAbilityCommand(command)
    ? executeAbilityCommand(state, command)
    : executeCommand(state, command);

  if (!execution.ok) return failed(state, execution.error);

  const normalized = normalizeCombatEvents(state, execution.events);
  return finalize(state, normalized.events, normalized.state);
}

function finalize(
  before: GameState,
  baseEvents: readonly AllDomainEvent[],
  preReducedState?: GameState,
): ProcessCommandResult {
  const commandState = preReducedState ?? baseEvents.reduce(applyAllEvent, before);
  const tacticalEvents = baseEvents.filter(
    (event): event is TacticalDomainEvent => !isStrategyDomainEvent(event),
  );
  const scenarioEvents = evaluateScenarioTriggers(before, commandState, tacticalEvents);
  let state = scenarioEvents.reduce(applyAllEvent, commandState);
  const events: AllDomainEvent[] = [...baseEvents, ...scenarioEvents];

  if (
    state.mode === "battle" &&
    state.scenario.phase === "completed" &&
    state.scenario.outcome &&
    state.scenario.report
  ) {
    const returned: AllDomainEvent = {
      type: "strategy.returned",
      sequence: state.sequence + 1,
      encounterId: "school-night",
      outcome: state.scenario.outcome,
      report: state.scenario.report,
    };
    state = applyAllEvent(state, returned);
    events.push(returned);
  }

  return { ok: true, state, events };
}

function failed(state: GameState, error: DomainError): ProcessCommandResult {
  return { ok: false, state, events: [], error };
}

function isAbilityCommand(command: AllGameCommand): command is AbilityGameCommand {
  return command.type.startsWith("ability.") || command.type.startsWith("noble_phantasm.");
}

function isStrategyCommand(command: AllGameCommand): command is StrategyGameCommand {
  return command.type.startsWith("strategy.");
}

export type LegacyGameCommand = GameCommand;
