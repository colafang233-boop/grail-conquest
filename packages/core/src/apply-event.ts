import type {
  AttackStartedEvent,
  BattleTurnAdvancedEvent,
  DamageDealtEvent,
  DomainEvent,
  MainActionSpentEvent,
  ReactionSpentEvent,
  UnitDefeatedEvent,
  UnitMovedEvent,
} from "./events";
import type { GameState } from "./state";

export function applyEvent(state: GameState, event: DomainEvent): GameState {
  switch (event.type) {
    case "battle.unit_moved":
      return applyUnitMoved(state, event);
    case "battle.attack_started":
      return applyAttackStarted(state, event);
    case "battle.main_action_spent":
      return applyMainActionSpent(state, event);
    case "battle.reaction_spent":
      return applyReactionSpent(state, event);
    case "battle.damage_dealt":
      return applyDamageDealt(state, event);
    case "battle.unit_defeated":
      return applyUnitDefeated(state, event);
    case "battle.turn_advanced":
      return applyTurnAdvanced(state, event);
    default:
      return assertNever(event);
  }
}

function applyUnitMoved(state: GameState, event: UnitMovedEvent): GameState {
  const unit = requireUnit(state, event.unitId);

  return updateUnit(state, event.sequence, unit.id, {
    ...unit,
    position: event.to,
    remainingMovement: unit.remainingMovement - event.movementSpent,
  });
}

function applyAttackStarted(state: GameState, event: AttackStartedEvent): GameState {
  return { ...state, sequence: event.sequence };
}

function applyMainActionSpent(state: GameState, event: MainActionSpentEvent): GameState {
  const unit = requireUnit(state, event.unitId);
  return updateUnit(state, event.sequence, unit.id, {
    ...unit,
    mainActionAvailable: false,
  });
}

function applyReactionSpent(state: GameState, event: ReactionSpentEvent): GameState {
  const unit = requireUnit(state, event.unitId);
  return updateUnit(state, event.sequence, unit.id, {
    ...unit,
    reactionAvailable: false,
  });
}

function applyDamageDealt(state: GameState, event: DamageDealtEvent): GameState {
  const target = requireUnit(state, event.targetId);
  return updateUnit(state, event.sequence, target.id, {
    ...target,
    health: Math.max(0, target.health - event.amount),
  });
}

function applyUnitDefeated(state: GameState, event: UnitDefeatedEvent): GameState {
  const unit = requireUnit(state, event.unitId);
  return updateUnit(state, event.sequence, unit.id, {
    ...unit,
    health: 0,
    defeated: true,
    remainingMovement: 0,
    mainActionAvailable: false,
    reactionAvailable: false,
  });
}

function applyTurnAdvanced(state: GameState, event: BattleTurnAdvancedEvent): GameState {
  const nextUnit = requireUnit(state, event.activeUnitId);

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
          mainActionAvailable: true,
          reactionAvailable: true,
        },
      },
    },
  };
}

function requireUnit(state: GameState, unitId: string) {
  const unit = state.battle.units[unitId];
  if (!unit) throw new Error(`Cannot apply event to missing unit ${unitId}`);
  return unit;
}

function updateUnit(
  state: GameState,
  sequence: number,
  unitId: string,
  unit: GameState["battle"]["units"][string],
): GameState {
  return {
    ...state,
    sequence,
    battle: {
      ...state.battle,
      units: {
        ...state.battle.units,
        [unitId]: unit,
      },
    },
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event: ${JSON.stringify(value)}`);
}
