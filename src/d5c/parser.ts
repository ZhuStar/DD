import type {
	D5cBlockStatement,
	D5cCharacterNode,
	D5cDocument,
	D5cFieldStatement,
	D5cListItemStatement,
	D5cStatement,
	D5cValue,
} from "./ast.ts";
import type { SourceLocation } from "./errors.ts";
import { D5cParseError, MakeDiagnostic } from "./errors.ts";
import {
	CharacterKeyword,
	FormatKeyword,
	IsBooleanKeyword,
	NoneKeyword,
} from "./grammar.ts";
import type { Token } from "./lexer.ts";
import { Tokenize } from "./lexer.ts";

/**
 * Recursive-descent parser for the D5C grammar. It builds a raw AST that
 * preserves document structure and source locations. The parser understands
 * D5C syntax only; it never interprets game rules, legality, or derived values.
 */
export class Parser {
	private readonly _tokens: Token[];
	private _index = 0;

	public constructor(tokens: Token[]) {
		this._tokens = tokens;
	}

	public ParseDocument(): D5cDocument {
		this._skipNewlines();

		const _header = this._current();
		if (_header.type !== "identifier" || _header.text !== FormatKeyword) {
			throw this._errorAt(
				"parse/expected-header",
				`Expected document to start with "${FormatKeyword}".`,
				_header
			);
		}
		this._advance();

		const _versionToken = this._expect("number", "parse/expected-version");
		const _version = _versionToken.numberValue!;

		this._skipNewlines();
		const _character = this._parseCharacter();

		this._skipNewlines();
		const _trailing = this._current();
		if (_trailing.type !== "eof") {
			throw this._errorAt(
				"parse/unexpected-trailing",
				`Unexpected ${this._describe(_trailing)} after character block.`,
				_trailing
			);
		}

		return {
			kind: "D5C",
			version: _version,
			character: _character,
			location: _header.location,
		};
	}

	private _parseCharacter(): D5cCharacterNode {
		const _keyword = this._current();
		if (_keyword.type !== "identifier" || _keyword.text !== CharacterKeyword) {
			throw this._errorAt(
				"parse/expected-character",
				`Expected "${CharacterKeyword}" block.`,
				_keyword
			);
		}
		this._advance();

		const _nameToken = this._expect("string", "parse/expected-character-name");
		const _body = this._parseBlock();

		return {
			name: _nameToken.stringValue!,
			body: _body,
			location: _keyword.location,
		};
	}

	private _parseBlock(): D5cStatement[] {
		this._expect("lbrace", "parse/expected-open-brace");
		const _body: D5cStatement[] = [];

		for (;;) {
			this._skipNewlines();
			const _token = this._current();

			if (_token.type === "rbrace") {
				this._advance();
				break;
			}

			if (_token.type === "eof") {
				throw this._errorAt(
					"parse/unterminated-block",
					"Unterminated block: expected '}' before end of input.",
					_token
				);
			}

			_body.push(this._parseStatement());
			this._expectStatementEnd();
		}

		return _body;
	}

	private _parseStatement(): D5cStatement {
		const _token = this._current();

		if (_token.type === "ref") {
			return this._parseListItem();
		}

		if (_token.type === "identifier") {
			return this._parseIdentifierStatement();
		}

		throw this._errorAt(
			"parse/unexpected-statement",
			`Unexpected ${this._describe(_token)} at start of statement.`,
			_token
		);
	}

	private _parseListItem(): D5cListItemStatement {
		const _token = this._current();
		this._advance();
		return {
			kind: "listItem",
			value: this._tokenToValue(_token),
			location: _token.location,
		};
	}

	private _parseIdentifierStatement(): D5cStatement {
		const _name = this._current();
		this._advance();

		// Block with no label: `Name { ... }`
		if (this._current().type === "lbrace") {
			const _body = this._parseBlock();
			return { kind: "block", name: _name.text, body: _body, location: _name.location };
		}

		// Block with a label: `Name <label> { ... }`. A label is a single
		// string, number, or identifier immediately followed by `{`.
		const _maybeLabel = this._current();
		if (this._isLabelCandidate(_maybeLabel) && this._peek(1).type === "lbrace") {
			this._advance();
			const _body = this._parseBlock();
			return {
				kind: "block",
				name: _name.text,
				label: this._tokenToValue(_maybeLabel),
				body: _body,
				location: _name.location,
			};
		}

		// Otherwise a field: `Name value tail*` until end of line.
		return this._parseField(_name);
	}

