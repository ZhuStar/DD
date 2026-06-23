// This repository hosts multiple tabletop character systems that share a common
// foundation:
//
//   - common      — the game-agnostic text format, rules API, and resolver.
//   - dnd5e       — Dungeons & Dragons 5e ("D5C").
//   - storyteller — classic White Wolf Storyteller System ("STC").
//
// The shared `common` building blocks are also re-exported flat for convenience
// (e.g. `RuleRegistry`, `InMemoryRuleSource`, `ParseDocument`). Each game system
// is exported under its own namespace to avoid name collisions.

export * as Common from "./common/index.ts";
export * as Dnd5e from "./dnd5e/index.ts";
export * as Storyteller from "./storyteller/index.ts";

// Flat re-export of the shared foundation.
export * from "./common/index.ts";
