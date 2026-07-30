import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { getBrowserSettings, subscribeBrowserSettings } from "../browser-settings";
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

    const applyMotionPreference = () => {
      const timeScale = getBrowserSettings().reducedMotion ? 1000 : 1;
      for (const scene of game.scene.getScenes(true)) scene.tweens.timeScale = timeScale;
    };
    const timer = window.setTimeout(applyMotionPreference, 0);
    const unsubscribe = subscribeBrowserSettings(applyMotionPreference);

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
      game.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="game-canvas" role="application" aria-label="六边格战斗地图。使用战术终端按钮选择移动、攻击或技能。" />;
}
