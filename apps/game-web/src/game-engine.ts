import { GameEngine } from "@grail/application";
import { createSchoolBattleState } from "@grail/core";

export const gameEngine = new GameEngine(createSchoolBattleState());
