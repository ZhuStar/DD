import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ParseStc } from "../../src/storyteller/parse.ts";
import { NormalizeStc } from "../../src/storyteller/normalize.ts";
import { RuleRefKey } from "../../src/common/rules/ruleRef.ts";
import type { RuleRef } from "../../src/common/rules/ruleRef.ts";

const _fixture = readFileSync(new URL("../fixtures/isabeau.stc", import.meta.url), "utf8");
const _document = NormalizeStc(ParseStc(_fixture));
const _c = _document.character;

test("normalizes format, version, game, and identity", () => {
	assert.equal(_document.format, "STC");
	assert.equal(_document.formatVersion, 1);
	assert.equal(_document.game, "wod-storyteller");
	assert.equal(_c.name, "Isabeau Renault");
	assert.equal(_c.player, "Julian");
	assert.equal(_c.chronicle, "By Night");
});

test("normalizes concept and splat (with references)", () => {
	assert.deepEqual(_c.concept, {
		nature: "Architect",
		demeanor: "Gallant",
		concept: "Reluctant Investigator",
	});
	assert.equal(RuleRefKey(_c.splat.gameLine!), "wod-revised:gameline/vampire");
	assert.equal(RuleRefKey(_c.splat.archetype!), "wod-revised:clan/tremere");
	assert.equal(_c.splat.generation, 12);
	assert.equal(RuleRefKey(_c.splat.extras["clan"] as RuleRef), "wod-revised:clan/tremere");
});

test("normalizes the nine attributes into groups", () => {
	assert.equal(_c.attributes.physical["strength"], 2);
	assert.equal(_c.attributes.physical["dexterity"], 3);
	assert.equal(_c.attributes.social["manipulation"], 4);
	assert.equal(_c.attributes.mental["intelligence"], 4);
	assert.equal(_c.attributes.mental["wits"], 3);
});

test("normalizes abilities with category, ref, rating, and specialty", () => {
	const _stealth = _c.abilities.find(
		(a) => a.ref !== undefined && a.ref.id === "stealth"
	);
	assert.ok(_stealth);
	assert.equal(_stealth.category, "skill");
	assert.equal(_stealth.rating, 2);
	assert.equal(_stealth.specialty, "Hiding");

	const _occult = _c.abilities.find((a) => a.ref?.id === "occult");
	assert.equal(_occult?.category, "knowledge");
	assert.equal(_occult?.rating, 3);
});

test("normalizes advantages (disciplines and backgrounds)", () => {
	const _thaum = _c.advantages.find((a) => a.ref?.id === "thaumaturgy");
	assert.equal(_thaum?.kind, "discipline");
	assert.equal(_thaum?.rating, 2);
	const _resources = _c.advantages.find((a) => a.ref?.id === "resources");
	assert.equal(_resources?.kind, "background");
	assert.equal(_resources?.rating, 3);
});

test("normalizes virtues, willpower, path, pools, health, and experience", () => {
	assert.deepEqual(_c.virtues, { conscience: 3, selfControl: 2, courage: 3 });
	assert.deepEqual(_c.willpower, { rating: 5, current: 4 });
	assert.deepEqual(_c.path, { name: "Humanity", rating: 7 });
	assert.equal(_c.pools.length, 1);
	assert.deepEqual(_c.pools[0], { name: "BloodPool", max: 11, current: 8 });
	assert.deepEqual(_c.health, { bashing: 1, lethal: 0, aggravated: 0 });
	assert.deepEqual(_c.experience, { total: 35, unspent: 7 });
});

test("normalizes merits and flaws with point values", () => {
	const _merit = _c.meritsFlaws.find((m) => m.ref?.id === "eidetic-memory");
	assert.equal(_merit?.kind, "merit");
	assert.equal(_merit?.value, 2);
	const _flaw = _c.meritsFlaws.find((m) => m.ref?.id === "intolerance");
	assert.equal(_flaw?.kind, "flaw");
	assert.equal(_flaw?.value, 1);
});

test("reuses the shared override and notes normalizers", () => {
	const _init = _c.overrides.find((o) => o.target === "Initiative");
	assert.equal(_init?.value, 6);
	assert.equal(_init?.reason, "Celerity is currently active");
	assert.equal(_c.notes["Appearance"], "Auburn hair, severe glasses, ink-stained cuffs.");
});

test("preserves unknown top-level statements in extensions", () => {
	const _doc = NormalizeStc(
		ParseStc(`STC 1\nCharacter "X" {\n\tGame wod-storyteller\n\tMystery 42\n}`)
	);
	assert.equal(_doc.extensions.length, 1);
	const _first = _doc.extensions[0]!;
	assert.equal("name" in _first ? _first.name : "", "Mystery");
});
