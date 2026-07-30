import Phaser from "phaser";
import {
  ARCHER_UNIT_ID,
  ASSASSIN_UNIT_ID,
  CASTER_UNIT_ID,
  LANCER_UNIT_ID,
  RIN_UNIT_ID,
  SABER_UNIT_ID,
  findLegalAbilityTargets,
  findLegalAttackTargets,
  findLegalNoblePhantasmTargets,
  findReachableHexes,
  getPlayerFactionId,
  hexDistance,
  hexKey,
  type BattleUnitState,
  type DomainEvent,
  type HexCoord,
  type UnitId,
} from "@grail/core";
import { gameEngine } from "../game-engine";
import { interactionStore, type InteractionState } from "../interaction-store";
import { createHexPoints, hexToPixel } from "./hex-layout";
import { PresentationQueue } from "./PresentationQueue";

const HEX_SIZE = 39;
const OFFSET_X = 95;
const OFFSET_Y = 90;

interface UnitView {
  readonly container: Phaser.GameObjects.Container;
  readonly marker: Phaser.GameObjects.Arc;
}

export class BattleScene extends Phaser.Scene {
  private readonly tileViews = new Map<string, Phaser.GameObjects.Polygon>();
  private readonly unitViews = new Map<UnitId, UnitView>();
  private readonly queue = new PresentationQueue(event => this.presentEvent(event));
  private unsubscribeGame?: () => void;
  private unsubscribeInteraction?: () => void;

  public constructor() {
    super("battle");
  }