	private _parseField(name: Token): D5cFieldStatement {
		const _values: D5cValue[] = [];

		for (;;) {
			const _token = this._current();
			if (
				_token.type === "newline" ||
				_token.type === "rbrace" ||
				_token.type === "eof"
			) {
				break;
			}

			if (_token.type === "lbrace") {
				throw this._errorAt(
					"parse/unexpected-brace",
					"Unexpected '{' in field; block labels must directly precede '{'.",
					_token
				);
			}

			_values.push(this._tokenToValue(_token));
			this._advance();
		}

		return { kind: "field", name: name.text, values: _values, location: name.location };
	}

	private _isLabelCandidate(token: Token): boolean {
		return (
			token.type === "string" || token.type === "number" || token.type === "identifier"
		);
	}

	private _tokenToValue(token: Token): D5cValue {
		switch (token.type) {
			case "string":
				return {
					kind: "string",
					value: token.stringValue!,
					raw: token.text,
					location: token.location,
				};
			case "number":
			case "signedNumber":
				return {
					kind: "number",
					value: token.numberValue!,
					signed: token.signed === true,
					raw: token.text,
					location: token.location,
				};
			case "ref":
				return {
					kind: "ref",
					ref: token.ref!,
					raw: token.text,
					location: token.location,
				};
			case "dice":
				return {
					kind: "dice",
					count: token.dice!.count,
					sides: token.dice!.sides,
					modifier: token.dice!.modifier,
					raw: token.text,
					location: token.location,
				};
			case "identifier":
				if (IsBooleanKeyword(token.text)) {
					return { kind: "boolean", value: token.text === "true", location: token.location };
				}
				if (token.text === NoneKeyword) {
					return { kind: "none", location: token.location };
				}
				return { kind: "identifier", name: token.text, location: token.location };
			default:
				throw this._errorAt(
					"parse/unexpected-value",
					`Unexpected ${this._describe(token)} where a value was expected.`,
					token
				);
		}
	}

	private _expectStatementEnd(): void {
		const _token = this._current();
		if (
			_token.type === "newline" ||
			_token.type === "rbrace" ||
			_token.type === "eof"
		) {
			return;
		}

		throw this._errorAt(
			"parse/expected-statement-end",
			`Expected end of statement but found ${this._describe(_token)}.`,
			_token
		);
	}

	private _skipNewlines(): void {
		while (this._current().type === "newline") {
			this._advance();
		}
	}

	private _expect(type: Token["type"], code: string): Token {
		const _token = this._current();
		if (_token.type !== type) {
			throw this._errorAt(
				code,
				`Expected ${type} but found ${this._describe(_token)}.`,
				_token
			);
		}
		this._advance();
		return _token;
	}

	private _current(): Token {
		return this._tokens[this._index] ?? this._tokens[this._tokens.length - 1]!;
	}

	private _peek(ahead: number): Token {
		return this._tokens[this._index + ahead] ?? this._tokens[this._tokens.length - 1]!;
	}

	private _advance(): void {
		if (this._index < this._tokens.length - 1) {
			this._index += 1;
		}
	}

	private _describe(token: Token): string {
		if (token.type === "eof") {
			return "end of input";
		}
		if (token.type === "newline") {
			return "end of line";
		}
		return `${token.type} ${JSON.stringify(token.text)}`;
	}

	private _errorAt(code: string, message: string, token: Token): D5cParseError {
		const _location: SourceLocation = token.location;
		return new D5cParseError(message, [MakeDiagnostic("error", code, message, _location)]);
	}
}

export function ParseD5c(text: string): D5cDocument {
	const _tokens = Tokenize(text);
	return new Parser(_tokens).ParseDocument();
}
