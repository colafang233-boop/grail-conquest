# Grail Conquest

A browser-first turn-based strategy prototype built around Holy Grail War-style decisions: Master–Servant contracts, limited command seals, hidden identities, multi-faction strategic operations, temporary diplomacy, and tactical hex-grid encounters.

The current prototype deliberately uses placeholder shapes and focuses on architecture rather than copyrighted art, music, or extracted game assets.

## Current playable slice

- One authoritative deterministic TypeScript `GameState` across strategic and tactical layers
- Command → domain event → reducer state pipeline
- Eight-region Phaser Fuyuki map including Emiya residence and Ryudou Temple
- Four registered factions: Tohsaka/Archer, Lancer, Emiya/Saber, and Ryudou/Caster with Assassin
- Nightly planning followed by four-way hidden orders, simultaneous movement, detection, encounter generation, and dawn settlement
- Faction-specific strategic AI profiles: player, honorable, hunter, and fortifier
- Multi-party contact groups and two- or three-faction tactical encounters
- Diplomacy states: neutral, truce, allied, hostile, and betrayed
- Temporary alliance offers, expiry, shared detection, and explicit agreement breaking
- Church collective-threat bounties for highly exposed factions
- Caster workshop control at Ryudou Temple and workshop preparation bonuses
- Persistent faction positions, exposure, intelligence, resources, status, orders, and known sightings
- Data-driven authored abilities:
  - Archer: projected shot, projected shield, guard support
  - Lancer: high-speed thrust, battle continuation, sweeping strike
  - Saber: Invisible Air, Instinct, Mana Burst
  - Caster: Dragon Tooth defense, boundary field, mana drain, workshop reinforcement
- Noble phantasms for Archer, Lancer, Saber/Excalibur, and Caster/Rule Breaker
- Deployed-unit battle rosters so only encounter participants occupy the hex grid and initiative queue
- Generic non-player tactical AI for Lancer, Saber, Caster, and Assassin turns
- Action-derived identity clues for Lancer, Saber, and Caster candidates
- Browser-local v4 save/load with automatic migration from v2 and v3 saves
- Vitest coverage for operations, diplomacy, multi-party encounters, deployment, abilities, bounties, combat, and replay determinism
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

`packages/core` has no React, Phaser, browser API, clock, or ambient random-number dependency. Faction orders, diplomacy, detection outcomes, encounter groups, abilities, noble phantasms, contracts, and scenario transitions all emit serializable domain events into one history.

## Repository status

This is a non-commercial technical prototype. Existing franchise terminology may appear as temporary design reference text. Before public distribution, replace reference names and obtain appropriate rights for any protected characters, visual assets, audio, or story content.
