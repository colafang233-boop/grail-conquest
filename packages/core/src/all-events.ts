import type { DomainEvent as TacticalDomainEvent } from "./events";
import type { OperationsDomainEvent } from "./operations-events";
import type { StrategyDomainEvent } from "./strategy-events";

export type AllDomainEvent = TacticalDomainEvent | StrategyDomainEvent | OperationsDomainEvent;

export function isStrategyDomainEvent(event: AllDomainEvent): event is StrategyDomainEvent {
  return event.type.startsWith("strategy.");
}

export function isOperationsDomainEvent(event: AllDomainEvent): event is OperationsDomainEvent {
  return event.type.startsWith("operations.") || event.type.startsWith("diplomacy.");
}
