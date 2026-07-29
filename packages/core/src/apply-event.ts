import type {
  AttackStartedEvent,
  BattleTurnAdvancedEvent,
  CommandSealUsedEvent,
  ContractStabilityChangedEvent,
  DamageDealtEvent,
  DeathRejectedEvent,
  DeathWardActivatedEvent,
  DomainEvent,
  ExtraTurnGrantedEvent,
  LowManaStateChangedEvent,
  MainActionSpentEvent,
  ManaRestoredEvent,
  ManaTransferredEvent,
  MasterGuardedEvent,
  NoblePhantasmWarningEvent,
  ReactionSpentEvent,
  ScenarioClueDiscoveredEvent,
  ScenarioCompletedEvent,
  ScenarioEncounterStartedEvent,
  ServantRecalledEvent,
  ServantUpkeepPaidEvent,
  UnitDefeatedEvent,
  UnitMovedEvent,
} from "./events";
import type { FactionId, UnitId } from "./ids";
import type { ContractState, GameState } from "./state";

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
    case "contract.master_guarded":
      return applyMasterGuarded(state, event);
    case "contract.mana_transferred":
      return applyManaTransferred(state, event);
    case "contract.servant_upkeep_paid":
      return applyServantUpkeepPaid(state, event);
    case "contract.low_mana_changed":
      return applyLowManaChanged(state, event);
    case "contract.stability_changed":
      return applyContractStabilityChanged(state, event);
    case "contract.command_seal_used":
      return applyCommandSealUsed(state, event);
    case "contract.servant_recalled":
      return applyServantRecalled(state, event);
    case "contract.extra_turn_granted":
      return applyExtraTurnGranted(state, event);
    case "contract.mana_restored":
      return applyManaRestored(state, event);
    case "contract.death_ward_activated":
      return applyDeathWardActivated(state, event);
    case "contract.death_rejected":
      return applyDeathRejected(state, event);
    case "scenario.encounter_started":
      return applyScenarioEncounterStarted(state, event);
    case "scenario.clue_discovered":
      return applyScenarioClueDiscovered(state, event);
    case "scenario.noble_phantasm_warning":
      return applyNoblePhantasmWarning(state, event);
    case "scenario.completed":
      return applyScenarioCompleted(state, event);
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
  return updateUnit(state, event.sequence, unit.id, { ...unit, mainActionAvailable: false });
}

