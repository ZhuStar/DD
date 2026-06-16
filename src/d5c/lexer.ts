import type { SourceLocation } from "./errors.ts";
import { D5cParseError, MakeDiagnostic } from "./errors.ts";
import type { TokenType } from "./grammar.ts";
import type { RuleRef } from "../rules/ruleRef.ts";
import { RuleRefBodyPattern } from "../rules/ruleRef.ts";

export interface Token {
	type: TokenType;
	/** Exact source text of the token (excluding surrounding whitespace). */
	text: string;
	location: SourceLocation;
	numberValue?: number;
	signed?: boolean;
	stringValue?: string;
	ref?: RuleRef;
	dice?: { count: number | null; sides: number; modifier: number | null };
}

const _identifierRe = /[A-Za-z_][A-Za-z0-9_-]*/y;
const _diceRe = /(\d*)d(\d+)([+-]\d+)?/y;
const _unsignedNumberRe = /\d+(?:\.\d+)?/y;
const _signedNumberRe = /[+-]\d+(?:\.\d+)?/y;

function _isDigit(ch: string): boolean {
	return ch >= "0" && ch <= "9";
}

function _isIdentifierStart(ch: string): boolean {
	return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_";
}

const _escapeMap: Readonly<Record<string, string>> = {
	'"': '"',
	"\\": "\\",
	n: "\n",
	r: "\r",
	t: "\t",
};

/**
 * Converts D5C source text into a flat token stream. The lexer is entirely
 * rule-agnostic: it understands D5C syntax only and never interprets the
 * meaning of identifiers or references.
 */
export class Lexer {
	private readonly _text: string;
	private _offset = 0;
	private _line = 1;
	private _lineStart = 0;

	public constructor(text: string) {
		this._text = text;
	}

	public Tokenize(): Token[] {
		const _tokens: Token[] = [];

		for (;;) {
			this._skipInsignificant();

			if (this._offset >= this._text.length) {
				_tokens.push(this._makeSimple("eof", ""));
				break;
			}

			const _ch = this._text[this._offset]!;

			if (_ch === "\n" || _ch === "\r") {
				_tokens.push(this._readNewline());
				continue;
			}

			if (_ch === "{") {
				_tokens.push(this._makeSimple("lbrace", "{"));
				this._advance(1);
				continue;
			}

			if (_ch === "}") {
				_tokens.push(this._makeSimple("rbrace", "}"));
				this._advance(1);
				continue;
			}

			if (_ch === '"') {
				_tokens.push(this._readString());
				continue;
			}

			if (_ch === "@") {
				_tokens.push(this._readRef());
				continue;
			}

			if (_isDigit(_ch)) {
				_tokens.push(this._tryReadDice() ?? this._readUnsignedNumber());
				continue;
			}

			if ((_ch === "+" || _ch === "-") && _isDigit(this._peek(1))) {
				_tokens.push(this._readSignedNumber());
				continue;
			}

			if (_ch === "d") {
				const _dice = this._tryReadDice();
				if (_dice !== undefined) {
					_tokens.push(_dice);
					continue;
				}
			}

			if (_isIdentifierStart(_ch)) {
				_tokens.push(this._readIdentifier());
				continue;
			}

			throw this._error(
				"lex/unexpected-character",
				`Unexpected character ${JSON.stringify(_ch)}.`,
				this._location()
			);
		}

		return _tokens;
	}

	private _skipInsignificant(): void {
		for (;;) {
			const _ch = this._text[this._offset];

			if (_ch === " " || _ch === "\t" || _ch === "\f" || _ch === "\v") {
				this._advance(1);
				continue;
			}

			if (_ch === "/" && this._peek(1) === "/") {
				this._skipLineComment();
				continue;
			}

			if (_ch === "#") {
				this._skipLineComment();
				continue;
			}

			break;
		}
	}

	private _skipLineComment(): void {
		while (this._offset < this._text.length) {
			const _ch = this._text[this._offset]!;
			if (_ch === "\n" || _ch === "\r") {
				break;
			}
			this._advance(1);
		}
	}

	private _readNewline(): Token {
		const _location = this._location();
		const _ch = this._text[this._offset]!;
		let _raw = _ch;

		if (_ch === "\r" && this._peek(1) === "\n") {
			_raw = "\r\n";
			this._offset += 2;
		} else {
			this._offset += 1;
		}

		this._line += 1;
		this._lineStart = this._offset;

		return { type: "newline", text: _raw, location: _location };
	}

