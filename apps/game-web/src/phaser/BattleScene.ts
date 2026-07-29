import Phaser from "phaser";
import {
  ARCHER_UNIT_ID,
  LANCER_UNIT_ID,
  RIN_UNIT_ID,
  TOHSAKA_FACTION_ID,
  findLegalAttackTargets,
  findReachableHexes,
  hexDistance,
  hexKey,
  type BattleUnitState,
  type DomainEvent,
  type HexCoord,
  type UnitId,
} from "@grail/core";
import { gameEngine } from "../game-engine";
import { interactionStore, type InteractionMode } from "../interaction-store";
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
      this.refreshInteractionHighlights();
      this.refreshUnitViews();
    });

    this.unsubscribeInteraction = interactionStore.subscribe(() => {
      this.refreshInteractionHighlights();
    });

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
      const fillColor = tile.blocked
        ? 0x202633
        : tile.terrain === "rubble"
          ? 0x3d3540
          : 0x172231;

      const polygon = this.add
        .polygon(pixel.x, pixel.y, points, fillColor, 1)
        .setStrokeStyle(1.5, 0x526277, 0.85);

      this.tileViews.set(hexKey(tile.coord), polygon);

      if (!tile.blocked) {
        polygon.setInteractive({ useHandCursor: true });
        polygon.on(Phaser.Input.Events.POINTER_OVER, () => {
          if (interactionStore.getSnapshot() === "move") {
            polygon.setStrokeStyle(3, 0xd1b06b, 1);
          }
        });
        polygon.on(Phaser.Input.Events.POINTER_OUT, () => this.refreshInteractionHighlights());
        polygon.on(Phaser.Input.Events.POINTER_DOWN, () => this.requestMove(tile.coord));
      }
    }
  }

  private drawUnits(): void {
    const battle = gameEngine.getSnapshot().state.battle;

    for (const unit of Object.values(battle.units)) {
      const pixel = hexToPixel(unit.position, HEX_SIZE, OFFSET_X, OFFSET_Y);
      const container = this.add.container(pixel.x, pixel.y);
      const marker = this.add.circle(0, 0, 21, this.unitColor(unit));
      marker.setStrokeStyle(3, 0xefe3c7, 1);
      marker.setInteractive({ useHandCursor: true });
      marker.on(Phaser.Input.Events.POINTER_DOWN, () => this.requestAttack(unit.id));

      const sigil = this.add
        .text(0, -1, unit.role === "master" ? "M" : unit.id === ARCHER_UNIT_ID ? "A" : "L", {
          color: "#ffffff",
          fontFamily: "Georgia, serif",
          fontSize: "17px",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      const label = this.add
        .text(0, 31, unit.name, {
          color: "#f4efe4",
          fontFamily: "system-ui, sans-serif",
          fontSize: "12px",
          backgroundColor: "#070a0fbb",
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5);

      container.add([marker, sigil, label]);
      this.unitViews.set(unit.id, { container, marker });
    }

    this.refreshUnitViews();
  }

  private requestMove(destination: HexCoord): void {
    if (interactionStore.getSnapshot() !== "move") return;
    const snapshot = gameEngine.getSnapshot();
    const battle = snapshot.state.battle;
    const activeUnit = battle.units[battle.activeUnitId];
    if (
      snapshot.state.scenario.phase === "investigation" ||
      snapshot.state.scenario.phase === "completed" ||
      activeUnit?.factionId !== TOHSAKA_FACTION_ID
    ) return;
    gameEngine.dispatch({
      type: "battle.move_unit",
      battleId: battle.id,
      unitId: battle.activeUnitId,
      destination,
    });
  }

  private requestAttack(targetId: UnitId): void {
    if (interactionStore.getSnapshot() !== "attack") return;
    const snapshot = gameEngine.getSnapshot();
    const battle = snapshot.state.battle;
    const activeUnit = battle.units[battle.activeUnitId];
    if (
      snapshot.state.scenario.phase === "investigation" ||
      snapshot.state.scenario.phase === "completed" ||
      activeUnit?.factionId !== TOHSAKA_FACTION_ID
    ) return;
    const result = gameEngine.dispatch({
      type: "battle.attack_unit",
      battleId: battle.id,
      attackerId: battle.activeUnitId,
      targetId,
    });

    if (result.ok) interactionStore.setMode("move");
  }

  private refreshInteractionHighlights(): void {
    const snapshot = gameEngine.getSnapshot();
    const battle = snapshot.state.battle;
    const mode: InteractionMode = interactionStore.getSnapshot();
    const activeUnit = battle.units[battle.activeUnitId];
    const playerCanAct = activeUnit?.factionId === TOHSAKA_FACTION_ID &&
      snapshot.state.scenario.phase !== "investigation" &&
      snapshot.state.scenario.phase !== "completed";
    const reachable = playerCanAct && mode === "move" ? findReachableHexes(battle, battle.activeUnitId) : {};
    const targets = new Set(
      playerCanAct && mode === "attack"
        ? findLegalAttackTargets(battle, battle.activeUnitId).map(unit => unit.id)
        : [],
    );
    const contract = battle.contracts[TOHSAKA_FACTION_ID];
    const master = contract ? battle.units[contract.masterId] : undefined;
    const servant = contract ? battle.units[contract.servantId] : undefined;
    const protectedMasterId = contract && master && servant && !servant.defeated &&
      servant.reactionAvailable && hexDistance(master.position, servant.position) <= contract.guardRange
      ? master.id
      : undefined;

    for (const [key, polygon] of this.tileViews) {
      const tile = battle.tiles[key];
      if (!tile) continue;

      if (tile.blocked) polygon.setStrokeStyle(1.5, 0x3e4655, 0.75);
      else if (reachable[key]) polygon.setStrokeStyle(2.5, 0x73a7b8, 0.95);
      else polygon.setStrokeStyle(1.5, 0x526277, 0.75);
    }

    for (const [unitId, view] of this.unitViews) {
      const unit = battle.units[unitId];
      if (targets.has(unitId)) view.marker.setStrokeStyle(4, 0xe46e78, 1);
      else if (unitId === battle.activeUnitId) view.marker.setStrokeStyle(4, 0xf4c76a, 1);
      else if (unit?.deathWardActive) view.marker.setStrokeStyle(4, 0xb78cf0, 1);
      else if (unitId === protectedMasterId) view.marker.setStrokeStyle(4, 0x71c8bd, 1);
      else view.marker.setStrokeStyle(3, 0xefe3c7, 1);
    }
  }

  private refreshUnitViews(): void {
    const battle = gameEngine.getSnapshot().state.battle;

    for (const [unitId, view] of this.unitViews) {
      const unit = battle.units[unitId];
      if (!unit) continue;
      view.container.setAlpha(unit.defeated ? 0.28 : 1);
    }

    this.refreshInteractionHighlights();
  }

  private async presentEvent(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case "battle.unit_moved":
        await this.presentMovement(event.unitId, event.path);
        return;
      case "battle.attack_started":
        await this.presentAttack(event.attackerId, event.targetId);
        return;
      case "battle.damage_dealt":
        await this.presentDamage(event.targetId);
        return;
      case "battle.unit_defeated":
        await this.presentDefeat(event.unitId);
        return;
      case "battle.turn_advanced":
        await this.presentTurnAdvance(event.activeUnitId);
        return;
      case "contract.master_guarded":
        await this.presentGuard(event.guardianId, event.masterId);
        return;
      case "contract.mana_transferred":
        await this.presentManaTransfer(event.masterId, event.servantId);
        return;
      case "contract.servant_upkeep_paid":
      case "contract.low_mana_changed":
        await this.presentPulse(event.servantId);
        return;
      case "contract.command_seal_used":
        await this.presentCommandSeal(event.factionId);
        return;
      case "contract.servant_recalled":
        await this.presentRecall(event.servantId, event.to);
        return;
      case "contract.extra_turn_granted":
        await this.presentTurnAdvance(event.servantId);
        return;
      case "contract.mana_restored":
      case "contract.death_ward_activated":
        await this.presentPulse(event.servantId);
        return;
      case "contract.death_rejected":
        await this.presentDeathRejected(event.servantId);
        return;
      case "scenario.noble_phantasm_warning":
        await this.presentPulse(event.enemyId, 1.24, 240);
        return;
      case "scenario.encounter_started":
      case "scenario.clue_discovered":
      case "scenario.completed":
      case "battle.main_action_spent":
      case "battle.reaction_spent":
      case "contract.stability_changed":
        return;
    }
  }

  private async presentMovement(unitId: UnitId, path: readonly HexCoord[]): Promise<void> {
    const view = this.unitViews.get(unitId);
    if (!view) return;

    for (const coord of path) {
      const destination = hexToPixel(coord, HEX_SIZE, OFFSET_X, OFFSET_Y);
      await new Promise<void>(resolve => {
        this.tweens.add({
          targets: view.container,
          x: destination.x,
          y: destination.y,
          duration: 150,
          ease: "Sine.easeInOut",
          onComplete: () => resolve(),
        });
      });
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
    const lunge = 18;

    await new Promise<void>(resolve => {
      this.tweens.add({
        targets: attacker.container,
        x: origin.x + (dx / length) * lunge,
        y: origin.y + (dy / length) * lunge,
        duration: 90,
        yoyo: true,
        onComplete: () => resolve(),
      });
    });
  }

  private async presentDamage(targetId: UnitId): Promise<void> {
    const target = this.unitViews.get(targetId);
    if (!target) return;

    await new Promise<void>(resolve => {
      this.tweens.add({
        targets: target.marker,
        alpha: 0.15,
        duration: 70,
        yoyo: true,
        repeat: 1,
        onComplete: () => resolve(),
      });
    });
  }

  private async presentDefeat(unitId: UnitId): Promise<void> {
    const view = this.unitViews.get(unitId);
    if (!view) return;

    await new Promise<void>(resolve => {
      this.tweens.add({
        targets: view.container,
        alpha: 0.28,
        scaleX: 0.82,
        scaleY: 0.82,
        duration: 220,
        onComplete: () => resolve(),
      });
    });
  }

  private async presentTurnAdvance(activeUnitId: UnitId): Promise<void> {
    await this.presentPulse(activeUnitId, 1.13, 140);
  }

  private async presentGuard(guardianId: UnitId, masterId: UnitId): Promise<void> {
    const guardian = this.unitViews.get(guardianId);
    const master = this.unitViews.get(masterId);
    if (!guardian || !master) return;

    const origin = { x: guardian.container.x, y: guardian.container.y };
    const dx = master.container.x - origin.x;
    const dy = master.container.y - origin.y;
    const length = Math.hypot(dx, dy) || 1;

    await new Promise<void>(resolve => {
      this.tweens.add({
        targets: guardian.container,
        x: origin.x + (dx / length) * 20,
        y: origin.y + (dy / length) * 20,
        duration: 110,
        yoyo: true,
        onComplete: () => resolve(),
      });
    });
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
    await new Promise<void>(resolve => {
      this.tweens.add({
        targets: view.container,
        x: destination.x,
        y: destination.y,
        alpha: { from: 0.3, to: 1 },
        duration: 260,
        ease: "Sine.easeOut",
        onComplete: () => resolve(),
      });
    });
  }

  private async presentDeathRejected(servantId: UnitId): Promise<void> {
    const view = this.unitViews.get(servantId);
    if (!view) return;
    view.container.setAlpha(1).setScale(1);
    await this.presentPulse(servantId, 1.28, 220);
  }

  private async presentPulse(unitId: UnitId, scale = 1.12, duration = 140): Promise<void> {
    const view = this.unitViews.get(unitId);
    if (!view) return;
    await new Promise<void>(resolve => {
      this.tweens.add({
        targets: view.container,
        scaleX: scale,
        scaleY: scale,
        yoyo: true,
        duration,
        onComplete: () => resolve(),
      });
    });
  }

  private unitColor(unit: BattleUnitState): number {
    if (unit.id === ARCHER_UNIT_ID) return 0x9e3340;
    if (unit.id === RIN_UNIT_ID) return 0x711f3e;
    if (unit.id === LANCER_UNIT_ID) return 0x315a9b;
    return 0x6a7280;
  }
}
