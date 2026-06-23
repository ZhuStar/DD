# Tabletop character formats

Strict, human-editable text formats for storing tabletop RPG characters —
their **selected choices and current play state**, not pre-calculated sheets.
Two game systems are implemented on a shared, game-agnostic foundation:

- **`dnd5e`** — **D5C** ("D&D 5e Character").
- **`storyteller`** — **STC** ("Storyteller Character"), the classic White Wolf
  / World of Darkness Storyteller System (d10 dot/dice-pool traits — *not* 5th
  edition).
- **`common`** — the reusable pieces both systems build on.

Each system runs the same pipeline:

```
text → lexer → parser → raw AST → shape validator → normalizer → resolver → resolved graph
```

The libraries deliberately keep **parsing separate from game rules**. The
parser understands document syntax only; it does not know what a wizard or a
Tremere is, whether a choice is legal, or how to compute AC, spell slots,
Willpower pools, or dice pools. Those belong to later layers.

TypeScript-first, **no runtime dependencies**; tests run on Node's built-in test
runner via native TypeScript type-stripping (Node ≥ 22.6).

## Layout

```
src/
	common/        game-agnostic foundation
		text/        lexer, parser, AST, value/statement helpers (the block syntax)
		rules/       RuleRef / RuleObject / RuleSource / RuleRegistry / InMemoryRuleSource
		resolve/     ResolveReferences engine + resolved-graph types
		character.ts shared Override + Notes normalizers
	dnd5e/         D5C: model, parse, normalize, validate, collectRefs, resolve
	storyteller/   STC: model, parse, normalize, validate, collectRefs, resolve
	index.ts       Common (flat) + Dnd5e / Storyteller namespaces
```

The text syntax, references, dice, errors, the entire rules API, and the
resolver engine live in `common` and are shared verbatim. A concrete system is
mostly a model plus a normalizer; parsing is one line
(`ParseDocument(text, { formatKeyword, rootKeyword })`).

## Quick start

```ts
import { Dnd5e, Storyteller, RuleRegistry, InMemoryRuleSource } from "./src/index.ts";

// D&D 5e
const ast = Dnd5e.ParseD5c(d5cText); // raw AST with source locations
const document = Dnd5e.NormalizeD5c(ast); // typed character model
const registry = new RuleRegistry();
registry.AddSource(new InMemoryRuleSource("srd2014", fakeSrdRules));
const resolved = await Dnd5e.ResolveCharacter(document, registry);
// resolved.rules.byKey: resolved RuleObjects; resolved.diagnostics: misses, etc.

// Storyteller (same shared rules API and resolver)
const stc = Storyteller.NormalizeStc(Storyteller.ParseStc(stcText));
const stRegistry = new RuleRegistry();
stRegistry.AddSource(new InMemoryRuleSource("wod-revised", fakeWodRules));
const stResolved = await Storyteller.ResolveStorytellerCharacter(stc, stRegistry);
```

The shared building blocks (`RuleRegistry`, `InMemoryRuleSource`,
`ParseDocument`, the AST types, diagnostics, …) are exported flat; each game
system is also exported under its own namespace (`Dnd5e`, `Storyteller`).

## The D5C format

A document begins with `D5C <version>` followed by a single `Character` block.
Values are stored as **references** like `@srd2014:spell/fireball`, never as
copied compendium text.

```
D5C 1

Character "Elowen Vale" {
	Game dnd5e-2014
	Xp 6500

	Origin {
		Species @srd2014:race/elf
		Background @srd2014:background/sage
	}

	Levels {
		Level 1 {
			Class @srd2014:class/wizard
			Subclass none
			HitPoints 6
		}
		Level 4 {
			Class @srd2014:class/wizard
			Choice ability-score-improvement {
				Intelligence +2
			}
		}
	}

	Abilities {
		Strength 8
		Intelligence 17
	}

	Choices {
		Skill @srd2014:skill/arcana from background
		Cantrip @srd2014:spell/minor-illusion from species
	}

	Spells {
		Spellbook {
			@srd2014:spell/fireball
		}
	}

	State {
		Used {
			SpellSlot 1 2
			HitDice d6 1
		}
	}

	Overrides {
		ArmorClass 15 because "Mage Armor is currently active"
	}
}
```

A complete example is in [`tests/fixtures/elowen.d5c`](tests/fixtures/elowen.d5c).

### Syntax

