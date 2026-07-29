# Grail Conquest

A browser-first turn-based strategy prototype built around Holy Grail War-style decisions: a Master–Servant pair, limited command seals, mana pressure, hidden identities, strategic region control, simultaneous nightly orders, and tactical hex-grid encounters.

The current prototype deliberately uses placeholder shapes and focuses on architecture rather than copyrighted art, music, or extracted game assets.

## Current playable slice

- One authoritative deterministic TypeScript `GameState` across strategic and tactical layers
- Command → domain event → reducer state pipeline
- Phaser Fuyuki region-node map with fog of war and connected routes
- Six strategic regions: Tohsaka residence, school, shopping street, Fuyuki bridge, harbor, and church
- Nightly operation phases: planning → orders locked → simultaneous movement → detection → encounter → settlement
- Player orders for movement, investigation, leyline operations, ambush, rest, and workshop preparation
- Hidden deterministic Lancer-faction orders generated only after the player locks a plan
- Exposure, intelligence, order posture, stealth, and a saved deterministic seed drive detection checks
- Mutual detection, one-sided detection, missed encounters, and player/enemy ambush advantage
- Generated school, bridge, and harbor encounter definitions
- Dawn mana income followed by Servant upkeep and low-mana status evaluation
- Return to the Fuyuki map with health, mana, command seals, clues, reports, enemy sightings, and operation history preserved
- Weighted tactical hex-grid reachability and path preview
- Deterministic attacks, adjacent counterattacks, barriers, displacement, and unit defeat
- Master protection through Servant guard/interception reactions
- Tactical mana transfer, contract range, per-round upkeep, and four command-seal effects
- Authored Lancer identity clues and live candidate confidence
- Data-driven authored abilities:
  - Archer: projected shot, projected shield, and guard support
  - Lancer: high-speed thrust, battle continuation, and sweeping strike
- Noble-phantasm state machine: hidden → preparing → ready → released/interrupted → cooldown
- Damage, movement, displacement, and command-seal interruption rules
- Browser-local v3 save/load with automatic migration from strategic v2 saves
- Vitest coverage for order locking, simultaneous resolution, detection, routes, income, encounters, persistence, combat, abilities, and replay determinism
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

`packages/core` has no React, Phaser, browser API, clock, or ambient random-number dependency. Player orders, hidden enemy orders, detection outcomes, strategic actions, abilities, noble phantasms, contracts, and scenario transitions all emit serializable domain events into one history.

## Repository status

This is a non-commercial technical prototype. Existing franchise terminology may appear as temporary design reference text. Before public distribution, replace reference names and obtain appropriate rights for any protected characters, visual assets, audio, or story content.
