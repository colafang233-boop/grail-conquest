# Grail Conquest

A browser-first turn-based strategy prototype built around Holy Grail War-style decisions: a Master–Servant pair, limited command seals, mana pressure, hidden identities, and tactical hex-grid encounters.

The current prototype deliberately uses placeholder shapes and focuses on architecture rather than copyrighted art, music, or extracted game assets.

## Current playable slice

- Deterministic TypeScript rules core
- Command → domain event → reducer state pipeline
- Weighted hex-grid reachability and path preview
- React information panels and Phaser battlefield presentation
- Deterministic attacks, adjacent counterattacks, barriers, displacement, and unit defeat
- Master protection through Servant guard/interception reactions
- Tactical mana transfer, contract range, per-round upkeep, and four command-seal effects
- Authored school-night scenario: investigation, encounter, real noble-phantasm warning, retreat, and after-action report
- Deterministic Lancer enemy turns that prioritize pressure on the Master
- Action-derived intelligence clues and live identity-candidate confidence
- Browser-local save/load for authoritative state and domain-event history
- Data-driven authored abilities:
  - Archer: projected shot, projected shield, and guard support
  - Lancer: high-speed thrust, battle continuation, and sweeping strike
- Noble-phantasm state machine: hidden → preparing → ready → released/interrupted → cooldown
- Damage, movement, displacement, and command-seal interruption rules
- Command-seal mana infusion can finish an active preparation
- Vitest coverage for movement, combat, contracts, scenario progression, abilities, interruption, release, and replay determinism
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

`packages/core` has no React, Phaser, browser API, clock, or ambient random-number dependency. Abilities and noble phantasms emit the same serializable domain events as movement, attacks, contracts, and scenario triggers.

## Repository status

This is a non-commercial technical prototype. Existing franchise terminology may appear as temporary design reference text. Before public distribution, replace reference names and obtain appropriate rights for any protected characters, visual assets, audio, or story content.
