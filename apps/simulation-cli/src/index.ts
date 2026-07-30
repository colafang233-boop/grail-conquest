#!/usr/bin/env node
import { runBalanceTournament } from "@grail/core";

interface CliOptions {
  readonly runs: number;
  readonly seed: number;
  readonly strict: boolean;
  readonly pretty: boolean;
}

const options = parseArguments(process.argv.slice(2));
const report = runBalanceTournament({ runs: options.runs, seed: options.seed });
process.stdout.write(`${JSON.stringify(report, null, options.pretty ? 2 : 0)}\n`);

if (options.strict && report.warnings.length > 0) process.exitCode = 2;

function parseArguments(args: readonly string[]): CliOptions {
  let runs = 500;
  let seed = 20260730;
  let strict = false;
  let pretty = true;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--runs") {
      runs = readInteger(args[index + 1], "--runs");
      index += 1;
      continue;
    }
    if (argument === "--seed") {
      seed = readInteger(args[index + 1], "--seed");
      index += 1;
      continue;
    }
    if (argument === "--strict") {
      strict = true;
      continue;
    }
    if (argument === "--compact") {
      pretty = false;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      process.stdout.write([
        "Grail Conquest deterministic balance simulator",
        "",
        "Usage:",
        "  pnpm simulate -- --runs 1000 --seed 20260730 --strict",
        "",
        "Options:",
        "  --runs <n>   Matches per selectable faction (default: 500)",
        "  --seed <n>   Deterministic tournament seed",
        "  --strict     Exit with code 2 when balance warnings exist",
        "  --compact    Emit one-line JSON",
      ].join("\n") + "\n");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return { runs, seed, strict, pretty };
}

function readInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${flag} requires a positive integer`);
  return parsed;
}
