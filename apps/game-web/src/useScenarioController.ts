import { useEffect } from "react";
import { TOHSAKA_FACTION_ID } from "@grail/core";
import { useGameSnapshot } from "./hooks/useGameSnapshot";
import { runEncounterAiTurn } from "./scenario-ai";

export function useScenarioController(): void {
  const snapshot = useGameSnapshot();

  useEffect(() => {
    const activeUnit = snapshot.state.battle.units[snapshot.state.battle.activeUnitId];
    if (
      snapshot.state.mode !== "battle" ||
      snapshot.state.scenario.phase === "investigation" ||
      snapshot.state.scenario.phase === "completed" ||
      !activeUnit?.deployed ||
      activeUnit.factionId === TOHSAKA_FACTION_ID
    ) return;

    const timer = window.setTimeout(runEncounterAiTurn, 520);
    return () => window.clearTimeout(timer);
  }, [
    snapshot.version,
    snapshot.state.mode,
    snapshot.state.battle.activeUnitId,
    snapshot.state.scenario.phase,
  ]);
}
