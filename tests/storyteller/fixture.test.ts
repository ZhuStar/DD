import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ParseStc } from "../../src/storyteller/parse.ts";
import { NormalizeStc } from "../../src/storyteller/normalize.ts";
import {
	ValidateStcDocument,
	ValidateStorytellerRules,
} from "../../src/storyteller/validate.ts";
import { CollectCharacterRefs } from "../../src/storyteller/collectRefs.ts";
import { ResolveStorytellerCharacter } from "../../src/storyteller/resolveCharacter.ts";
import { RuleRegistry } from "../../src/common/rules/ruleRegistry.ts";
import { BuildFakeSource } from "../fixtures/fakeRules.ts";

const _fixture = readFileSync(new URL("../fixtures/isabeau.stc", import.meta.url), "utf8");

test("the Isabeau fixture parses, validates, normalizes, and resolves cleanly", async () => {
	const _ast = ParseStc(_fixture);

	const _shape = ValidateStcDocument(_ast);
	assert.deepEqual(
		_shape.filter((d) => d.severity === "error"),
		[]
	);

	const _document = NormalizeStc(_ast);

	// The shared rules engine resolves Storyteller references through the same
	// RuleRegistry/RuleSource abstraction the D&D system uses.
	const _refs = CollectCharacterRefs(_document).map((c) => c.ref);
	const _registry = new RuleRegistry();
	_registry.AddSource(BuildFakeSource(_refs, "wod-revised"));

	const _resolved = await ResolveStorytellerCharacter(_document, _registry);

	assert.deepEqual(
		_resolved.diagnostics.filter((d) => d.severity === "error"),
		[]
	);
	assert.ok(_resolved.rules.byKey.has("wod-revised:clan/tremere"));
	assert.ok(_resolved.rules.byKey.has("wod-revised:discipline/thaumaturgy"));

	// The well-formed sheet trips no Layer-3 rules warnings.
	assert.deepEqual(ValidateStorytellerRules(_document), []);
});

test("a missing rule object surfaces as a resolve diagnostic, not a crash", async () => {
	const _document = NormalizeStc(ParseStc(_fixture));
	const _refs = CollectCharacterRefs(_document)
		.map((c) => c.ref)
		.filter((r) => r.id !== "thaumaturgy");

	const _registry = new RuleRegistry();
	_registry.AddSource(BuildFakeSource(_refs, "wod-revised"));

	const _resolved = await ResolveStorytellerCharacter(_document, _registry);
	const _missing = _resolved.diagnostics.filter((d) => d.code === "resolve/missing-rule");
	assert.ok(_missing.some((d) => d.ref?.id === "thaumaturgy"));
});

test("Layer-3 rules check flags over-cap willpower and pools", () => {
	const _document = NormalizeStc(
		ParseStc(
			`STC 1\nCharacter "Y" {\n\tWillpower {\n\t\tRating 4\n\t\tCurrent 6\n\t}\n\tPools {\n\t\tBloodPool {\n\t\t\tMax 10\n\t\t\tCurrent 12\n\t\t}\n\t}\n}`
		)
	);
	const _warnings = ValidateStorytellerRules(_document);
	assert.ok(_warnings.some((d) => d.code === "rules/willpower-over-rating"));
	assert.ok(_warnings.some((d) => d.code === "rules/pool-over-max"));
});
