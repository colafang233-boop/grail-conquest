import Phaser from "phaser";
import {
  ARCHER_UNIT_ID,
  LANCER_UNIT_ID,
  RIN_UNIT_ID,
  findReachableHexes,
  hexKey,
  type BattleUnitState,
  type DomainEvent,
  type HexCoord,
  type UnitId,
} from "@grail/core";
import { gameEngine } from "../game-engine";
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
  private unsubscribe?: () => void;

  public constructor() {
    super("battle");
  }

  public create(): void {
    this.drawBattlefield();
    this.drawUnits();
    this.refreshReachableTiles();

    this.unsubscribe = gameEngine.subscribe(() => {
      const snapshot = gameEngine.getSnapshot();
      this.queue.enqueue(snapshot.lastEvents);
      this.refreshReachableTiles();
      this.refreshActiveUnitMarkers();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
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
          polygon.setStrokeStyle(3, 0xd1b06b, 1);
        });
        polygon.on(Phaser.Input.Events.POINTER_OUT, () => {
          this.refreshReachableTiles();
        });
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

    this.refreshActiveUnitMarkers();
  }

  private requestMove(destination: HexCoord): void {
    const battle = gameEngine.getSnapshot().state.battle;
    gameEngine.dispatch({
      type: "battle.move_unit",
      battleId: battle.id,
      unitId: battle.activeUnitId,
      destination,
    });
  }

  private refreshReachableTiles(): void {
    const battle = gameEngine.getSnapshot().state.battle;
    const reachable = findReachableHexes(battle, battle.activeUnitId);

    for (const [key, polygon] of this.tileViews) {
      const tile = battle.tiles[key];
      if (!tile) continue;

      if (tile.blocked) {
        polygon.setStrokeStyle(1.5, 0x3e4655, 0.75);
      } else if (reachable[key]) {
        polygon.setStrokeStyle(2.5, 0x73a7b8, 0.95);
      } else {
        polygon.setStrokeStyle(1.5, 0x526277, 0.75);
      }
    }
  }

  private refreshActiveUnitMarkers(): void {
    const activeUnitId = gameEngine.getSnapshot().state.battle.activeUnitId;

    for (const [unitId, view] of this.unitViews) {
      view.marker.setStrokeStyle(unitId === activeUnitId ? 4 : 3, unitId === activeUnitId ? 0xf4c76a : 0xefe3c7, 1);
    }
  }

  private async presentEvent(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case "battle.unit_moved":
        await this.presentMovement(event.unitId, event.path);
        return;
      case "battle.turn_advanced":
        await this.presentTurnAdvance(event.activeUnitId);
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
