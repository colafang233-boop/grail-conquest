import type { StrategyDomainEvent } from "./strategy-events";
import { getEncounterDefinition } from "./strategy";
import type { GameState, RegionId } from "./state";

export function applyStrategyEvent(state: GameState, event: StrategyDomainEvent): GameState {
  switch (event.type) {
    case "strategy.action_points_spent":
      return updateStrategy(state, event.sequence, {
        ...state.strategy,
        actionPoints: Math.max(0, state.strategy.actionPoints - event.amount),
      });
    case "strategy.region_moved":
      return updateStrategy(state, event.sequence, {
        ...state.strategy,
        currentRegionId: event.to,
        objective: `已抵达${state.strategy.regions[event.to].name}。调查、占领灵脉，或继续前往相邻区域。`,
      });
    case "strategy.region_discovered":
      return updateRegion(state, event.sequence, event.regionId, {
        ...state.strategy.regions[event.regionId],
        discovered: true,
      });
    case "strategy.region_investigated":
      return updateRegion(state, event.sequence, event.regionId, {
        ...state.strategy.regions[event.regionId],
        investigated: true,
      });
    case "strategy.leyline_controlled":
      return updateRegion(state, event.sequence, event.regionId, {
        ...state.strategy.regions[event.regionId],
        controlledBy: event.factionId,
      });
    case "strategy.exposure_changed":
      return updateStrategy(state, event.sequence, { ...state.strategy, exposure: event.exposure });
    case "strategy.rested": {
      const master = state.battle.units[event.masterId];
      const servant = state.battle.units[event.servantId];
      if (!master || !servant) throw new Error("Cannot rest missing contract members");
      return {
        ...state,
        sequence: event.sequence,
        battle: {
          ...state.battle,
          units: {
            ...state.battle.units,
            [master.id]: {
              ...master,
              health: Math.min(master.maxHealth, master.health + event.healthRestored),
              mana: Math.min(master.maxMana, master.mana + event.masterManaRestored),
            },
            [servant.id]: {
              ...servant,
              health: Math.min(servant.maxHealth, servant.health + event.healthRestored),
              mana: Math.min(servant.maxMana, servant.mana + event.servantManaRestored),
              lowMana: false,
            },
          },
        },
      };
    }
    case "strategy.day_advanced":
      return updateStrategy(state, event.sequence, {
        ...state.strategy,
        day: event.day,
        actionPoints: event.actionPoints,
        objective: "新的一天开始。利用灵脉补充魔力，并继续调查冬木市。",
      });
    case "strategy.mana_income": {
      const master = state.battle.units[event.masterId];
      const servant = state.battle.units[event.servantId];
      if (!master || !servant) throw new Error("Cannot apply mana income to missing units");
      return {
        ...state,
        sequence: event.sequence,
        battle: {
          ...state.battle,
          units: {
            ...state.battle.units,
            [master.id]: { ...master, mana: Math.min(master.maxMana, master.mana + event.masterAmount) },
            [servant.id]: {
              ...servant,
              mana: Math.min(servant.maxMana, servant.mana + event.servantAmount),
              lowMana: false,
            },
          },
        },
      };
    }
    case "strategy.encounter_prepared":
      return updateStrategy(state, event.sequence, {
        ...state.strategy,
        pendingEncounterId: event.encounterId,
        objective: `${getEncounterDefinition(event.encounterId).title}已确认，可以进入遭遇或继续准备。`,
      });
    case "strategy.encounter_entered":
      return {
        ...state,
        sequence: event.sequence,
        mode: "battle",
        strategy: {
          ...state.strategy,
          activeEncounterId: event.encounterId,
          objective: `${getEncounterDefinition(event.encounterId).title}进行中。`,
        },
      };
    case "strategy.returned": {
      const {
        pendingEncounterId: _pending,
        activeEncounterId: _active,
        ...strategyWithoutEncounter
      } = state.strategy;
      return {
        ...state,
        sequence: event.sequence,
        mode: "strategy",
        strategy: {
          ...strategyWithoutEncounter,
          phase: "night_settlement",
          encounterQueue: [],
          completedEncounterIds: state.strategy.completedEncounterIds.includes(event.encounterId)
            ? state.strategy.completedEncounterIds
            : [...state.strategy.completedEncounterIds, event.encounterId],
          lastReport: event.report,
          objective: "遭遇结束。战斗损耗、令咒消耗和情报均已保留，等待清晨结算。",
        },
      };
    }
    default:
      return assertNever(event);
  }
}

function updateStrategy(
  state: GameState,
  sequence: number,
  strategy: GameState["strategy"],
): GameState {
  return { ...state, sequence, strategy };
}

function updateRegion(
  state: GameState,
  sequence: number,
  regionId: RegionId,
  region: GameState["strategy"]["regions"][RegionId],
): GameState {
  return {
    ...state,
    sequence,
    strategy: {
      ...state.strategy,
      regions: { ...state.strategy.regions, [regionId]: region },
    },
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled strategic event: ${JSON.stringify(value)}`);
}
