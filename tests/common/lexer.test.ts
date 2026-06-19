import { test } from "node:test";
import assert from "node:assert/strict";
import { Tokenize } from "../../src/common/text/lexer.ts";
import { ParseError } from "../../src/common/text/errors.ts";

test("lexes dice in all supported shapes", () => {
	const _dice = Tokenize("d6 1d6 1d6+1 1d20-2").filter((t) => t.type === "dice");
	assert.deepEqual(
		_dice.map((t) => t.dice),
		[
			{ count: null, sides: 6, modifier: null },
			{ count: 1, sides: 6, modifier: null },
			{ count: 1, sides: 6, modifier: 1 },
			{ count: 1, sides: 20, modifier: -2 },
		]
	);
});

test("does not mistake an identifier starting with d for dice", () => {
	const _tokens = Tokenize("dnd5e-2014");
	assert.equal(_tokens[0]?.type, "identifier");
	assert.equal(_tokens[0]?.text, "dnd5e-2014");
});

test("lexes signed numbers distinctly from unsigned", () => {
	const _tokens = Tokenize("+2 -3 4");
	assert.deepEqual(
		_tokens.filter((t) => t.type !== "eof").map((t) => [t.type, t.numberValue]),
		[
			["signedNumber", 2],
			["signedNumber", -3],
			["number", 4],
		]
	);
});

test("lexes references into typed parts", () => {
	const _tokens = Tokenize("@homebrew:item/black-iron-key");
	assert.equal(_tokens[0]?.type, "ref");
	assert.deepEqual(_tokens[0]?.ref, {
		source: "homebrew",
		type: "item",
		id: "black-iron-key",
	});
});

test("decodes string escapes and ignores comments", () => {
	const _tokens = Tokenize('"a\\tb\\n\\"c" // trailing comment\n# whole line\n42');
	assert.equal(_tokens[0]?.type, "string");
	assert.equal(_tokens[0]?.stringValue, 'a\tb\n"c');
	const _number = _tokens.find((t) => t.type === "number");
	assert.equal(_number?.numberValue, 42);
});

test("reports invalid string escape with line and column", () => {
	let _error: ParseError | undefined;
	try {
		Tokenize('"bad \\x escape"');
	} catch (err) {
		_error = err as ParseError;
	}
	assert.ok(_error instanceof ParseError);
	assert.equal(_error.diagnostics[0]?.code, "string/invalid-escape");
	assert.equal(_error.location?.line, 1);
	assert.equal(_error.location?.column, 6);
});

test("reports unexpected characters with location", () => {
	let _error: ParseError | undefined;
	try {
		Tokenize("Game %");
	} catch (err) {
		_error = err as ParseError;
	}
	assert.ok(_error instanceof ParseError);
	assert.equal(_error.diagnostics[0]?.code, "lex/unexpected-character");
	assert.equal(_error.location?.line, 1);
	assert.equal(_error.location?.column, 6);
});

test("rejects malformed references", () => {
	assert.throws(() => Tokenize("@notaref"), ParseError);
	assert.throws(() => Tokenize("@source:type-only"), ParseError);
});

test("tracks line and column across newlines", () => {
	const _tokens = Tokenize("a\n  b");
	const _b = _tokens.find((t) => t.text === "b");
	assert.equal(_b?.location.line, 2);
	assert.equal(_b?.location.column, 3);
});
