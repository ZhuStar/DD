import { test } from "node:test";
import assert from "node:assert/strict";
import { ParseD5c } from "../../src/dnd5e/parse.ts";
import { ParseError } from "../../src/common/text/errors.ts";
import type { DocBlockStatement, DocStatement } from "../../src/common/text/ast.ts";

const _minimal = `D5C 1

Character "A" {
	Game dnd5e-2014
	Abilities {
		Strength 10
		Dexterity 10
		Constitution 10
		Intelligence 10
		Wisdom 10
		Charisma 10
	}
}`;

function _block(body: DocStatement[], name: string): DocBlockStatement {
	const _found = body.find((s) => s.kind === "block" && s.name === name);
	assert.ok(_found && _found.kind === "block", `expected block ${name}`);
	return _found;
}

test("parses a minimal character", () => {
	const _doc = ParseD5c(_minimal);
	assert.equal(_doc.format, "D5C");
	assert.equal(_doc.version, 1);
	assert.equal(_doc.root.name, "A");
	const _abilities = _block(_doc.root.body, "Abilities");
	assert.equal(_abilities.body.length, 6);
});

test("parses references as typed RuleRef values", () => {
	const _doc = ParseD5c(
		`D5C 1\nCharacter "A" {\n\tThing @srd2014:class/wizard\n\tOther @homebrew:item/black-iron-key\n}`
	);
	const _thing = _doc.root.body[0];
	assert.ok(_thing && _thing.kind === "field");
	const _value = _thing.values[0];
	assert.ok(_value && _value.kind === "ref");
	assert.deepEqual(_value.ref, { source: "srd2014", type: "class", id: "wizard" });
});

test("parses dice values inside fields", () => {
	const _doc = ParseD5c(`D5C 1\nCharacter "A" {\n\tHitDice 1d6+1\n}`);
	const _field = _doc.root.body[0];
	assert.ok(_field && _field.kind === "field");
	const _value = _field.values[0];
	assert.ok(_value && _value.kind === "dice");
	assert.deepEqual(
		{ count: _value.count, sides: _value.sides, modifier: _value.modifier },
		{ count: 1, sides: 6, modifier: 1 }
	);
});

test("parses labeled blocks and freeform tails", () => {
	const _doc = ParseD5c(
		`D5C 1\nCharacter "A" {\n\tLevels {\n\t\tLevel 4 {\n\t\t\tChoice ability-score-improvement {\n\t\t\t\tIntelligence +2\n\t\t\t}\n\t\t}\n\t}\n\tOverrides {\n\t\tArmorClass 15 because "Mage Armor"\n\t}\n}`
	);
	const _levels = _block(_doc.root.body, "Levels");
	const _level = _levels.body[0];
	assert.ok(_level && _level.kind === "block");
	assert.equal(_level.label?.kind, "number");

	const _overrides = _block(_doc.root.body, "Overrides");
	const _ac = _overrides.body[0];
	assert.ok(_ac && _ac.kind === "field");
	// value, "because" identifier, and the reason string are all preserved.
	assert.equal(_ac.values.length, 3);
	assert.equal(_ac.values[2]?.kind, "string");
});

test("parses bare references as list items", () => {
	const _doc = ParseD5c(
		`D5C 1\nCharacter "A" {\n\tSpells {\n\t\tSpellbook {\n\t\t\t@srd2014:spell/fireball\n\t\t}\n\t}\n}`
	);
	const _spells = _block(_doc.root.body, "Spells");
	const _spellbook = _spells.body[0];
	assert.ok(_spellbook && _spellbook.kind === "block");
	const _item = _spellbook.body[0];
	assert.ok(_item && _item.kind === "listItem");
	assert.equal(_item.value.kind, "ref");
});

test("ignores comments while parsing", () => {
	const _doc = ParseD5c(
		`D5C 1\n// a comment\nCharacter "A" {\n\t# another\n\tXp 10 // inline\n}`
	);
	const _field = _doc.root.body[0];
	assert.ok(_field && _field.kind === "field");
	assert.equal(_field.name, "Xp");
});

test("reports line and column for invalid syntax", () => {
	let _error: ParseError | undefined;
	try {
		ParseD5c(`D5C 1\nCharacter "A" {\n\t{\n\t}\n}`);
	} catch (err) {
		_error = err as ParseError;
	}
	assert.ok(_error instanceof ParseError);
	assert.equal(_error.diagnostics[0]?.code, "parse/unexpected-statement");
	assert.equal(_error.location?.line, 3);
	assert.equal(_error.location?.column, 2);
});

test("reports unterminated blocks", () => {
	assert.throws(
		() => ParseD5c(`D5C 1\nCharacter "A" {\n\tAbilities {\n`),
		(err: unknown) =>
			err instanceof ParseError &&
			err.diagnostics[0]?.code === "parse/unterminated-block"
	);
});
