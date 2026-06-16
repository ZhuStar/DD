# D5C — D&D 5e Character format

D5C ("D&D 5e Character") is a strict, human-editable text format for storing a
character's **selected choices and current play state** — not a pre-calculated
sheet. This package provides the foundation for a future rules engine:

```
D5C text → lexer → parser → raw AST → shape validator → normalizer → resolver → resolved graph
```

The library deliberately keeps **parsing separate from game rules**. The parser
understands D5C syntax only; it does not know what a wizard is, whether a spell
choice is legal, or how to compute AC, spell slots, proficiency bonus, or save
DCs. Those belong to later layers.

It is TypeScript-first, has **no runtime dependencies**, and runs its tests on
Node's built-in test runner via native TypeScript type-stripping (Node ≥ 22.6).

## Quick start

```ts
import {
	ParseD5c,
	NormalizeD5c,
	ResolveCharacter,
	RuleRegistry,
	InMemoryRuleSource,
} from "./src/index.ts";

const ast = ParseD5c(d5cText); // raw AST with source locations
const document = NormalizeD5c(ast); // typed character model
const registry = new RuleRegistry();
registry.AddSource(new InMemoryRuleSource("srd2014", fakeSrdRules));
const resolved = await ResolveCharacter(document, registry);
// resolved.rules.byKey: resolved RuleObjects; resolved.diagnostics: misses, etc.
```

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

Syntax errors throw a `D5cParseError` carrying diagnostics with line and column.

## Architecture

| Area | Files | Responsibility |
| --- | --- | --- |
| D5C syntax | `src/d5c/lexer.ts`, `parser.ts`, `ast.ts`, `grammar.ts`, `errors.ts` | Tokenize and parse into a raw AST. Rule-agnostic. |
| Character model | `src/character/model.ts`, `normalize.ts`, `validate.ts` | Typed model, AST→model normalization, shape validation (Layer 2) + a scaffolded rules check (Layer 3). |
| Rules API | `src/rules/ruleRef.ts`, `ruleObject.ts`, `ruleSource.ts`, `ruleRegistry.ts`, `inMemoryRuleSource.ts`, `ruleResolver.ts` | Source-independent rule references, objects, sources, registry, and reference collection. |
| Resolve | `src/resolve/resolvedCharacter.ts`, `resolveCharacter.ts` | Walk the model, resolve references through the registry, return a resolved graph plus diagnostics. |
| Entry point | `src/index.ts` | Public API. |

### Validation layers

1. **Syntax** — lexer/parser (`D5cParseError` with line/column).
2. **Shape** — `ValidateD5cDocument(ast)` returns diagnostics (valid ability
   names and numeric scores, numeric level labels, a class per level, numeric
   currency, ref-only spell lists). Never throws.
3. **Rules** — scaffolded only. `ValidateCharacterRules(document)` ships one
   trivial, extensible example (prepared spells must be in the spellbook). Real
   legality checks (prepared-count limits, class spell legality, multiclass
   prerequisites, proficiencies) are intentionally not implemented yet.

### Rule sources are abstract

Rules can come from any source — memory, files, a database, network, or a
campaign package — via the `RuleSource` interface. `RuleRegistry` routes a
reference to the source owning its namespace; missing rules become
**diagnostics, not exceptions**. `InMemoryRuleSource` is provided for tests and
examples. The character parser never touches a `RuleSource`; only the resolver
does.

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
