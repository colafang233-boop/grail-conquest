import Phaser from "phaser";
import {
  ARCHER_UNIT_ID,
  LANCER_UNIT_ID,
  RIN_UNIT_ID,
  findLegalAttackTargets,
  findReachableHexes,
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
    const battle = gameEngine.getSnapshot().state.battle;
    gameEngine.dispatch({
      type: "battle.move_unit",
      battleId: battle.id,
      unitId: battle.activeUnitId,
      destination,
    });
  }

  private requestAttack(targetId: UnitId): void {
    if (interactionStore.getSnapshot() !== "attack") return;
    const battle = gameEngine.getSnapshot().state.battle;
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
    const reachable = mode === "move" ? findReachableHexes(battle, battle.activeUnitId) : {};
    const targets = new Set(
      mode === "attack"
        ? findLegalAttackTargets(battle, battle.activeUnitId).map(unit => unit.id)
        : [],
    );

    for (const [key, polygon] of this.tileViews) {
      const tile = battle.tiles[key];
      if (!tile) continue;

      if (tile.blocked) polygon.setStrokeStyle(1.5, 0x3e4655, 0.75);
      else if (reachable[key]) polygon.setStrokeStyle(2.5, 0x73a7b8, 0.95);
      else polygon.setStrokeStyle(1.5, 0x526277, 0.75);
    }

    for (const [unitId, view] of this.unitViews) {
      if (targets.has(unitId)) view.marker.setStrokeStyle(4, 0xe46e78, 1);
      else if (unitId === battle.activeUnitId) view.marker.setStrokeStyle(4, 0xf4c76a, 1);
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
      case "battle.main_action_spent":
      case "battle.reaction_spent":
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
    const view = this.unitViews.get(activeUnitId);
    if (!view) return;

    await new Promise<void>(resolve => {
      this.tweens.add({
        targets: view.container,
        scaleX: 1.13,
        scaleY: 1.13,
        yoyo: true,
        duration: 140,
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