	private _readString(): Token {
		const _location = this._location();
		const _start = this._offset;
		this._advance(1); // opening quote

		let _value = "";

		for (;;) {
			if (this._offset >= this._text.length) {
				throw this._error(
					"string/unterminated",
					"Unterminated string literal.",
					_location
				);
			}

			const _ch = this._text[this._offset]!;

			if (_ch === "\n" || _ch === "\r") {
				throw this._error(
					"string/unterminated",
					"Unterminated string literal (newline in string).",
					this._location()
				);
			}

			if (_ch === '"') {
				this._advance(1);
				break;
			}

			if (_ch === "\\") {
				const _escapeLocation = this._location();
				const _next = this._peek(1);
				const _mapped = _escapeMap[_next];

				if (_mapped === undefined) {
					throw this._error(
						"string/invalid-escape",
						`Invalid string escape ${JSON.stringify("\\" + _next)}.`,
						_escapeLocation
					);
				}

				_value += _mapped;
				this._advance(2);
				continue;
			}

			_value += _ch;
			this._advance(1);
		}

		const _raw = this._text.slice(_start, this._offset);
		return { type: "string", text: _raw, location: _location, stringValue: _value };
	}

	private _readRef(): Token {
		const _location = this._location();
		const _start = this._offset;
		this._advance(1); // '@'

		while (this._offset < this._text.length) {
			const _ch = this._text[this._offset]!;
			if (
				_ch === " " ||
				_ch === "\t" ||
				_ch === "\n" ||
				_ch === "\r" ||
				_ch === "{" ||
				_ch === "}" ||
				_ch === '"'
			) {
				break;
			}
			this._advance(1);
		}

		const _raw = this._text.slice(_start, this._offset);
		const _body = _raw.slice(1);
		const _match = RuleRefBodyPattern.exec(_body);

		if (_match === null) {
			throw this._error(
				"ref/invalid",
				`Invalid reference ${JSON.stringify(_raw)}. Expected @source:type/id.`,
				_location
			);
		}

		const _ref: RuleRef = { source: _match[1]!, type: _match[2]!, id: _match[3]! };
		return { type: "ref", text: _raw, location: _location, ref: _ref };
	}

	private _readSignedNumber(): Token {
		const _location = this._location();
		_signedNumberRe.lastIndex = this._offset;
		const _match = _signedNumberRe.exec(this._text);

		// Guaranteed by the caller (sign followed by a digit).
		const _raw = _match![0];
		this._advance(_raw.length);

		return {
			type: "signedNumber",
			text: _raw,
			location: _location,
			numberValue: Number(_raw),
			signed: true,
		};
	}

	private _tryReadDice(): Token | undefined {
		const _location = this._location();
		_diceRe.lastIndex = this._offset;
		const _match = _diceRe.exec(this._text);

		if (_match === null) {
			return undefined;
		}

		const _raw = _match[0];
		const _end = this._offset + _raw.length;
		const _after = this._text[_end];

		// A trailing identifier character means this was not really a dice token
		// (e.g. an identifier that merely starts with `d`).
		if (_after !== undefined && (_isIdentifierStart(_after) || _isDigit(_after))) {
			return undefined;
		}

		this._advance(_raw.length);

		const _countText = _match[1]!;
		const _modifierText = _match[3];

		return {
			type: "dice",
			text: _raw,
			location: _location,
			dice: {
				count: _countText === "" ? null : Number(_countText),
				sides: Number(_match[2]!),
				modifier: _modifierText === undefined ? null : Number(_modifierText),
			},
		};
	}

	private _readUnsignedNumber(): Token {
		const _location = this._location();
		_unsignedNumberRe.lastIndex = this._offset;
		const _match = _unsignedNumberRe.exec(this._text);
		const _raw = _match![0];
		this._advance(_raw.length);

		return {
			type: "number",
			text: _raw,
			location: _location,
			numberValue: Number(_raw),
			signed: false,
		};
	}

	private _readIdentifier(): Token {
		const _location = this._location();
		_identifierRe.lastIndex = this._offset;
		const _match = _identifierRe.exec(this._text);
		const _raw = _match![0];
		this._advance(_raw.length);

		return { type: "identifier", text: _raw, location: _location };
	}

	private _makeSimple(type: TokenType, text: string): Token {
		return { type, text, location: this._location() };
	}

	private _advance(count: number): void {
		this._offset += count;
	}

	private _peek(ahead: number): string {
		return this._text[this._offset + ahead] ?? "";
	}

	private _location(): SourceLocation {
		return {
			line: this._line,
			column: this._offset - this._lineStart + 1,
			offset: this._offset,
		};
	}

	private _error(code: string, message: string, location: SourceLocation): D5cParseError {
		return new D5cParseError(message, [MakeDiagnostic("error", code, message, location)]);
	}
}

export function Tokenize(text: string): Token[] {
	return new Lexer(text).Tokenize();
}
