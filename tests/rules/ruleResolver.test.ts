import { test } from "node:test";
import assert from "node:assert/strict";
import { ParseD5c } from "../../src/d5c/parser.ts";
import { NormalizeD5c } from "../../src/character/normalize.ts";
import { RuleRegistry } from "../../src/rules/ruleRegistry.ts";
import { InMemoryRuleSource } from "../../src/rules/inMemoryRuleSource.ts";
import { ResolveCharacter } from "../../src/resolve/resolveCharacter.ts";
import { ParseRuleRef, RuleRefKey } from "../../src/rules/ruleRef.ts";
import type { RuleObject } from "../../src/rules/ruleObject.ts";

const _wizard: RuleObject = {
	ref: { source: "srd2014", type: "class", id: "wizard" },
	source: "srd2014",
	type: "class",
	name: "Wizard",
	data: { hitDie: "d6" },
};

const _fireball: RuleObject = {
	ref: { source: "srd2014", type: "spell", id: "fireball" },
	source: "srd2014",
	type: "spell",
	name: "Fireball",
	data: { level: 3 },
};

function _makeDoc(): ReturnType<typeof NormalizeD5c> {
	return NormalizeD5c(
		ParseD5c(
			`D5C 1
Character "A" {
	Game dnd5e-2014
	Levels {
		Level 1 {
			Class @srd2014:class/wizard
			HitPoints 6
		}
	}
	Spells {
		Spellbook {
			@srd2014:spell/fireball
			@srd2014:spell/magic-missile
		}
	}
}`
		)
	);
}

test("resolves known class and spell references through the registry", async () => {
	const _registry = new RuleRegistry();
	_registry.AddSource(new InMemoryRuleSource("srd2014", [_wizard, _fireball]));

	const _resolved = await ResolveCharacter(_makeDoc(), _registry);

	assert.equal(_resolved.rules.byKey.get("srd2014:class/wizard")?.name, "Wizard");
	assert.equal(_resolved.rules.byKey.get("srd2014:spell/fireball")?.name, "Fireball");
});

test("reports missing references as diagnostics without throwing", async () => {
	const _registry = new RuleRegistry();
	// magic-missile is intentionally absent.
	_registry.AddSource(new InMemoryRuleSource("srd2014", [_wizard, _fireball]));

	const _resolved = await ResolveCharacter(_makeDoc(), _registry);

	const _missing = _resolved.diagnostics.filter((d) => d.code === "resolve/missing-rule");
	assert.equal(_missing.length, 1);
	assert.equal(RuleRefKey(_missing[0]!.ref!), "srd2014:spell/magic-missile");
});

test("reports an unregistered namespace as a diagnostic", async () => {
	const _registry = new RuleRegistry();
	const _resolved = await ResolveCharacter(_makeDoc(), _registry);

	assert.ok(_resolved.diagnostics.length > 0);
	assert.ok(_resolved.diagnostics.every((d) => d.code === "resolve/unknown-source"));
});

test("in-memory source rejects foreign-namespace rules", () => {
	const _source = new InMemoryRuleSource("srd2014");
	assert.throws(() =>
		_source.Add({
			ref: { source: "homebrew", type: "spell", id: "x" },
			source: "homebrew",
			type: "spell",
			name: "X",
			data: {},
		})
	);
});

test("registry rejects duplicate sources and routes by namespace", async () => {
	const _registry = new RuleRegistry();
	_registry.AddSource(new InMemoryRuleSource("srd2014", [_fireball]));
	assert.throws(() => _registry.AddSource(new InMemoryRuleSource("srd2014")));

	assert.equal(await _registry.Has(ParseRuleRef("@srd2014:spell/fireball")), true);
	assert.equal(await _registry.Get(ParseRuleRef("@other:spell/fireball")), undefined);
});
