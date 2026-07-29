# Grail Conquest

A browser-first turn-based strategy prototype built around Holy Grail War-style decisions: a Master–Servant pair, limited command seals, mana pressure, hidden identities, and tactical hex-grid encounters.

The first vertical slice deliberately uses placeholder shapes and focuses on architecture rather than copyrighted art, music, or extracted game assets.

## Current playable slice

- Deterministic TypeScript rules core
- Command → domain event → reducer state pipeline
- Weighted hex-grid reachability and path preview
- React information panels
- Phaser battlefield rendering and animation
- Turn advancement between Archer, Lancer, and a Master placeholder
- Vitest coverage for movement, blocking, and turn progression
- GitHub Actions CI and GitHub Pages deployment

## Stack

- TypeScript 7
- React 19
- Phaser 4
- Vite 8
- Vitest 4
- pnpm workspace

## Run locally

```bash
corepack enable
pnpm install
pnpm dev
```

Then open the URL printed by Vite.

## Validate

```bash
pnpm check
```

This runs type checking, unit tests, and the production build.

## Architecture boundary

```text
React UI / Phaser presentation
             ↓ commands
       application engine
             ↓
       pure rules core
             ↓ events
          reducers
```

`packages/core` has no React, Phaser, browser API, clock, or ambient random-number dependency. The browser is a presentation adapter around one authoritative `GameState`.

## Repository status

This is a non-commercial technical prototype. Existing franchise terminology may appear as temporary design reference text. Before public distribution, replace reference names and obtain appropriate rights for any protected characters, visual assets, audio, or story content.
