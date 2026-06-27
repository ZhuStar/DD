import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ParseStc } from "../../src/storyteller/parse.ts";
import { NormalizeStc } from "../../src/storyteller/normalize.ts";
import { CollectCharacterRefs } from "../../src/storyteller/collectRefs.ts";
import { ResolveStorytellerCharacter } from "../../src/storyteller/resolveCharacter.ts";
import { ParseCreationProfile } from "../../src/storyteller/rules.ts";
import {
	BudgetFor,
	DeriveStoryteller,
	ProfileFromResolved,
} from "../../src/storyteller/derive.ts";
import {
	EvaluateStoryteller,
	ExperienceCost,
	FreebieCost,
	ReplayHistory,
} from "../../src/storyteller/advancement.ts";
import { RuleRegistry } from "../../src/common/rules/ruleRegistry.ts";
import type { CreationProfile } from "../../src/storyteller/rules.ts";
import { BuildWodSource, MortalProfile, VampireProfile } from "../fixtures/wodProfiles.ts";

const _fixture = readFileSync(new URL("../fixtures/isabeau.stc", import.meta.url), "utf8");

function _vampireProfile(): CreationProfile {
	const _parsed = ParseCreationProfile(VampireProfile());
	assert.ok(_parsed.profile);
	return _parsed.profile;
}

test("the profile resolves through the registry and derives generation stats", async () => {
	const _document = NormalizeStc(ParseStc(_fixture));
	const _registry = new RuleRegistry();
	_registry.AddSource(BuildWodSource(CollectCharacterRefs(_document).map((c) => c.ref)));
	const _resolved = await ResolveStorytellerCharacter(_document, _registry);

	const _parsed = ProfileFromResolved(_resolved);
	assert.ok(_parsed.profile);
	const _derived = DeriveStoryteller(_document, _parsed.profile);

	// Generation 12 → blood pool 11 / 1 per turn / trait cap 5 (from rule DATA).
	assert.equal(_derived.bloodPoolMax, 11);
	assert.equal(_derived.bloodPerTurn, 1);
	assert.equal(_derived.traitMax, 5);
	// The hand-entered BloodPool Max 11 is within the derived cap, so no error.
	assert.deepEqual(_derived.diagnostics.filter((d) => d.severity === "error"), []);
});

test("priorities map to point budgets from the profile", () => {
	const _document = NormalizeStc(ParseStc(_fixture));
	const _derived = DeriveStoryteller(_document, _vampireProfile());

	// Attributes: primary physical / secondary social / tertiary mental → 7/5/3
	assert.equal(_derived.attributeBudgets.physical, 7);
	assert.equal(_derived.attributeBudgets.social, 5);
	assert.equal(_derived.attributeBudgets.mental, 3);
	// Abilities: primary knowledges / secondary talents / tertiary skills → 13/9/5
	assert.equal(_derived.abilityBudgets.knowledges, 13);
	assert.equal(_derived.abilityBudgets.talents, 9);
	assert.equal(_derived.abilityBudgets.skills, 5);
});

test("experience and freebie costs come from the profile", () => {
	const _profile = _vampireProfile();
	assert.equal(ExperienceCost(_profile, "ability", 2, false), 4); // multiplier 2 × current 2
	assert.equal(ExperienceCost(_profile, "attribute", 3, false), 12); // 4 × 3
	assert.equal(ExperienceCost(_profile, "discipline", 0, true), 10); // new dot
	assert.equal(FreebieCost(_profile, "discipline", 2), 14); // 7 per dot × 2
	assert.equal(ExperienceCost(_profile, "nonsense", 1, false), undefined);
});

test("history replay tracks a running experience balance", () => {
	const _document = NormalizeStc(ParseStc(_fixture));
	const _result = ReplayHistory(_document, _vampireProfile());

	assert.equal(_result.final.xpEarned, 10);
	assert.equal(_result.final.xpSpent, 4); // raise occult 2→3 = 2×2
	assert.equal(_result.final.xpAvailable, 6);
	assert.deepEqual(_result.diagnostics.filter((d) => d.severity === "error"), []);
});

test("mortal and vampire profiles differ by DATA, not code", () => {
	const _vampire = _vampireProfile();
	const _mortalParsed = ParseCreationProfile(MortalProfile());
	assert.ok(_mortalParsed.profile);
	const _mortal = _mortalParsed.profile;

	assert.notEqual(
		BudgetFor(_vampire.attributePoints, "primary"),
		BudgetFor(_mortal.attributePoints, "primary")
	);
	assert.equal(_vampire.freebie.budget, 15);
	assert.equal(_mortal.freebie.budget, 21);
	// Mortals have no generation table.
	assert.equal(Object.keys(_mortal.generation).length, 0);
});

test("replay flags budget, freebie, overspend, and cost-mismatch problems", () => {
	const _document = NormalizeStc(
		ParseStc(`STC 1
Character "Test" {
	Splat { Profile @wod-revised:creation/vampire }
	Priorities {
		Attributes primary physical secondary social tertiary mental
		Abilities primary talents secondary skills tertiary knowledges
	}
	History {
		Entry creation-base {
			Allocate attribute name "Strength" from 1 to 4
			Allocate attribute name "Dexterity" from 1 to 2
		}
		Entry creation-freebies {
			Freebie attribute name "Stamina" from 2 to 5 cost 15
			Freebie willpower from 5 to 7 cost 2
		}
		Entry advancement {
			Raise ability @wod-revised:ability/occult from 3 to 4 cost 99
		}
	}
}`)
	);

	const _evaluation = EvaluateStoryteller(_document, _vampireProfile());
	const _codes = new Set(_evaluation.diagnostics.map((d) => d.code));

	assert.ok(_codes.has("creation/budget-mismatch")); // physical got 4 dots, budget 7
	assert.ok(_codes.has("advancement/freebie-over-budget")); // 17 spent vs 15
	assert.ok(_codes.has("advancement/cost-mismatch")); // recorded 99 vs computed 6
	assert.ok(_codes.has("advancement/insufficient-xp")); // spent with 0 earned
});
