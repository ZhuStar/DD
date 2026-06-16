import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ParseD5c } from "../../src/d5c/parser.ts";
import { NormalizeD5c } from "../../src/character/normalize.ts";
import { RuleRefKey } from "../../src/rules/ruleRef.ts";

const _fixture = readFileSync(new URL("../fixtures/elowen.d5c", import.meta.url), "utf8");
const _document = NormalizeD5c(ParseD5c(_fixture));
const _character = _document.character;

test("normalizes format, version, and game id", () => {
	assert.equal(_document.format, "D5C");
	assert.equal(_document.formatVersion, 1);
	assert.equal(_document.game, "dnd5e-2014");
});

test("normalizes character identity fields", () => {
	assert.equal(_character.name, "Elowen Vale");
	assert.equal(_character.player, "Julian");
	assert.equal(_character.xp, 6500);
	assert.equal(_character.inspiration, false);
});

test("normalizes ability scores", () => {
	assert.deepEqual(_character.abilities, {
		strength: 8,
		dexterity: 14,
		constitution: 13,
		intelligence: 17,
		wisdom: 12,
		charisma: 10,
	});
});

test("normalizes origin references", () => {
	assert.equal(RuleRefKey(_character.origin.species!), "srd2014:race/elf");
	assert.equal(RuleRefKey(_character.origin.subspecies!), "srd2014:subrace/high-elf");
	assert.equal(RuleRefKey(_character.origin.background!), "srd2014:background/sage");
	assert.equal(_character.origin.alignment, "Neutral Good");
});

test("normalizes levels including subclass none vs ref and ASI choices", () => {
	assert.equal(_character.levels.length, 5);

	const _level1 = _character.levels[0]!;
	assert.equal(_level1.level, 1);
	assert.equal(RuleRefKey(_level1.classRef), "srd2014:class/wizard");
	assert.equal(_level1.subclassRef, undefined); // Subclass none
	assert.equal(_level1.hitPoints, 6);

	const _level3 = _character.levels[2]!;
	assert.equal(RuleRefKey(_level3.subclassRef!), "srd2014:subclass/evocation");

	const _level4 = _character.levels[3]!;
	assert.equal(_level4.choices.length, 1);
	const _asi = _level4.choices[0]!;
	assert.equal(_asi.kind, "ability-score-improvement");
	assert.deepEqual(_asi.value, { intelligence: 2 });
});

test("normalizes choices with their source tail", () => {
	const _arcana = _character.choices.find(
		(c) => c.ref !== undefined && RuleRefKey(c.ref) === "srd2014:skill/arcana"
	);
	assert.ok(_arcana);
	assert.equal(_arcana.kind, "skill");
	assert.equal(_arcana.source, "background");

	const _minorIllusion = _character.choices.find(
		(c) => c.ref !== undefined && RuleRefKey(c.ref) === "srd2014:spell/minor-illusion"
	);
	assert.equal(_minorIllusion?.kind, "cantrip");
	assert.equal(_minorIllusion?.source, "species");
});

test("normalizes spellbook and prepared refs", () => {
	assert.equal(_character.spells.spellbook.length, 8);
	assert.equal(_character.spells.prepared.length, 6);
	assert.ok(
		_character.spells.spellbook.some((r) => RuleRefKey(r) === "srd2014:spell/fireball")
	);
});

test("normalizes inventory items and currency", () => {
	assert.equal(_character.inventory.items.length, 2);
	const _staff = _character.inventory.items[0]!;
	assert.equal(_staff.name, "Quarterstaff");
	assert.equal(RuleRefKey(_staff.ref!), "srd2014:equipment/quarterstaff");
	assert.equal(_staff.equipped, true);
	assert.equal(_staff.quantity, 1);
	assert.deepEqual(_character.inventory.currency, {
		cp: 0,
		sp: 5,
		ep: 0,
		gp: 42,
		pp: 0,
	});
});

test("normalizes play state including used resources", () => {
	assert.equal(_character.state.currentHp, 23);
	assert.equal(_character.state.temporaryHp, 0);
	assert.deepEqual(
		_character.state.usedResources.map((u) => [u.kind, u.key, u.amount]),
		[
			["SpellSlot", "1", 2],
			["SpellSlot", "2", 1],
			["HitDice", "d6", 1],
		]
	);
});

test("normalizes overrides with reason and notes", () => {
	const _ac = _character.overrides.find((o) => o.target === "ArmorClass");
	assert.equal(_ac?.value, 15);
	assert.equal(_ac?.reason, "Mage Armor is currently active");
	assert.equal(_character.notes["Personality"], "Curious first, cautious second.");
});

test("preserves unknown top-level statements in extensions", () => {
	const _doc = NormalizeD5c(
		ParseD5c(
			`D5C 1\nCharacter "A" {\n\tGame dnd5e-2014\n\tMystery 42\n\tHomebrewBlock {\n\t\tFoo 1\n\t}\n}`
		)
	);
	assert.equal(_doc.extensions.length, 2);
	const _names = _doc.extensions.map((s) => ("name" in s ? s.name : ""));
	assert.deepEqual(_names.sort(), ["HomebrewBlock", "Mystery"]);
});

test("keeps raw AST nodes on normalized leaves", () => {
	const _staff = _character.inventory.items[0]!;
	assert.equal(_staff.raw?.kind, "block");
	const _ac = _character.overrides[0]!;
	assert.equal(_ac.raw?.kind, "field");
});
