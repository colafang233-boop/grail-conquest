import {
  findLegalAbilityTargets,
  findLegalNoblePhantasmTargets,
  getAbilityDefinition,
  getNoblePhantasmDefinition,
  type BattleState,
  type BattleUnitState,
} from "@grail/core";
import { gameEngine } from "../game-engine";
import { interactionStore } from "../interaction-store";
import { useInteractionMode } from "../hooks/useInteractionMode";

interface AbilityPaletteProps {
  readonly battle: BattleState;
  readonly activeUnit: BattleUnitState;
  readonly enabled: boolean;
}

export function AbilityPalette({ battle, activeUnit, enabled }: AbilityPaletteProps) {
  const mode = useInteractionMode();

  const useAbility = (abilityId: BattleUnitState["abilityIds"][number]) => {
    const definition = getAbilityDefinition(abilityId);
    if (definition.target === "self" || definition.target === "all_adjacent_enemies") {
      gameEngine.dispatch({
        type: "ability.use",
        battleId: battle.id,
        actorId: activeUnit.id,
        abilityId,
      });
      interactionStore.setMode({ type: "move" });
      return;
    }
    interactionStore.setMode({ type: "ability", abilityId });
  };

  const prepareNoblePhantasm = () => interactionStore.setMode({ type: "noble_phantasm" });
  const releaseNoblePhantasm = () => {
    gameEngine.dispatch({
      type: "noble_phantasm.release",
      battleId: battle.id,
      servantId: activeUnit.id,
    });
    interactionStore.setMode({ type: "move" });
  };

  return (
    <section className="ability-card">
      <div className="section-title">
        <div><p className="eyebrow">AUTHORED ABILITIES</p><h3>技能与宝具</h3></div>
        <span>{activeUnit.mana} MP</span>
      </div>

      {activeUnit.abilityIds.length === 0 ? (
        <p className="muted">当前单位没有已配置技能。</p>
      ) : (
        <div className="ability-list">
          {activeUnit.abilityIds.map(abilityId => {
            const definition = getAbilityDefinition(abilityId);
            const targets = findLegalAbilityTargets(battle, activeUnit.id, abilityId);
            const active = mode.type === "ability" && mode.abilityId === abilityId;
            const needsTarget = definition.target === "enemy" || definition.target === "ally";
            const disabled = !enabled || !activeUnit.mainActionAvailable || activeUnit.mana < definition.manaCost || targets.length === 0;

            return (
              <button
                key={abilityId}
                type="button"
                className={active ? "ability-button active" : "ability-button"}
                disabled={disabled}
                title={definition.description}
                onClick={() => useAbility(abilityId)}
              >
                <span><strong>{definition.name}</strong><small>{definition.description}</small></span>
                <em>{definition.manaCost} MP{needsTarget ? ` · ${targets.length}目标` : ""}</em>
              </button>
            );
          })}
        </div>
      )}

      {activeUnit.noblePhantasm && (() => {
        const noble = activeUnit.noblePhantasm;
        const definition = getNoblePhantasmDefinition(noble.definitionId);
        const targets = findLegalNoblePhantasmTargets(battle, activeUnit.id);
        const canPrepare = enabled && activeUnit.mainActionAvailable && noble.phase === "hidden" &&
          Boolean(definition && activeUnit.mana >= definition.manaCost && targets.length > 0);
        const canRelease = enabled && activeUnit.mainActionAvailable && noble.phase === "ready";

        return (
          <div className={`noble-card phase-${noble.phase}`}>
            <div>
              <span>宝具状态 · {noble.phase}</span>
              <strong>{definition?.name ?? noble.definitionId}</strong>
              {noble.phase === "preparing" && <small>蓄力 {noble.charge}/{noble.requiredCharge}</small>}
              {noble.phase === "cooldown" && <small>冷却 {noble.cooldownRemaining} 回合</small>}
            </div>
            {noble.phase === "hidden" && (
              <button type="button" disabled={!canPrepare} onClick={prepareNoblePhantasm}>
                准备 · {definition?.manaCost ?? 0} MP · {targets.length}目标
              </button>
            )}
            {noble.phase === "ready" && (
              <button type="button" className="release-action" disabled={!canRelease} onClick={releaseNoblePhantasm}>
                真名解放
              </button>
            )}
            {noble.phase === "preparing" && <p>受到高于 {noble.interruptThreshold} 点伤害或发生位移会被打断。</p>}
          </div>
        );
      })()}

      {(activeUnit.barrier > 0 || activeUnit.battleContinuationActive) && (
        <div className="ability-statuses">
          {activeUnit.barrier > 0 && <span>投影护盾 {activeUnit.barrier}</span>}
          {activeUnit.battleContinuationActive && <span>战斗续行待命</span>}
        </div>
      )}
    </section>
  );
}
