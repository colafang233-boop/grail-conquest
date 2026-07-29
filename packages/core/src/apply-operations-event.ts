import type { OperationsDomainEvent } from "./operations-events";
import { createInitialScenarioState } from "./scenario";
import {
  ENEMY_STRATEGY_FACTION_ID,
  STRATEGY_FACTION_ID,
  STRATEGY_MASTER_ID,
  STRATEGY_SERVANT_ID,
  getEncounterDefinition,
} from "./strategy";
import { LANCER_UNIT_ID } from "./school-battle";
import type { BattleUnitState, GameState } from "./state";

export function applyOperationsEvent(state: GameState, event: OperationsDomainEvent): GameState {
  switch (event.type) {
    case "operations.order_submitted":
      return {
        ...state,
        sequence: event.sequence,
        strategy: {
          ...state.strategy,
          playerOrder: event.order,
          resolutionTimeline: [],
          objective: "检查行动预览，确认后锁定本夜命令。",
        },
      };
    case "operations.order_cancelled": {
      const { playerOrder: _order, ...strategy } = state.strategy;
      return {
        ...state,
        sequence: event.sequence,
        strategy: { ...strategy, objective: "本夜尚未选择行动。" },
      };
    }
    case "operations.orders_locked":
      return {
        ...state,
        sequence: event.sequence,
        strategy: {
          ...state.strategy,
          enemyOrder: event.enemyOrder,
          objective: "命令已锁定。执行同步结算后才能看到敌方行动。",
        },
      };
    case "operations.phase_changed":
      return {
        ...state,
        sequence: event.sequence,
        strategy: { ...state.strategy, phase: event.phase },
      };
    case "operations.faction_moved":
      if (event.factionId === STRATEGY_FACTION_ID) {
        return {
          ...state,
          sequence: event.sequence,
          strategy: { ...state.strategy, currentRegionId: event.to },
        };
      }
      if (event.factionId === ENEMY_STRATEGY_FACTION_ID) {
        return {
          ...state,
          sequence: event.sequence,
          strategy: { ...state.strategy, enemyRegionId: event.to },
        };
      }
      return { ...state, sequence: event.sequence };
    case "operations.detection_resolved": {
      const playerDetected = event.detection.outcome === "mutual" || event.detection.outcome === "player_only";
      return {
        ...state,
        sequence: event.sequence,
        strategy: {
          ...state.strategy,
          lastDetection: event.detection,
          ...(playerDetected ? { knownEnemyRegionId: event.detection.regionId } : {}),
        },
      };
    }
    case "operations.encounter_queued":
      return {
        ...state,
        sequence: event.sequence,
        strategy: {
          ...state.strategy,
          encounterQueue: [...state.strategy.encounterQueue, event.encounter],
        },
      };
    case "operations.encounter_removed":
      return {
        ...state,
        sequence: event.sequence,
        strategy: {
          ...state.strategy,
          encounterQueue: state.strategy.encounterQueue.filter(item => item.id !== event.queueId),
        },
      };
    case "operations.encounter_entered":
      return enterEncounter(state, event);
    case "operations.timeline_added":
      return {
        ...state,
        sequence: event.sequence,
        strategy: {
          ...state.strategy,
          resolutionTimeline: [...state.strategy.resolutionTimeline, event.entry],
        },
      };
    case "operations.workshop_prepared":
      return {
        ...state,
        sequence: event.sequence,
        strategy: { ...state.strategy, workshopPrepared: event.prepared },
      };
    case "operations.seed_advanced":
      return {
        ...state,
        sequence: event.sequence,
        strategy: { ...state.strategy, operationSeed: event.seed },
      };
    case "operations.orders_cleared": {
      const {
        playerOrder: _playerOrder,
        enemyOrder: _enemyOrder,
        lastDetection: _detection,
        activeEncounterId: _active,
        ...strategy
      } = state.strategy;
      return {
        ...state,
        sequence: event.sequence,
        strategy: {
          ...strategy,
          encounterQueue: [],
          objective: "为今晚选择一个行动。敌方命令将在计划锁定后秘密生成。",
        },
      };
    }
    case "operations.enemy_exposure_changed":
      return {
        ...state,
        sequence: event.sequence,
        strategy: { ...state.strategy, enemyExposure: event.exposure },
      };
    default:
      return assertNever(event);
  }
}

function enterEncounter(
  state: GameState,
  event: Extract<OperationsDomainEvent, { readonly type: "operations.encounter_entered" }>,
): GameState {
  const definition = getEncounterDefinition(event.encounterId);
  const archer = requireUnit(state, STRATEGY_SERVANT_ID);
  const rin = requireUnit(state, STRATEGY_MASTER_ID);
  const lancer = requireUnit(state, LANCER_UNIT_ID);
  const activeUnitId = event.advantage === "enemy" ? lancer.id : archer.id;

  return {
    ...state,
    sequence: event.sequence,
    mode: "battle",
    strategy: {
      ...state.strategy,
      activeEncounterId: event.encounterId,
      currentRegionId: event.regionId,
      knownEnemyRegionId: event.regionId,
      workshopPrepared: false,
      objective: `${definition.title}进行中。`,
    },
    scenario: {
      ...createInitialScenarioState(),
      objective: definition.objective,
    },
    battle: {
      ...state.battle,
      round: 1,
      activeUnitId,
      units: {
        ...state.battle.units,
        [archer.id]: prepareUnit(archer, definition.playerStart),
        [rin.id]: prepareUnit(rin, {
          q: Math.max(0, definition.playerStart.q - 1),
          r: Math.min(5, definition.playerStart.r + 2),
        }),
        [lancer.id]: prepareUnit(lancer, definition.enemyStart),
      },
    },
  };
}

function prepareUnit(
  unit: BattleUnitState,
  position: BattleUnitState["position"],
): BattleUnitState {
  const noblePhantasm = unit.noblePhantasm
    ? resetNoblePhantasm(unit.noblePhantasm)
    : undefined;
  const base = {
    ...unit,
    position,
    remainingMovement: unit.movement,
    mainActionAvailable: true,
    reactionAvailable: true,
    barrier: 0,
    guardBonus: 0,
    battleContinuationActive: false,
    deathWardActive: false,
  };
  return noblePhantasm ? { ...base, noblePhantasm } : base;
}

function resetNoblePhantasm(
  noble: NonNullable<BattleUnitState["noblePhantasm"]>,
): NonNullable<BattleUnitState["noblePhantasm"]> {
  const { targetId: _target, ...withoutTarget } = noble;
  return {
    ...withoutTarget,
    phase: noble.cooldownRemaining > 0 ? "cooldown" : "hidden",
    charge: 0,
  };
}

function requireUnit(state: GameState, unitId: string): BattleUnitState {
  const unit = state.battle.units[unitId];
  if (!unit) throw new Error(`Missing battle unit ${unitId}`);
  return unit;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled operation event: ${JSON.stringify(value)}`);
}
