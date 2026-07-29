import { applyEvent } from "./apply-event";
import { applyStrategyEvent } from "./apply-strategy-event";
import { isStrategyDomainEvent, type AllDomainEvent } from "./all-events";
import type { DomainEvent as TacticalDomainEvent } from "./events";
import type { GameState } from "./state";

export function applyAllEvent(state: GameState, event: AllDomainEvent): GameState {
  return isStrategyDomainEvent(event)
    ? applyStrategyEvent(state, event)
    : applyEvent(state, event as TacticalDomainEvent);
}
