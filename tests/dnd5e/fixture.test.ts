import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ParseD5c } from "../../src/dnd5e/parse.ts";
import { NormalizeD5c } from "../../src/dnd5e/normalize.ts";
import { ValidateD5cDocument } from "../../src/dnd5e/validate.ts";
import { RuleRegistry } from "../../src/common/rules/ruleRegistry.ts";
import { CollectCharacterRefs } from "../../src/dnd5e/collectRefs.ts";
import { ResolveCharacter } from "../../src/dnd5e/resolveCharacter.ts";
import { BuildFakeSource } from "../fixtures/fakeRules.ts";

const _fixture = readFileSync(new URL("../fixtures/elowen.d5c", import.meta.url), "utf8");

test("the Elowen fixture parses, validates, normalizes, and resolves cleanly", async () => {
	const _ast = ParseD5c(_fixture);

	// Layer 2 shape validation should report no errors for a well-formed file.
	const _shape = ValidateD5cDocument(_ast);
	assert.deepEqual(
		_shape.filter((d) => d.severity === "error"),
		[]
	);

	const _document = NormalizeD5c(_ast);

	// Register an in-memory srd2014 source with enough fake rule objects to
	// satisfy every reference the character uses.
	const _refs = CollectCharacterRefs(_document).map((c) => c.ref);
	const _registry = new RuleRegistry();
	_registry.AddSource(BuildFakeSource(_refs, "srd2014"));

	const _resolved = await ResolveCharacter(_document, _registry);

	const _errors = _resolved.diagnostics.filter((d) => d.severity === "error");
	assert.deepEqual(_errors, []);
	assert.ok(_resolved.rules.byKey.has("srd2014:class/wizard"));
	assert.ok(_resolved.rules.byKey.has("srd2014:spell/fireball"));
});

test("a missing rule object surfaces as a resolve diagnostic, not a crash", async () => {
	const _document = NormalizeD5c(ParseD5c(_fixture));
	const _refs = CollectCharacterRefs(_document)
		.map((c) => c.ref)
		.filter((r) => r.id !== "fireball");

	const _registry = new RuleRegistry();
	_registry.AddSource(BuildFakeSource(_refs, "srd2014"));

	const _resolved = await ResolveCharacter(_document, _registry);
	const _missing = _resolved.diagnostics.filter((d) => d.code === "resolve/missing-rule");
	assert.ok(_missing.some((d) => d.ref?.id === "fireball"));
});
