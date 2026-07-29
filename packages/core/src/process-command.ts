import type { AllGameCommand, AbilityGameCommand, GameCommand } from "./commands";
import type { DomainError } from "./errors";
import type { DomainEvent } from "./events";
import type { GameState } from "./state";
import { applyEvent } from "./apply-event";
import { executeAbilityCommand } from "./ability-engine";
import { normalizeCombatEvents } from "./combat-event-normalizer";
import { executeCommand } from "./execute-command";
import { evaluateScenarioTriggers } from "./scenario";

export type ProcessCommandResult =
  | {
      readonly ok: true;
      readonly state: GameState;
      readonly events: readonly DomainEvent[];
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
  const execution = isAbilityCommand(command)
    ? executeAbilityCommand(state, command)
    : executeCommand(state, command);

  if (!execution.ok) {
    return {
      ok: false,
      state,
      events: [],
      error: execution.error,
    };
  }

  const normalized = normalizeCombatEvents(state, execution.events);
  const scenarioEvents = evaluateScenarioTriggers(state, normalized.state, normalized.events);
  const allEvents = [...normalized.events, ...scenarioEvents];

  return {
    ok: true,
    state: scenarioEvents.reduce(applyEvent, normalized.state),
    events: allEvents,
  };
}

function isAbilityCommand(command: AllGameCommand): command is AbilityGameCommand {
  return command.type.startsWith("ability.") || command.type.startsWith("noble_phantasm.");
}

export type LegacyGameCommand = GameCommand;
