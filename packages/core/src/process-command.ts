import type { GameCommand } from "./commands";
import type { DomainError } from "./errors";
import type { DomainEvent } from "./events";
import type { GameState } from "./state";
import { applyEvent } from "./apply-event";
import { executeCommand } from "./execute-command";

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

  return {
    ok: true,
    state: execution.events.reduce(applyEvent, state),
    events: execution.events,
  };
}
