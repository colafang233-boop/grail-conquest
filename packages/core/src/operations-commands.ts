import type { RegionId, StrategicOrderType } from "./state";

export interface SubmitOperationOrderCommand {
  readonly type: "operations.submit_order";
  readonly orderType: StrategicOrderType;
  readonly destinationId?: RegionId;
}

export interface CancelOperationOrderCommand {
  readonly type: "operations.cancel_order";
}

export interface LockOperationOrdersCommand {
  readonly type: "operations.lock_orders";
}

export interface ResolveOperationNightCommand {
  readonly type: "operations.resolve_night";
}

export interface EnterOperationEncounterCommand {
  readonly type: "operations.enter_encounter";
  readonly queueId: string;
}

export interface DeclineOperationEncounterCommand {
  readonly type: "operations.decline_encounter";
  readonly queueId: string;
}

export interface SettleOperationNightCommand {
  readonly type: "operations.settle_night";
}

export type OperationsGameCommand =
  | SubmitOperationOrderCommand
  | CancelOperationOrderCommand
  | LockOperationOrdersCommand
  | ResolveOperationNightCommand
  | EnterOperationEncounterCommand
  | DeclineOperationEncounterCommand
  | SettleOperationNightCommand;