function applyReactionSpent(state: GameState, event: ReactionSpentEvent): GameState {
  const unit = requireUnit(state, event.unitId);
  return updateUnit(state, event.sequence, unit.id, { ...unit, reactionAvailable: false });
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

function applyMasterGuarded(state: GameState, event: MasterGuardedEvent): GameState {
  return { ...state, sequence: event.sequence };
}

function applyManaTransferred(state: GameState, event: ManaTransferredEvent): GameState {
  const master = requireUnit(state, event.masterId);
  const servant = requireUnit(state, event.servantId);
  return {
    ...state,
    sequence: event.sequence,
    battle: {
      ...state.battle,
      units: {
        ...state.battle.units,
        [master.id]: { ...master, mana: Math.max(0, master.mana - event.amount) },
        [servant.id]: { ...servant, mana: Math.min(servant.maxMana, servant.mana + event.amount) },
      },
    },
  };
}

function applyServantUpkeepPaid(state: GameState, event: ServantUpkeepPaidEvent): GameState {
  const servant = requireUnit(state, event.servantId);
  return updateUnit(state, event.sequence, servant.id, {
    ...servant,
    mana: Math.max(0, servant.mana - event.amount),
  });
}

function applyLowManaChanged(state: GameState, event: LowManaStateChangedEvent): GameState {
  const servant = requireUnit(state, event.servantId);
  return updateUnit(state, event.sequence, servant.id, { ...servant, lowMana: event.lowMana });
}

function applyContractStabilityChanged(
  state: GameState,
  event: ContractStabilityChangedEvent,
): GameState {
  const contract = requireContract(state, event.factionId);
  return updateContract(state, event.sequence, contract.factionId, {
    ...contract,
    stability: event.stability,
  });
}

function applyCommandSealUsed(state: GameState, event: CommandSealUsedEvent): GameState {
  const contract = requireContract(state, event.factionId);
  return updateContract(state, event.sequence, contract.factionId, {
    ...contract,
    commandSeals: Math.max(0, contract.commandSeals - 1),
  });
}

function applyServantRecalled(state: GameState, event: ServantRecalledEvent): GameState {
  const servant = requireUnit(state, event.servantId);
  return updateUnit(state, event.sequence, servant.id, { ...servant, position: event.to });
}

function applyExtraTurnGranted(state: GameState, event: ExtraTurnGrantedEvent): GameState {
  const servant = requireUnit(state, event.servantId);
  return {
    ...state,
    sequence: event.sequence,
    battle: {
      ...state.battle,
      activeUnitId: servant.id,
      units: {
        ...state.battle.units,
        [servant.id]: {
          ...servant,
          remainingMovement: servant.movement,
          mainActionAvailable: true,
          reactionAvailable: true,
        },
      },
    },
  };
}

function applyManaRestored(state: GameState, event: ManaRestoredEvent): GameState {
  const servant = requireUnit(state, event.servantId);
  return updateUnit(state, event.sequence, servant.id, {
    ...servant,
    mana: Math.min(servant.maxMana, servant.mana + event.amount),
  });
}

function applyDeathWardActivated(state: GameState, event: DeathWardActivatedEvent): GameState {
  const servant = requireUnit(state, event.servantId);
  return updateUnit(state, event.sequence, servant.id, { ...servant, deathWardActive: true });
}

function applyDeathRejected(state: GameState, event: DeathRejectedEvent): GameState {
  const servant = requireUnit(state, event.servantId);
  return updateUnit(state, event.sequence, servant.id, {
    ...servant,
    health: 1,
    defeated: false,
    deathWardActive: false,
  });
}

function applyScenarioEncounterStarted(
  state: GameState,
  event: ScenarioEncounterStartedEvent,
): GameState {
  return {
    ...state,
    sequence: event.sequence,
    scenario: {
      ...state.scenario,
      phase: "encounter",
      objective: "在未知 Lancer 的追击下存活，并收集足以推断其真名的战斗线索。",
    },
  };
}

function applyScenarioClueDiscovered(
  state: GameState,
  event: ScenarioClueDiscoveredEvent,
): GameState {
  return {
    ...state,
    sequence: event.sequence,
    scenario: {
      ...state.scenario,
      clues: [...state.scenario.clues, event.clue],
    },
  };
}

function applyNoblePhantasmWarning(
  state: GameState,
  event: NoblePhantasmWarningEvent,
): GameState {
  return {
    ...state,
    sequence: event.sequence,
    scenario: {
      ...state.scenario,
      phase: "noble_phantasm_warning",
      objective: "宝具威胁已确认：立即撤退保全情报，或继续冒险尝试击败 Lancer。",
    },
  };
}

function applyScenarioCompleted(
  state: GameState,
  event: ScenarioCompletedEvent,
): GameState {
  return {
    ...state,
    sequence: event.sequence,
    scenario: {
      ...state.scenario,
      phase: "completed",
      objective: "学校夜战已结束。",
      outcome: event.outcome,
      report: event.report,
    },
  };
}

function requireUnit(state: GameState, unitId: UnitId | string) {
  const unit = state.battle.units[unitId];
  if (!unit) throw new Error(`Cannot apply event to missing unit ${unitId}`);
  return unit;
}

function requireContract(state: GameState, factionId: FactionId): ContractState {
  const contract = state.battle.contracts[factionId];
  if (!contract) throw new Error(`Cannot apply event to missing contract ${factionId}`);
  return contract;
}

function updateUnit(
  state: GameState,
  sequence: number,
  unitId: UnitId | string,
  unit: GameState["battle"]["units"][string],
): GameState {
  return {
    ...state,
    sequence,
    battle: {
      ...state.battle,
      units: { ...state.battle.units, [unitId]: unit },
    },
  };
}

function updateContract(
  state: GameState,
  sequence: number,
  factionId: FactionId,
  contract: ContractState,
): GameState {
  return {
    ...state,
    sequence,
    battle: {
      ...state.battle,
      contracts: { ...state.battle.contracts, [factionId]: contract },
    },
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event: ${JSON.stringify(value)}`);
}
