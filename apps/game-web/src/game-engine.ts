import { GameEngine } from "@grail/application";
import { assertValidContentRegistry, createNewGameState } from "@grail/core";

const initialState = createNewGameState();
assertValidContentRegistry(initialState);

export const gameEngine = new GameEngine(initialState);
