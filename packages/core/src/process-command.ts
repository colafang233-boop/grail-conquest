import { applyAllEvent } from "./apply-all-event";
import type { AllDomainEvent } from "./all-events";
import {
  isCampaignDomainEvent,
  isOperationsDomainEvent,
  isStrategyDomainEvent,
} from "./all-events";
import { evaluateCampaignProgress } from "./campaign";
import type { CampaignGameCommand } from "./campaign-commands";
import { executeCampaignCommand } from "./campaign-engine";
import type { AllGameCommand, AbilityGameCommand, GameCommand } from "./commands";
import type { DomainError } from "./errors";
import type { DomainEvent as TacticalDomainEvent } from "./events";
import type { OperationsGameCommand } from "./operations-commands";
import type { StrategyGameCommand } from "./strategy-commands";
import type { GameState } from "./state";
import { executeAbilityCommand } from "./ability-engine";
import { normalizeCombatEvents } from "./combat-event-normalizer";
import { executeCommand } from "./execute-command";
import { executeOperationsCommand } from "./operations-engine";
import { evaluateScenarioTriggers } from "./scenario";
import { executeStrategyCommand } from "./strategy-engine";

export type ProcessCommandResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly AllDomainEvent[] }
  | { readonly ok: false; readonly state: GameState; readonly events: readonly []; readonly error: DomainError };

export function processCommand(state: GameState, command: AllGameCommand): ProcessCommandResult {
  if (isCampaignCommand(command)) {
    const execution = executeCampaignCommand(state, command);
    if (!execution.ok) return failed(state, execution.error);
    return finalize(state, execution.events);
  }

  if (state.mode === "setup") {
    return failed(state, {
      code: "campaign_route_invalid",
      message: "Choose a campaign route before issuing game commands",
    });
  }

  if (isOperationsCommand(command)) {
    const execution = executeOperationsCommand(state, command);
    if (!execution.ok) return failed(state, execution.error);
    return finalize(state, execution.events);
  }
  if (isStrategyCommand(command)) {
    const execution = executeStrategyCommand(state, command);
    if (!execution.ok) return failed(state, execution.error);
    return finalize(state, execution.events);
  }
  if (state.mode === "strategy" && command.type !== "scenario.begin_encounter") {
    return failed(state, { code: "strategy_not_active", message: "Enter a discovered encounter before issuing tactical commands" });
  }
  if (state.mode === "strategy" && command.type === "scenario.begin_encounter") {
    return finalize(state, [
      { type: "strategy.encounter_entered", sequence: state.sequence + 1, encounterId: "school-night" },
      { type: "scenario.encounter_started", sequence: state.sequence + 2, scenarioId: "school-night" },
    ]);
  }
  const execution = isAbilityCommand(command) ? executeAbilityCommand(state, command) : executeCommand(state, command);
  if (!execution.ok) return failed(state, execution.error);
  const normalized = normalizeCombatEvents(state, execution.events);
  return finalize(state, normalized.events, normalized.state);
}

function finalize(before: GameState, baseEvents: readonly AllDomainEvent[], preReducedState?: GameState): ProcessCommandResult {
  const commandState = preReducedState ?? baseEvents.reduce(applyAllEvent, before);
  const tacticalEvents = baseEvents.filter((event): event is TacticalDomainEvent =>
    !isCampaignDomainEvent(event) && !isStrategyDomainEvent(event) && !isOperationsDomainEvent(event),
  );
  const scenarioEvents = evaluateScenarioTriggers(before, commandState, tacticalEvents);
  let state = scenarioEvents.reduce(applyAllEvent, commandState);
  const events: AllDomainEvent[] = [...baseEvents, ...scenarioEvents];

  if (state.mode === "battle" && state.scenario.phase === "completed" && state.scenario.outcome && state.scenario.report) {
    const returned: AllDomainEvent = {
      type: "strategy.returned",
      sequence: state.sequence + 1,
      encounterId: state.strategy.activeEncounterId ?? "school-night",
      outcome: state.scenario.outcome,
      report: state.scenario.report,
    };
    state = applyAllEvent(state, returned);
    events.push(returned);
  }

  const campaignEvents = evaluateCampaignProgress(before, state);
  state = campaignEvents.reduce(applyAllEvent, state);
  events.push(...campaignEvents);
  return { ok: true, state, events };
}

function failed(state: GameState, error: DomainError): ProcessCommandResult {
  return { ok: false, state, events: [], error };
}

function isCampaignCommand(command: AllGameCommand): command is CampaignGameCommand {
  return command.type.startsWith("campaign.");
}

function isAbilityCommand(command: AllGameCommand): command is AbilityGameCommand {
  return command.type.startsWith("ability.") || command.type.startsWith("noble_phantasm.");
}

function isStrategyCommand(command: AllGameCommand): command is StrategyGameCommand {
  return command.type.startsWith("strategy.");
}

function isOperationsCommand(command: AllGameCommand): command is OperationsGameCommand {
  return command.type.startsWith("operations.") || command.type.startsWith("diplomacy.");
}

export type LegacyGameCommand = GameCommand;
