import { applyEvent } from "./apply-event";
import type { DomainEvent } from "./events";
import type { GameState } from "./state";
import type { UnitId } from "./ids";

export function normalizeCombatEvents(
  initialState: GameState,
  rawEvents: readonly DomainEvent[],
): { readonly state: GameState; readonly events: readonly DomainEvent[] } {
  let sequence = initialState.sequence;
  let state = initialState;
  const events: DomainEvent[] = [];

  const push = (event: DomainEvent) => {
    const normalized = { ...event, sequence: ++sequence } as DomainEvent;
    events.push(normalized);
    state = applyEvent(state, normalized);
  };

  const interrupt = (servantId: UnitId, sourceId: UnitId, reason: "damage" | "displacement" | "command_seal") => {
    const servant = state.battle.units[servantId];
    if (!servant?.noblePhantasm || servant.noblePhantasm.phase !== "preparing") return;
    push({
      type: "noble_phantasm.interrupted",
      sequence: 0,
      battleId: state.battle.id,
      servantId,
      sourceId,
      reason,
    });
    push({
      type: "noble_phantasm.cooldown_changed",
      sequence: 0,
      battleId: state.battle.id,
      servantId,
      remaining: 1,
    });
  };

  for (const rawEvent of rawEvents) {
    if (rawEvent.type === "battle.unit_defeated" || rawEvent.type === "contract.death_rejected") {
      continue;
    }

    if (rawEvent.type === "battle.damage_dealt") {
      const target = state.battle.units[rawEvent.targetId];
      if (!target || target.defeated) continue;
      const absorbed = Math.min(target.barrier, rawEvent.amount);
      if (absorbed > 0) {
        push({
          type: "battle.barrier_absorbed",
          sequence: 0,
          battleId: rawEvent.battleId,
          targetId: target.id,
          amount: absorbed,
        });
      }

      const actualDamage = Math.max(0, rawEvent.amount - absorbed);
      if (actualDamage > 0) {
        push({ ...rawEvent, sequence: 0, amount: actualDamage });
      }

      const updated = state.battle.units[target.id];
      if (!updated || updated.defeated || actualDamage <= 0) continue;

      if (updated.health <= 0) {
        if (updated.role === "servant" && updated.battleContinuationActive) {
          push({
            type: "ability.battle_continuation_triggered",
            sequence: 0,
            battleId: rawEvent.battleId,
            servantId: updated.id,
            sourceId: rawEvent.sourceId,
          });
        } else if (updated.role === "servant" && updated.deathWardActive) {
          push({
            type: "contract.death_rejected",
            sequence: 0,
            battleId: rawEvent.battleId,
            servantId: updated.id,
            sourceId: rawEvent.sourceId,
          });
        } else {
          push({
            type: "battle.unit_defeated",
            sequence: 0,
            battleId: rawEvent.battleId,
            unitId: updated.id,
            defeatedBy: rawEvent.sourceId,
          });
        }
      } else if (
        updated.noblePhantasm?.phase === "preparing" &&
        actualDamage >= updated.noblePhantasm.interruptThreshold
      ) {
        interrupt(updated.id, rawEvent.sourceId, "damage");
      }
      continue;
    }

    const previousRound = state.battle.round;
    push(rawEvent);

    if (rawEvent.type === "battle.unit_moved") {
      interrupt(rawEvent.unitId, rawEvent.unitId, "displacement");
    }
    if (rawEvent.type === "battle.unit_displaced") {
      interrupt(rawEvent.unitId, rawEvent.sourceId, "displacement");
    }
    if (rawEvent.type === "contract.servant_recalled") {
      interrupt(rawEvent.servantId, rawEvent.servantId, "command_seal");
    }
    if (rawEvent.type === "contract.mana_restored") {
      const servant = state.battle.units[rawEvent.servantId];
      const noble = servant?.noblePhantasm;
      if (servant && noble?.phase === "preparing") {
        push({
          type: "noble_phantasm.charge_advanced",
          sequence: 0,
          battleId: rawEvent.battleId,
          servantId: servant.id,
          charge: noble.requiredCharge,
        });
        push({
          type: "noble_phantasm.ready",
          sequence: 0,
          battleId: rawEvent.battleId,
          servantId: servant.id,
        });
      }
    }
    if (rawEvent.type === "battle.turn_advanced") {
      if (rawEvent.round > previousRound) {
        for (const unit of Object.values(state.battle.units).sort((left, right) =>
          String(left.id).localeCompare(String(right.id)),
        )) {
          const noble = unit.noblePhantasm;
          if (noble?.phase === "cooldown" && noble.cooldownRemaining > 0) {
            push({
              type: "noble_phantasm.cooldown_changed",
              sequence: 0,
              battleId: rawEvent.battleId,
              servantId: unit.id,
              remaining: Math.max(0, noble.cooldownRemaining - 1),
            });
          }
        }
      }

      const active = state.battle.units[rawEvent.activeUnitId];
      const noble = active?.noblePhantasm;
      if (active && noble?.phase === "preparing") {
        const charge = Math.min(noble.requiredCharge, noble.charge + 1);
        push({
          type: "noble_phantasm.charge_advanced",
          sequence: 0,
          battleId: rawEvent.battleId,
          servantId: active.id,
          charge,
        });
        if (charge >= noble.requiredCharge) {
          push({
            type: "noble_phantasm.ready",
            sequence: 0,
            battleId: rawEvent.battleId,
            servantId: active.id,
          });
        }
      }
    }
  }

  return { state, events };
}
