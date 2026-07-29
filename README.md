# Grail Conquest

A browser-first turn-based strategy prototype built around Holy Grail War-style decisions: a Master–Servant pair, limited command seals, mana pressure, hidden identities, and tactical hex-grid encounters.

The first vertical slice deliberately uses placeholder shapes and focuses on architecture rather than copyrighted art, music, or extracted game assets.

## Current playable slice

- Deterministic TypeScript rules core
- Command → domain event → reducer state pipeline
- Weighted hex-grid reachability and path preview
- React information panels
- Phaser battlefield rendering and animation
- Deterministic attacks, damage, adjacent counterattacks, and unit defeat
- Master protection through Servant guard/interception reactions
- Tactical mana transfer, contract range, and per-round Servant upkeep
- Low-mana combat penalties and contract-stability hooks
- Four command seal effects: recall, extra turn, mana infusion, and reject death
- Authored school-night scenario state machine: investigation, encounter, noble-phantasm warning, and resolution
- Deterministic Lancer enemy turns that prioritize pressure on the Master
- Action-derived intelligence clues and live identity-candidate confidence
- Tactical retreat as a valid objective with an after-action intelligence report
- Browser-local save/load for scenario state and domain-event history
- Vitest coverage for movement, combat, contracts, command seals, and scenario progression
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