- **Blocks** group statements in `{ }`. A block may carry a single label:
  `Level 1 { … }`, `Item "Quarterstaff" { … }`, `Choice ability-score-improvement { … }`.
- **Fields** are `Name value tail*`, terminated by end of line:
  `HitPoints 6`, `Speed walking 30`, `ArmorClass 15 because "…"`. Freeform
  tails are preserved verbatim in the AST; the parser does not interpret them.
- **List items** are bare references on their own line (used inside `Spellbook`,
  `Prepared`, `Conditions`).
- **References**: `@source:type/id` where `source` is a logical namespace
  (`srd2014`, `homebrew`, `campaign`), not a file path.
- **Dice**: `d6`, `1d6`, `1d6+1`, `1d20-2`.
- **Values**: strings (`"…"` with `\" \\ \n \r \t` escapes), numbers, signed
  numbers (`+2`), booleans, `none`, identifiers, references, dice.
- **Comments**: `// line` and `# line`.

Syntax errors throw a `ParseError` carrying diagnostics with line and column.

The Storyteller (STC) format uses the same syntax with an `STC <version>`
header; see [`tests/fixtures/isabeau.stc`](tests/fixtures/isabeau.stc) for a
full Vampire-style sheet (Attributes, Abilities, Disciplines, Virtues,
Willpower, a morality Path, a Blood pool, health levels, and experience).

## Architecture

| Area | Files | Responsibility |
| --- | --- | --- |
| Text syntax (shared) | `src/common/text/` — `lexer.ts`, `parser.ts`, `ast.ts`, `grammar.ts`, `errors.ts`, `values.ts` | Tokenize and parse any block document into a raw AST. Rule-agnostic; the format/root keywords are parameters. |
| Rules API (shared) | `src/common/rules/` — `ruleRef.ts`, `ruleObject.ts`, `ruleSource.ts`, `ruleRegistry.ts`, `inMemoryRuleSource.ts` | Source-independent rule references, objects, sources, and registry. |
| Resolve engine (shared) | `src/common/resolve/` — `resolveReferences.ts`, `resolved.ts` | Dedupe + resolve `CollectedRef[]` through the registry; resolved-graph types. |
| Shared char blocks | `src/common/character.ts` | `Override` + `Notes` normalizers reused by both systems. |
| D&D 5e | `src/dnd5e/` — `model.ts`, `parse.ts`, `normalize.ts`, `validate.ts`, `collectRefs.ts`, `resolveCharacter.ts` | The D5C model and its AST→model→resolved pipeline. |
| Storyteller | `src/storyteller/` — same file set | The STC model and pipeline. |
| Entry point | `src/index.ts` | `Common` (flat) + `Dnd5e` / `Storyteller` namespaces. |

A new system is mostly a typed model plus a normalizer: parsing, references,
dice, errors, the rules API, and the resolver all come from `common`.

### Validation layers

1. **Syntax** — lexer/parser (`ParseError` with line/column).
2. **Shape** — `ValidateD5cDocument` / `ValidateStcDocument` return diagnostics
   (e.g. valid/numeric ability scores or the nine Attributes; a class per level;
   numeric currency; ref-only spell lists; numeric trait ratings). Never throw.
3. **Rules** — scaffolded only. Each system ships a trivial, extensible example
   (`ValidateCharacterRules`: prepared spells must be in the spellbook;
   `ValidateStorytellerRules`: current Willpower/pools may not exceed their
   caps). Full legality checking is intentionally not implemented yet.

### Rule sources are abstract

Rules can come from any source — memory, files, a database, network, or a
campaign package — via the `RuleSource` interface. `RuleRegistry` routes a
reference to the source owning its namespace; missing rules become
**diagnostics, not exceptions**. `InMemoryRuleSource` is provided for tests and
examples. The same registry serves every system: a parser never touches a
`RuleSource`; only the resolver does.

## Development

```sh
npm install        # installs TypeScript + @types/node (dev only)
npm run typecheck  # tsc --noEmit, strict
npm test           # node --test (native TS, no build step)
```

The code is written so Node can strip its types directly (no enums, namespaces,
or parameter properties); `erasableSyntaxOnly` enforces this at typecheck time.

## Also in this repository

`src/developer-panel.naiscript` is an unrelated earlier proof of concept — a
NovelAI Developer Panel user script. See
[`docs/novelai-developer-panel.md`](docs/novelai-developer-panel.md). It is
excluded from the D5C TypeScript project.
