import type { BattleTurnAdvancedEvent, DomainEvent, UnitMovedEvent } from "./events";
import type { GameState } from "./state";

export function applyEvent(state: GameState, event: DomainEvent): GameState {
  switch (event.type) {
    case "battle.unit_moved":
      return applyUnitMoved(state, event);
    case "battle.turn_advanced":
      return applyTurnAdvanced(state, event);
    default:
      return assertNever(event);
  }
}

function applyUnitMoved(state: GameState, event: UnitMovedEvent): GameState {
  const unit = state.battle.units[event.unitId];

  if (!unit) {
    throw new Error(`Cannot move missing unit ${event.unitId}`);
  }

  return {
    ...state,
    sequence: event.sequence,
    battle: {
      ...state.battle,
      units: {
        ...state.battle.units,
        [unit.id]: {
          ...unit,
          position: event.to,
          remainingMovement: unit.remainingMovement - event.movementSpent,
        },
      },
    },
  };
}

function applyTurnAdvanced(state: GameState, event: BattleTurnAdvancedEvent): GameState {
  const nextUnit = state.battle.units[event.activeUnitId];

  if (!nextUnit) {
    throw new Error(`Cannot activate missing unit ${event.activeUnitId}`);
  }

  return {
    ...state,
    sequence: event.sequence,
    battle: {
      ...state.battle,
      round: event.round,
      activeUnitId: event.activeUnitId,
      units: {
        ...state.battle.units,
        [nextUnit.id]: {
          ...nextUnit,
          remainingMovement: nextUnit.movement,
        },
      },
    },
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event: ${JSON.stringify(value)}`);
}