  public create(): void {
    this.drawBattlefield();
    this.drawUnits();
    this.refreshInteractionHighlights();
    this.unsubscribeGame = gameEngine.subscribe(() => {
      const snapshot = gameEngine.getSnapshot();
      this.queue.enqueue(snapshot.lastEvents);
      this.refreshUnitViews();
    });
    this.unsubscribeInteraction = interactionStore.subscribe(() => this.refreshInteractionHighlights());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeGame?.();
      this.unsubscribeInteraction?.();
    });
  }

  private drawBattlefield(): void {
    const battle = gameEngine.getSnapshot().state.battle;
    const points = createHexPoints(HEX_SIZE);
    for (const tile of Object.values(battle.tiles)) {
      const pixel = hexToPixel(tile.coord, HEX_SIZE, OFFSET_X, OFFSET_Y);
      const fillColor = tile.blocked ? 0x202633 : tile.terrain === "rubble" ? 0x3d3540 : 0x172231;
      const polygon = this.add.polygon(pixel.x, pixel.y, points, fillColor, 1).setStrokeStyle(1.5, 0x526277, 0.85);
      this.tileViews.set(hexKey(tile.coord), polygon);
      if (!tile.blocked) {
        polygon.setInteractive({ useHandCursor: true });
        polygon.on(Phaser.Input.Events.POINTER_OVER, () => {
          if (interactionStore.getSnapshot().type === "move") polygon.setStrokeStyle(3, 0xd1b06b, 1);
        });
        polygon.on(Phaser.Input.Events.POINTER_OUT, () => this.refreshInteractionHighlights());
        polygon.on(Phaser.Input.Events.POINTER_DOWN, () => this.requestMove(tile.coord));
      }
    }
  }

  private drawUnits(): void {
    const battle = gameEngine.getSnapshot().state.battle;
    for (const unit of Object.values(battle.units).filter(candidate => candidate.deployed)) {
      const pixel = hexToPixel(unit.position, HEX_SIZE, OFFSET_X, OFFSET_Y);
      const container = this.add.container(pixel.x, pixel.y);
      const marker = this.add.circle(0, 0, 21, this.unitColor(unit));
      marker.setStrokeStyle(3, 0xefe3c7, 1);
      marker.setInteractive({ useHandCursor: true });
      marker.on(Phaser.Input.Events.POINTER_DOWN, () => this.requestUnitInteraction(unit.id));
      const sigil = this.add.text(0, -1, this.unitSigil(unit), {
        color: "#ffffff",
        fontFamily: "Georgia, serif",
        fontSize: "15px",
        fontStyle: "bold",
      }).setOrigin(0.5);
      const label = this.add.text(0, 31, unit.name, {
        color: "#f4efe4",
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        backgroundColor: "#070a0fbb",
        padding: { x: 5, y: 2 },
      }).setOrigin(0.5);
      container.add([marker, sigil, label]);
      this.unitViews.set(unit.id, { container, marker });
    }
    this.refreshUnitViews();
  }

  private canPlayerAct(): boolean {
    const snapshot = gameEngine.getSnapshot();
    const activeUnit = snapshot.state.battle.units[snapshot.state.battle.activeUnitId];
    const playerFactionId = getPlayerFactionId(snapshot.state);
    return Boolean(
      activeUnit?.deployed && activeUnit.factionId === playerFactionId &&
      snapshot.state.scenario.phase !== "investigation" && snapshot.state.scenario.phase !== "completed",
    );
  }

  private requestMove(destination: HexCoord): void {
    if (interactionStore.getSnapshot().type !== "move" || !this.canPlayerAct()) return;
    const battle = gameEngine.getSnapshot().state.battle;
    gameEngine.dispatch({ type: "battle.move_unit", battleId: battle.id, unitId: battle.activeUnitId, destination });
  }

  private requestUnitInteraction(targetId: UnitId): void {
    if (!this.canPlayerAct()) return;
    const mode = interactionStore.getSnapshot();
    const battle = gameEngine.getSnapshot().state.battle;
    let result;
    switch (mode.type) {
      case "attack":
        result = gameEngine.dispatch({ type: "battle.attack_unit", battleId: battle.id, attackerId: battle.activeUnitId, targetId });
        break;
      case "ability":
        result = gameEngine.dispatch({ type: "ability.use", battleId: battle.id, actorId: battle.activeUnitId, abilityId: mode.abilityId, targetId });
        break;
      case "noble_phantasm":
        result = gameEngine.dispatch({ type: "noble_phantasm.prepare", battleId: battle.id, servantId: battle.activeUnitId, targetId });
        break;
      case "move":
        return;
    }
    if (result.ok) interactionStore.setMode({ type: "move" });
  }

  private refreshInteractionHighlights(): void {
    const snapshot = gameEngine.getSnapshot();
    const battle = snapshot.state.battle;
    const mode: InteractionState = interactionStore.getSnapshot();
    const activeUnit = battle.units[battle.activeUnitId];
    const playerCanAct = this.canPlayerAct();
    const reachable = playerCanAct && mode.type === "move" ? findReachableHexes(battle, battle.activeUnitId) : {};
    const targetIds = new Set<UnitId>();
    if (playerCanAct && activeUnit) {
      if (mode.type === "attack") for (const unit of findLegalAttackTargets(battle, activeUnit.id)) targetIds.add(unit.id);
      if (mode.type === "ability") for (const unit of findLegalAbilityTargets(battle, activeUnit.id, mode.abilityId)) targetIds.add(unit.id);
      if (mode.type === "noble_phantasm") for (const unit of findLegalNoblePhantasmTargets(battle, activeUnit.id)) targetIds.add(unit.id);
    }

    const playerFactionId = getPlayerFactionId(snapshot.state);
    const contract = battle.contracts[playerFactionId];
    const master = contract ? battle.units[contract.masterId] : undefined;
    const servant = contract ? battle.units[contract.servantId] : undefined;
    const protectedMasterId = contract && master?.deployed && servant?.deployed && !servant.defeated &&
      servant.reactionAvailable && hexDistance(master.position, servant.position) <= contract.guardRange + servant.guardBonus
      ? master.id : undefined;

    for (const [key, polygon] of this.tileViews) {
      const tile = battle.tiles[key];
      if (!tile) continue;
      if (tile.blocked) polygon.setStrokeStyle(1.5, 0x3e4655, 0.75);
      else if (reachable[key]) polygon.setStrokeStyle(2.5, 0x73a7b8, 0.95);
      else polygon.setStrokeStyle(1.5, 0x526277, 0.75);
    }

    for (const [unitId, view] of this.unitViews) {
      const unit = battle.units[unitId];
      if (!unit?.deployed) {
        view.container.setVisible(false);
        continue;
      }
      view.container.setVisible(true);
      if (targetIds.has(unitId)) {
        const color = mode.type === "noble_phantasm" ? 0xe8a15b : mode.type === "ability" ? 0x8d78d8 : 0xe46e78;
        view.marker.setStrokeStyle(4, color, 1);
      } else if (unit.noblePhantasm?.phase === "preparing") view.marker.setStrokeStyle(5, 0xd84955, 1);
      else if (unit.noblePhantasm?.phase === "ready") view.marker.setStrokeStyle(5, 0xffc857, 1);
      else if (unitId === battle.activeUnitId) view.marker.setStrokeStyle(4, 0xf4c76a, 1);
      else if (unit.deathWardActive || unit.battleContinuationActive) view.marker.setStrokeStyle(4, 0xb78cf0, 1);
      else if (unit.barrier > 0) view.marker.setStrokeStyle(4, 0x65b9d2, 1);
      else if (unitId === protectedMasterId) view.marker.setStrokeStyle(4, 0x71c8bd, 1);
      else view.marker.setStrokeStyle(3, 0xefe3c7, 1);
    }
  }

  private refreshUnitViews(): void {
    const battle = gameEngine.getSnapshot().state.battle;
    for (const [unitId, view] of this.unitViews) {
      const unit = battle.units[unitId];
      if (!unit) continue;
      view.container.setVisible(unit.deployed).setAlpha(unit.defeated ? 0.28 : 1);
    }
    this.refreshInteractionHighlights();
  }

  private async presentEvent(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case "battle.unit_moved": await this.presentMovement(event.unitId, event.path); return;
      case "battle.unit_displaced": await this.presentMovement(event.unitId, [event.to]); return;
      case "battle.attack_started": await this.presentAttack(event.attackerId, event.targetId); return;
      case "battle.damage_dealt":
      case "battle.barrier_absorbed": await this.presentDamage(event.targetId); return;
      case "battle.unit_defeated": await this.presentDefeat(event.unitId); return;
      case "battle.turn_advanced": await this.presentPulse(event.activeUnitId, 1.13, 140); return;
      case "battle.mana_spent": await this.presentPulse(event.unitId, 1.08, 100); return;
      case "ability.used": await this.presentPulse(event.actorId, 1.14, 130); return;
      case "ability.barrier_applied": await this.presentPulse(event.targetId, 1.2, 180); return;
      case "ability.guard_support_activated":
      case "ability.battle_continuation_activated":
      case "ability.battle_continuation_triggered": await this.presentPulse(event.servantId, 1.22, 190); return;
      case "noble_phantasm.preparation_started": await this.presentPulse(event.servantId, 1.28, 240); return;
      case "noble_phantasm.charge_advanced":
      case "noble_phantasm.ready": await this.presentPulse(event.servantId, 1.2, 180); return;
      case "noble_phantasm.released": await this.presentAttack(event.servantId, event.targetId); return;
      case "noble_phantasm.interrupted": await this.presentInterrupted(event.servantId); return;
      case "contract.master_guarded": await this.presentGuard(event.guardianId, event.masterId); return;
      case "contract.mana_transferred": await this.presentManaTransfer(event.masterId, event.servantId); return;
      case "contract.servant_upkeep_paid":
      case "contract.low_mana_changed": await this.presentPulse(event.servantId); return;
      case "contract.command_seal_used": await this.presentCommandSeal(String(event.factionId)); return;
      case "contract.servant_recalled": await this.presentRecall(event.servantId, event.to); return;
      case "contract.extra_turn_granted": await this.presentPulse(event.servantId, 1.13, 140); return;
      case "contract.mana_restored":
      case "contract.death_ward_activated": await this.presentPulse(event.servantId); return;
      case "contract.death_rejected": await this.presentDeathRejected(event.servantId); return;
      case "scenario.noble_phantasm_warning": await this.presentPulse(event.enemyId, 1.3, 260); return;
      default: return;
    }
  }

  private async presentMovement(unitId: UnitId, path: readonly HexCoord[]): Promise<void> {
    const view = this.unitViews.get(unitId);
    if (!view) return;
    for (const coord of path) {
      const destination = hexToPixel(coord, HEX_SIZE, OFFSET_X, OFFSET_Y);
      await new Promise<void>(resolve => this.tweens.add({ targets: view.container, x: destination.x, y: destination.y, duration: 150, ease: "Sine.easeInOut", onComplete: () => resolve() }));
    }
  }

  private async presentAttack(attackerId: UnitId, targetId: UnitId): Promise<void> {
    const attacker = this.unitViews.get(attackerId);
    const target = this.unitViews.get(targetId);
    if (!attacker || !target) return;
    const origin = { x: attacker.container.x, y: attacker.container.y };
    const dx = target.container.x - origin.x;
    const dy = target.container.y - origin.y;
    const length = Math.hypot(dx, dy) || 1;
    await new Promise<void>(resolve => this.tweens.add({ targets: attacker.container, x: origin.x + (dx / length) * 18, y: origin.y + (dy / length) * 18, duration: 90, yoyo: true, onComplete: () => resolve() }));
  }

  private async presentDamage(targetId: UnitId): Promise<void> {
    const target = this.unitViews.get(targetId);
    if (!target) return;
    await new Promise<void>(resolve => this.tweens.add({ targets: target.marker, alpha: 0.15, duration: 70, yoyo: true, repeat: 1, onComplete: () => resolve() }));
  }

  private async presentDefeat(unitId: UnitId): Promise<void> {
    const view = this.unitViews.get(unitId);
    if (!view) return;
    await new Promise<void>(resolve => this.tweens.add({ targets: view.container, alpha: 0.28, scaleX: 0.82, scaleY: 0.82, duration: 220, onComplete: () => resolve() }));
  }

  private async presentGuard(guardianId: UnitId, masterId: UnitId): Promise<void> {
    const guardian = this.unitViews.get(guardianId);
    const master = this.unitViews.get(masterId);
    if (!guardian || !master) return;
    const origin = { x: guardian.container.x, y: guardian.container.y };
    const dx = master.container.x - origin.x;
    const dy = master.container.y - origin.y;
    const length = Math.hypot(dx, dy) || 1;
    await new Promise<void>(resolve => this.tweens.add({ targets: guardian.container, x: origin.x + (dx / length) * 20, y: origin.y + (dy / length) * 20, duration: 110, yoyo: true, onComplete: () => resolve() }));
  }

  private async presentManaTransfer(masterId: UnitId, servantId: UnitId): Promise<void> {
    await Promise.all([this.presentPulse(masterId, 1.08, 120), this.presentPulse(servantId, 1.16, 160)]);
  }

  private async presentCommandSeal(factionId: string): Promise<void> {
    const contract = gameEngine.getSnapshot().state.battle.contracts[factionId];
    if (contract) await this.presentPulse(contract.masterId, 1.18, 180);
  }

  private async presentRecall(servantId: UnitId, to: HexCoord): Promise<void> {
    const view = this.unitViews.get(servantId);
    if (!view) return;
    const destination = hexToPixel(to, HEX_SIZE, OFFSET_X, OFFSET_Y);
    await new Promise<void>(resolve => this.tweens.add({ targets: view.container, x: destination.x, y: destination.y, alpha: { from: 0.3, to: 1 }, duration: 260, ease: "Sine.easeOut", onComplete: () => resolve() }));
  }

  private async presentDeathRejected(servantId: UnitId): Promise<void> {
    const view = this.unitViews.get(servantId);
    if (!view) return;
    view.container.setAlpha(1).setScale(1);
    await this.presentPulse(servantId, 1.28, 220);
  }

  private async presentInterrupted(servantId: UnitId): Promise<void> {
    const view = this.unitViews.get(servantId);
    if (!view) return;
    await new Promise<void>(resolve => this.tweens.add({ targets: view.container, x: view.container.x + 8, duration: 45, yoyo: true, repeat: 3, onComplete: () => resolve() }));
  }

  private async presentPulse(unitId: UnitId, scale = 1.12, duration = 140): Promise<void> {
    const view = this.unitViews.get(unitId);
    if (!view) return;
    await new Promise<void>(resolve => this.tweens.add({ targets: view.container, scaleX: scale, scaleY: scale, yoyo: true, duration, onComplete: () => resolve() }));
  }

  private unitColor(unit: BattleUnitState): number {
    if (unit.id === ARCHER_UNIT_ID) return 0x9e3340;
    if (unit.id === RIN_UNIT_ID) return 0x711f3e;
    if (unit.id === LANCER_UNIT_ID) return 0x315a9b;
    if (unit.id === SABER_UNIT_ID) return 0x4f78b8;
    if (unit.id === CASTER_UNIT_ID) return 0x8050a5;
    if (unit.id === ASSASSIN_UNIT_ID) return 0x4f5260;
    return 0x6a7280;
  }

  private unitSigil(unit: BattleUnitState): string {
    if (unit.role === "master") return "M";
    if (unit.id === ARCHER_UNIT_ID) return "A";
    if (unit.id === LANCER_UNIT_ID) return "L";
    if (unit.id === SABER_UNIT_ID) return "S";
    if (unit.id === CASTER_UNIT_ID) return "C";
    if (unit.id === ASSASSIN_UNIT_ID) return "As";
    return "?";
  }
}
