import { test } from "node:test";
import assert from "node:assert/strict";
import {
	FormatRuleRef,
	ParseRuleRef,
	RuleRefEquals,
	RuleRefKey,
	TryParseRuleRef,
} from "../../src/common/rules/ruleRef.ts";

test("parses references from @-prefixed and bare forms", () => {
	assert.deepEqual(ParseRuleRef("@srd2014:spell/fireball"), {
		source: "srd2014",
		type: "spell",
		id: "fireball",
	});
	assert.deepEqual(ParseRuleRef("homebrew:feat/war-caster-revised"), {
		source: "homebrew",
		type: "feat",
		id: "war-caster-revised",
	});
});

test("supports ids containing slashes", () => {
	const _ref = ParseRuleRef("@campaign:item/keys/black-iron-key");
	assert.equal(_ref.id, "keys/black-iron-key");
});

test("produces stable keys and canonical formatting", () => {
	const _ref = { source: "srd2014", type: "class", id: "wizard" };
	assert.equal(RuleRefKey(_ref), "srd2014:class/wizard");
	assert.equal(FormatRuleRef(_ref), "@srd2014:class/wizard");
});

test("round-trips through format and parse", () => {
	const _ref = { source: "homebrew", type: "item", id: "black-iron-key" };
	assert.deepEqual(ParseRuleRef(FormatRuleRef(_ref)), _ref);
});

test("compares references structurally", () => {
	assert.ok(
		RuleRefEquals(
			{ source: "a", type: "b", id: "c" },
			{ source: "a", type: "b", id: "c" }
		)
	);
	assert.ok(
		!RuleRefEquals(
			{ source: "a", type: "b", id: "c" },
			{ source: "a", type: "b", id: "d" }
		)
	);
});

test("rejects invalid references", () => {
	assert.equal(TryParseRuleRef("not-a-ref"), undefined);
	assert.equal(TryParseRuleRef("@source:typeonly"), undefined);
	assert.throws(() => ParseRuleRef("@bad"), TypeError);
});
