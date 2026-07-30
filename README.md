# Grail Conquest

A browser-first turn-based strategy prototype built around Holy Grail War-style decisions: selectable Master–Servant routes, limited command seals, hidden identities, simultaneous multi-faction operations, temporary diplomacy, and tactical hex-grid encounters.

The prototype deliberately uses placeholder shapes and focuses on architecture rather than copyrighted art, music, or extracted game assets.

## Current playable slice

- Selectable three-night mini-campaign routes:
  - Tohsaka / Archer: true-name intelligence and command-seal conservation
  - Emiya / Saber: protection, encounters, and temporary alliances
  - Ryudou / Caster: workshop growth and leyline control
- Campaign progression, route objectives, consequences, scoring, and ending report
- One authoritative deterministic TypeScript `GameState`
- Command → serializable domain event → reducer pipeline
- Eight-region Phaser Fuyuki map
- Four active factions with hidden simultaneous orders
- Two- and three-party encounters, diplomacy, shared detection, betrayal, and church bounties
- Tactical Master–Servant contracts, command seals, mana transfer, guard reactions, abilities, noble phantasms, and AI turns
- Runtime content registry validation with readable cross-reference diagnostics
- Browser Replay inspector:
  - event stepping and filtering
  - state snapshots
  - Replay JSON import/export
  - final-state fingerprint validation
- Deterministic simulation CLI with faction win rate, encounter rate, order usage, command-seal usage, and remaining-resource metrics
- Browser-local v5 campaign saves with migration from v2–v4
- Vitest coverage for campaign routes, content validation, replay determinism, simulation, operations, diplomacy, combat, and abilities
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

## Validate

```bash
pnpm check
```

This runs workspace type checking, Core tests, and production builds.

## Run balance simulation

```bash
pnpm simulate -- --runs 1000 --seed 20260730
```

Use `--strict` to return a non-zero exit code when regression thresholds produce warnings. Add `--compact` for one-line JSON.

## Architecture boundary

```text
React UI / Phaser presentation / simulation CLI
                    ↓ commands
              application engine
                    ↓
              pure rules core
                    ↓ events
                 reducers
```

`packages/core` has no React, Phaser, browser API, clock, or ambient random-number dependency. Campaign progression, content validation, faction orders, diplomacy, detections, encounters, abilities, contracts, replay documents, and balance reports remain deterministic Core concerns.

## Repository status

This is a non-commercial technical prototype. Existing franchise terminology may appear as temporary design reference text. Before public distribution, replace reference names and obtain appropriate rights for protected characters, visual assets, audio, or story content.
