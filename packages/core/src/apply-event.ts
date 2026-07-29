import type {
  AbilityUsedEvent,
  AttackStartedEvent,
  BarrierAbsorbedEvent,
  BarrierAppliedEvent,
  BattleContinuationActivatedEvent,
  BattleContinuationTriggeredEvent,
  BattleTurnAdvancedEvent,
  CommandSealUsedEvent,
  ContractStabilityChangedEvent,
  DamageDealtEvent,
  DeathRejectedEvent,
  DeathWardActivatedEvent,
  DomainEvent,
  ExtraTurnGrantedEvent,
  GuardSupportActivatedEvent,
  LowManaStateChangedEvent,
  MainActionSpentEvent,
  ManaRestoredEvent,
  ManaSpentEvent,
  ManaTransferredEvent,
  MasterGuardedEvent,
  NoblePhantasmChargeAdvancedEvent,
  NoblePhantasmCooldownChangedEvent,
  NoblePhantasmInterruptedEvent,
  NoblePhantasmPreparationStartedEvent,
  NoblePhantasmReadyEvent,
  NoblePhantasmReleasedEvent,
  NoblePhantasmWarningEvent,
  ReactionSpentEvent,
  ScenarioClueDiscoveredEvent,
  ScenarioCompletedEvent,
  ScenarioEncounterStartedEvent,
  ServantRecalledEvent,
  ServantUpkeepPaidEvent,
  UnitDefeatedEvent,
  UnitDisplacedEvent,
  UnitMovedEvent,
} from "./events";
import type { FactionId, UnitId } from "./ids";
import type { ContractState, GameState } from "./state";

