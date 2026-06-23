import type {
	DocBlockStatement,
	DocDocument,
	DocFieldStatement,
	DocListItemStatement,
	DocRootNode,
	DocStatement,
	DocValue,
} from "./ast.ts";
import type { SourceLocation } from "./errors.ts";
import { ParseError, MakeDiagnostic } from "./errors.ts";
import type { FormatOptions } from "./grammar.ts";
import { IsBooleanKeyword, NoneKeyword } from "./grammar.ts";
import type { Token } from "./lexer.ts";
import { Tokenize } from "./lexer.ts";

/**
 * Recursive-descent parser for the generic block document grammar shared by
 * every game system in this repository. It builds a raw AST that preserves
 * document structure and source locations.
 *
 * The parser understands document syntax only; it never interprets game rules,
 * legality, or derived values. The only system-specific input is the
 * `FormatOptions` (the document header and root-block keywords).
 */
export class Parser {
	private readonly _tokens: Token[];
	private readonly _options: FormatOptions;
	private _index = 0;

	public constructor(tokens: Token[], options: FormatOptions) {
		this._tokens = tokens;
		this._options = options;
	}

	public ParseDocument(): DocDocument {
		this._skipNewlines();

		const _header = this._current();
		if (_header.type !== "identifier" || _header.text !== this._options.formatKeyword) {
			throw this._errorAt(
				"parse/expected-header",
				`Expected document to start with "${this._options.formatKeyword}".`,
				_header
			);
		}
		this._advance();

		const _versionToken = this._expect("number", "parse/expected-version");
		const _version = _versionToken.numberValue!;

		this._skipNewlines();
		const _root = this._parseRoot();

		this._skipNewlines();
		const _trailing = this._current();
		if (_trailing.type !== "eof") {
			throw this._errorAt(
				"parse/unexpected-trailing",
				`Unexpected ${this._describe(_trailing)} after ${this._options.rootKeyword} block.`,
				_trailing
			);
		}

		return {
			format: this._options.formatKeyword,
			version: _version,
			root: _root,
			location: _header.location,
		};
	}

	private _parseRoot(): DocRootNode {
		const _keyword = this._current();
		if (_keyword.type !== "identifier" || _keyword.text !== this._options.rootKeyword) {
			throw this._errorAt(
				"parse/expected-root",
				`Expected "${this._options.rootKeyword}" block.`,
				_keyword
			);
		}
		this._advance();

		const _nameToken = this._expect("string", "parse/expected-root-name");
		const _body = this._parseBlock();

		return {
			keyword: _keyword.text,
			name: _nameToken.stringValue!,
			body: _body,
			location: _keyword.location,
		};
	}

	private _parseBlock(): DocStatement[] {
		this._expect("lbrace", "parse/expected-open-brace");
		const _body: DocStatement[] = [];

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

	private _parseStatement(): DocStatement {
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

	private _parseListItem(): DocListItemStatement {
		const _token = this._current();
		this._advance();
		return {
			kind: "listItem",
			value: this._tokenToValue(_token),
			location: _token.location,
		};
	}

	private _parseIdentifierStatement(): DocStatement {
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

	private _parseField(name: Token): DocFieldStatement {
		const _values: DocValue[] = [];

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

	private _tokenToValue(token: Token): DocValue {
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

	private _errorAt(code: string, message: string, token: Token): ParseError {
		const _location: SourceLocation = token.location;
		return new ParseError(message, [MakeDiagnostic("error", code, message, _location)]);
	}
}

/** Parses document text into a raw AST using the given format options. */
export function ParseDocument(text: string, options: FormatOptions): DocDocument {
	const _tokens = Tokenize(text);
	return new Parser(_tokens, options).ParseDocument();
}
