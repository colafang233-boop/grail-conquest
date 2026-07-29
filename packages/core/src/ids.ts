type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type BattleId = Brand<string, "BattleId">;
export type FactionId = Brand<string, "FactionId">;
export type UnitId = Brand<string, "UnitId">;

export const battleId = (value: string): BattleId => value as BattleId;
export const factionId = (value: string): FactionId => value as FactionId;
export const unitId = (value: string): UnitId => value as UnitId;