export function applyEvent(state: GameState, event: DomainEvent): GameState {
  switch (event.type) {
    case "battle.unit_moved": return applyUnitMoved(state, event);
    case "battle.unit_displaced": return applyUnitDisplaced(state, event);
    case "battle.attack_started": return applyAttackStarted(state, event);
    case "battle.main_action_spent": return applyMainActionSpent(state, event);
    case "battle.reaction_spent": return applyReactionSpent(state, event);
    case "battle.mana_spent": return applyManaSpent(state, event);
    case "battle.damage_dealt": return applyDamageDealt(state, event);
    case "battle.barrier_absorbed": return applyBarrierAbsorbed(state, event);
    case "battle.unit_defeated": return applyUnitDefeated(state, event);
    case "battle.turn_advanced": return applyTurnAdvanced(state, event);
    case "ability.used": return applyAbilityUsed(state, event);
    case "ability.barrier_applied": return applyBarrierApplied(state, event);
    case "ability.guard_support_activated": return applyGuardSupportActivated(state, event);
    case "ability.battle_continuation_activated": return applyBattleContinuationActivated(state, event);
    case "ability.battle_continuation_triggered": return applyBattleContinuationTriggered(state, event);
    case "noble_phantasm.preparation_started": return applyNoblePhantasmPreparationStarted(state, event);
    case "noble_phantasm.charge_advanced": return applyNoblePhantasmChargeAdvanced(state, event);
    case "noble_phantasm.ready": return applyNoblePhantasmReady(state, event);
    case "noble_phantasm.released": return applyNoblePhantasmReleased(state, event);
    case "noble_phantasm.interrupted": return applyNoblePhantasmInterrupted(state, event);
    case "noble_phantasm.cooldown_changed": return applyNoblePhantasmCooldownChanged(state, event);
    case "contract.master_guarded": return applyMasterGuarded(state, event);
    case "contract.mana_transferred": return applyManaTransferred(state, event);
    case "contract.servant_upkeep_paid": return applyServantUpkeepPaid(state, event);
    case "contract.low_mana_changed": return applyLowManaChanged(state, event);
    case "contract.stability_changed": return applyContractStabilityChanged(state, event);
    case "contract.command_seal_used": return applyCommandSealUsed(state, event);
    case "contract.servant_recalled": return applyServantRecalled(state, event);
    case "contract.extra_turn_granted": return applyExtraTurnGranted(state, event);
    case "contract.mana_restored": return applyManaRestored(state, event);
    case "contract.death_ward_activated": return applyDeathWardActivated(state, event);
    case "contract.death_rejected": return applyDeathRejected(state, event);
    case "scenario.encounter_started": return applyScenarioEncounterStarted(state, event);
    case "scenario.clue_discovered": return applyScenarioClueDiscovered(state, event);
    case "scenario.noble_phantasm_warning": return applyNoblePhantasmWarning(state, event);
    case "scenario.completed": return applyScenarioCompleted(state, event);
    default: return assertNever(event);
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

function applyUnitDisplaced(state: GameState, event: UnitDisplacedEvent): GameState {
  const unit = requireUnit(state, event.unitId);
  return updateUnit(state, event.sequence, unit.id, { ...unit, position: event.to });
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

function applyManaSpent(state: GameState, event: ManaSpentEvent): GameState {
  const unit = requireUnit(state, event.unitId);
  const mana = Math.max(0, unit.mana - event.amount);
  return updateUnit(state, event.sequence, unit.id, {
    ...unit,
    mana,
    lowMana: unit.role === "servant" ? mana < unit.maxMana * 0.3 : unit.lowMana,
  });
}

function applyDamageDealt(state: GameState, event: DamageDealtEvent): GameState {
  const target = requireUnit(state, event.targetId);
  return updateUnit(state, event.sequence, target.id, {
    ...target,
    health: Math.max(0, target.health - event.amount),
  });
}

function applyBarrierAbsorbed(state: GameState, event: BarrierAbsorbedEvent): GameState {
  const target = requireUnit(state, event.targetId);
  return updateUnit(state, event.sequence, target.id, {
    ...target,
    barrier: Math.max(0, target.barrier - event.amount),
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
    battleContinuationActive: false,
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
          guardBonus: 0,
        },
      },
    },
  };
}

function applyAbilityUsed(state: GameState, event: AbilityUsedEvent): GameState {
  return { ...state, sequence: event.sequence };
}

function applyBarrierApplied(state: GameState, event: BarrierAppliedEvent): GameState {
  const target = requireUnit(state, event.targetId);
  return updateUnit(state, event.sequence, target.id, {
    ...target,
    barrier: Math.min(99, target.barrier + event.amount),
  });
}

function applyGuardSupportActivated(state: GameState, event: GuardSupportActivatedEvent): GameState {
  const servant = requireUnit(state, event.servantId);
  return updateUnit(state, event.sequence, servant.id, {
    ...servant,
    reactionAvailable: true,
    guardBonus: Math.max(servant.guardBonus, event.guardBonus),
  });
}

function applyBattleContinuationActivated(
  state: GameState,
  event: BattleContinuationActivatedEvent,
): GameState {
  const servant = requireUnit(state, event.servantId);
  return updateUnit(state, event.sequence, servant.id, { ...servant, battleContinuationActive: true });
}

function applyBattleContinuationTriggered(
  state: GameState,
  event: BattleContinuationTriggeredEvent,
): GameState {
  const servant = requireUnit(state, event.servantId);
  return updateUnit(state, event.sequence, servant.id, {
    ...servant,
    health: 1,
    defeated: false,
    battleContinuationActive: false,
  });
}

function applyNoblePhantasmPreparationStarted(
  state: GameState,
  event: NoblePhantasmPreparationStartedEvent,
): GameState {
  const servant = requireUnit(state, event.servantId);
  const current = servant.noblePhantasm;
  if (!current) throw new Error(`Missing noble phantasm for ${servant.id}`);
  return updateUnit(state, event.sequence, servant.id, {
    ...servant,
    noblePhantasm: {
      ...current,
      definitionId: event.definitionId,
      phase: "preparing",
      charge: 0,
      requiredCharge: event.requiredCharge,
      interruptThreshold: event.interruptThreshold,
      cooldownRemaining: 0,
      targetId: event.targetId,
    },
  });
}

function applyNoblePhantasmChargeAdvanced(
  state: GameState,
  event: NoblePhantasmChargeAdvancedEvent,
): GameState {
  return updateNoblePhantasm(state, event.sequence, event.servantId, noble => ({ ...noble, charge: event.charge }));
}

function applyNoblePhantasmReady(state: GameState, event: NoblePhantasmReadyEvent): GameState {
  return updateNoblePhantasm(state, event.sequence, event.servantId, noble => ({ ...noble, phase: "ready" }));
}

function applyNoblePhantasmReleased(state: GameState, event: NoblePhantasmReleasedEvent): GameState {
  return updateNoblePhantasm(state, event.sequence, event.servantId, noble => ({ ...noble, phase: "released" }));
}

function applyNoblePhantasmInterrupted(
  state: GameState,
  event: NoblePhantasmInterruptedEvent,
): GameState {
  return updateNoblePhantasm(state, event.sequence, event.servantId, noble => ({ ...noble, phase: "interrupted" }));
}

function applyNoblePhantasmCooldownChanged(
  state: GameState,
  event: NoblePhantasmCooldownChangedEvent,
): GameState {
  return updateNoblePhantasm(state, event.sequence, event.servantId, noble => {
    const { targetId: _targetId, ...withoutTarget } = noble;
    return {
      ...withoutTarget,
      phase: event.remaining > 0 ? "cooldown" : "hidden",
      cooldownRemaining: event.remaining,
      charge: 0,
    };
  });
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

function applyContractStabilityChanged(state: GameState, event: ContractStabilityChangedEvent): GameState {
  const contract = requireContract(state, event.factionId);
  return updateContract(state, event.sequence, contract.factionId, { ...contract, stability: event.stability });
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

function applyScenarioEncounterStarted(state: GameState, event: ScenarioEncounterStartedEvent): GameState {
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

function applyScenarioClueDiscovered(state: GameState, event: ScenarioClueDiscoveredEvent): GameState {
  return {
    ...state,
    sequence: event.sequence,
    scenario: { ...state.scenario, clues: [...state.scenario.clues, event.clue] },
  };
}

function applyNoblePhantasmWarning(state: GameState, event: NoblePhantasmWarningEvent): GameState {
  return {
    ...state,
    sequence: event.sequence,
    scenario: {
      ...state.scenario,
      phase: "noble_phantasm_warning",
      objective: "宝具威胁已确认：打断准备、使用令咒撤离、展开防御，或战术撤退。",
    },
  };
}

function applyScenarioCompleted(state: GameState, event: ScenarioCompletedEvent): GameState {
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

function updateNoblePhantasm(
  state: GameState,
  sequence: number,
  servantId: UnitId,
  update: (state: NonNullable<GameState["battle"]["units"][string]["noblePhantasm"]>) =>
    NonNullable<GameState["battle"]["units"][string]["noblePhantasm"]>,
): GameState {
  const servant = requireUnit(state, servantId);
  if (!servant.noblePhantasm) throw new Error(`Missing noble phantasm for ${servant.id}`);
  return updateUnit(state, sequence, servant.id, {
    ...servant,
    noblePhantasm: update(servant.noblePhantasm),
  });
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
