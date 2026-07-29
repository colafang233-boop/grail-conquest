import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { BattleScene } from "../phaser/BattleScene";

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: 790,
      height: 550,
      backgroundColor: "#090d14",
      scene: [BattleScene],
      render: { antialias: true },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    return () => game.destroy(true);
  }, []);

  return <div ref={containerRef} className="game-canvas" aria-label="六边格战斗地图" />;
}
