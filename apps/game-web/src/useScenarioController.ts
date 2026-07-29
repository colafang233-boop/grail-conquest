import { useEffect } from "react";
import { LANCER_UNIT_ID } from "@grail/core";
import { useGameSnapshot } from "./hooks/useGameSnapshot";
import { runSchoolNightEnemyTurn } from "./scenario-ai";

export function useScenarioController(): void {
  const snapshot = useGameSnapshot();

  useEffect(() => {
    if (
      snapshot.state.scenario.phase === "investigation" ||
      snapshot.state.scenario.phase === "completed" ||
      snapshot.state.battle.activeUnitId !== LANCER_UNIT_ID
    ) return;

    const timer = window.setTimeout(runSchoolNightEnemyTurn, 520);
    return () => window.clearTimeout(timer);
  }, [
    snapshot.version,
    snapshot.state.battle.activeUnitId,
    snapshot.state.scenario.phase,
  ]);
}
