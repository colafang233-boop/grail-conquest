import type { DomainEvent as TacticalDomainEvent } from "./events";
import type { StrategyDomainEvent } from "./strategy-events";

export type AllDomainEvent = TacticalDomainEvent | StrategyDomainEvent;

export function isStrategyDomainEvent(event: AllDomainEvent): event is StrategyDomainEvent {
  return event.type.startsWith("strategy.");
}
