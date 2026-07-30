import type { FactionId } from "./ids";
import type { DiplomacyStatus, RegionId, StrategicOrderType } from "./state";

export interface SubmitOperationOrderCommand {
  readonly type: "operations.submit_order";
  readonly orderType: StrategicOrderType;
  readonly destinationId?: RegionId;
}

export interface CancelOperationOrderCommand { readonly type: "operations.cancel_order"; }
export interface LockOperationOrdersCommand { readonly type: "operations.lock_orders"; }
export interface ResolveOperationNightCommand { readonly type: "operations.resolve_night"; }
export interface EnterOperationEncounterCommand { readonly type: "operations.enter_encounter"; readonly queueId: string; }
export interface DeclineOperationEncounterCommand { readonly type: "operations.decline_encounter"; readonly queueId: string; }
export interface SettleOperationNightCommand { readonly type: "operations.settle_night"; }

export interface OfferAllianceCommand {
  readonly type: "diplomacy.offer";
  readonly targetFactionId: FactionId;
  readonly proposedStatus: Extract<DiplomacyStatus, "truce" | "allied">;
  readonly durationDays: number;
}

export interface RespondAllianceCommand {
  readonly type: "diplomacy.respond";
  readonly offerId: string;
  readonly accept: boolean;
}

export interface BreakAllianceCommand {
  readonly type: "diplomacy.break";
  readonly targetFactionId: FactionId;
}

export type OperationsGameCommand =
  | SubmitOperationOrderCommand
  | CancelOperationOrderCommand
  | LockOperationOrdersCommand
  | ResolveOperationNightCommand
  | EnterOperationEncounterCommand
  | DeclineOperationEncounterCommand
  | SettleOperationNightCommand
  | OfferAllianceCommand
  | RespondAllianceCommand
  | BreakAllianceCommand;
