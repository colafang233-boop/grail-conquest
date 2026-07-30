import { applyCampaignEvent } from "./apply-campaign-event";
import { applyEvent } from "./apply-event";
import { applyOperationsEvent } from "./apply-operations-event";
import { applyStrategyEvent } from "./apply-strategy-event";
import {
  isCampaignDomainEvent,
  isOperationsDomainEvent,
  isStrategyDomainEvent,
  type AllDomainEvent,
} from "./all-events";
import type { DomainEvent as TacticalDomainEvent } from "./events";
import type { GameState } from "./state";

export function applyAllEvent(state: GameState, event: AllDomainEvent): GameState {
  if (isCampaignDomainEvent(event)) return applyCampaignEvent(state, event);
  if (isOperationsDomainEvent(event)) return applyOperationsEvent(state, event);
  if (isStrategyDomainEvent(event)) return applyStrategyEvent(state, event);
  return applyEvent(state, event as TacticalDomainEvent);
}
