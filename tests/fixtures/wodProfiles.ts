import { InMemoryRuleSource } from "../../src/common/rules/inMemoryRuleSource.ts";
import type { RuleObject } from "../../src/common/rules/ruleObject.ts";
import type { RuleRef } from "../../src/common/rules/ruleRef.ts";
import { FakeRule } from "./fakeRules.ts";

// NOTE: these numbers are illustrative placeholders for tests, NOT an
// authoritative reproduction of any published game line. They demonstrate that
// the engine reads creation/advancement values from rule *data* — swap the
// profile object and the maths change with no code edits.

const _vampireProfile: RuleObject = {
	ref: { source: "wod-revised", type: "creation", id: "vampire" },
	source: "wod-revised",
	type: "creation",
	name: "Vampire creation profile",
	data: {
		startingAttribute: 1,
		startingAbility: 0,
		attributePoints: { primary: 7, secondary: 5, tertiary: 3 },
		abilityPoints: { primary: 13, secondary: 9, tertiary: 5 },
		freebie: {
			budget: 15,
			costs: { attribute: 5, ability: 2, discipline: 7, background: 1, virtue: 2, willpower: 1 },
		},
		experience: {
			attribute: { newCost: 10, multiplier: 4 },
			ability: { newCost: 3, multiplier: 2 },
			discipline: { newCost: 10, multiplier: 5 },
			background: { newCost: 3, multiplier: 2 },
			virtue: { newCost: 2, multiplier: 2 },
			willpower: { newCost: 1, multiplier: 1 },
		},
		generation: {
			"12": { bloodPoolMax: 11, bloodPerTurn: 1, traitMax: 5 },
			"10": { bloodPoolMax: 13, bloodPerTurn: 1, traitMax: 5 },
			"8": { bloodPoolMax: 15, bloodPerTurn: 3, traitMax: 6 },
		},
	},
};

const _mortalProfile: RuleObject = {
	ref: { source: "wod-revised", type: "creation", id: "mortal" },
	source: "wod-revised",
	type: "creation",
	name: "Mortal creation profile",
	data: {
		startingAttribute: 1,
		startingAbility: 0,
		// Mortals differ from vampires by DATA, not code.
		attributePoints: { primary: 6, secondary: 4, tertiary: 3 },
		abilityPoints: { primary: 11, secondary: 7, tertiary: 4 },
		freebie: { budget: 21, costs: { attribute: 5, ability: 2, background: 1, willpower: 1 } },
		experience: {
			attribute: { newCost: 10, multiplier: 4 },
			ability: { newCost: 3, multiplier: 2 },
		},
		generation: {},
	},
};

export function VampireProfile(): RuleObject {
	return _vampireProfile;
}

export function MortalProfile(): RuleObject {
	return _mortalProfile;
}

/**
 * Builds a `wod-revised` source covering the given refs plus both creation
 * profiles (so the engine can resolve `Splat.Profile`).
 */
export function BuildWodSource(refs: RuleRef[]): InMemoryRuleSource {
	const _source = new InMemoryRuleSource("wod-revised");
	const _seen = new Set<string>();
	for (const _ref of refs) {
		if (_ref.source !== "wod-revised") {
			continue;
		}
		const _key = `${_ref.type}/${_ref.id}`;
		if (_seen.has(_key) || (_ref.type === "creation")) {
			continue;
		}
		_seen.add(_key);
		_source.Add(FakeRule(_ref));
	}
	_source.Add(_vampireProfile);
	_source.Add(_mortalProfile);
	return _source;
}
