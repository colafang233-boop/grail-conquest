# Grail Conquest

A browser-first turn-based strategy prototype built around Holy Grail War-style decisions: a Master–Servant pair, limited command seals, mana pressure, hidden identities, strategic region control, and tactical hex-grid encounters.

The current prototype deliberately uses placeholder shapes and focuses on architecture rather than copyrighted art, music, or extracted game assets.

## Current playable slice

- One authoritative deterministic TypeScript `GameState` across strategic and tactical layers
- Command → domain event → reducer state pipeline
- Phaser Fuyuki region-node map with fog of war and connected-route movement
- Six strategic regions: Tohsaka residence, school, shopping street, Fuyuki bridge, harbor, and church
- Strategic action points, investigation, rest, exposure, leyline control, and daily mana income
- Tactical encounter transition into the authored school-night battle
- Return to the Fuyuki map with health, mana, command seals, clues, and reports preserved
- Weighted tactical hex-grid reachability and path preview
- Deterministic attacks, adjacent counterattacks, barriers, displacement, and unit defeat
- Master protection through Servant guard/interception reactions
- Tactical mana transfer, contract range, per-round upkeep, and four command-seal effects
- Authored school-night scenario: investigation, encounter, real noble-phantasm warning, retreat, and after-action report
- Deterministic Lancer enemy turns that prioritize pressure on the Master
- Action-derived intelligence clues and live identity-candidate confidence
- Data-driven authored abilities:
  - Archer: projected shot, projected shield, and guard support
  - Lancer: high-speed thrust, battle continuation, and sweeping strike
- Noble-phantasm state machine: hidden → preparing → ready → released/interrupted → cooldown
- Damage, movement, displacement, and command-seal interruption rules
- Browser-local v2 save/load for strategy state, battle state, and complete event history
- Vitest coverage for routes, action costs, income, encounter transitions, persistence, combat, abilities, and replay determinism
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

`packages/core` has no React, Phaser, browser API, clock, or ambient random-number dependency. Strategic actions, abilities, noble phantasms, contracts, and scenario transitions all emit serializable domain events into one event history.

## Repository status

This is a non-commercial technical prototype. Existing franchise terminology may appear as temporary design reference text. Before public distribution, replace reference names and obtain appropriate rights for any protected characters, visual assets, audio, or story content.
