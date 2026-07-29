import type { GameCommand } from "./commands";
import type { DomainError } from "./errors";
import type { DomainEvent } from "./events";
import type { GameState } from "./state";
import { applyEvent } from "./apply-event";
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
  command: GameCommand,
): ProcessCommandResult {
  const execution = executeCommand(state, command);

  if (!execution.ok) {
    return {
      ok: false,
      state,
      events: [],
      error: execution.error,
    };
  }

  const commandState = execution.events.reduce(applyEvent, state);
  const scenarioEvents = evaluateScenarioTriggers(state, commandState, execution.events);
  const allEvents = [...execution.events, ...scenarioEvents];

  return {
    ok: true,
    state: scenarioEvents.reduce(applyEvent, commandState),
    events: allEvents,
  };
}
