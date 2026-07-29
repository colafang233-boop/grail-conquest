import type { RegionId } from "./state";

export interface MoveStrategyRegionCommand {
  readonly type: "strategy.move_region";
  readonly destinationId: RegionId;
}

export interface InvestigateStrategyRegionCommand {
  readonly type: "strategy.investigate";
}

export interface ControlLeylineCommand {
  readonly type: "strategy.control_leyline";
}

export interface RestStrategyCommand {
  readonly type: "strategy.rest";
}

export interface EndStrategyDayCommand {
  readonly type: "strategy.end_day";
}

export interface EnterStrategyEncounterCommand {
  readonly type: "strategy.enter_encounter";
}

export type StrategyGameCommand =
  | MoveStrategyRegionCommand
  | InvestigateStrategyRegionCommand
  | ControlLeylineCommand
  | RestStrategyCommand
  | EndStrategyDayCommand
  | EnterStrategyEncounterCommand;
