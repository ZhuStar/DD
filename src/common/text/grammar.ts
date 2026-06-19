/**
 * Token categories produced by the lexer. Booleans and the `none` literal are
 * lexed as identifiers and classified into values by the parser, keeping the
 * lexer free of any rule-specific knowledge.
 */
export type TokenType =
	| "lbrace"
	| "rbrace"
	| "string"
	| "number"
	| "signedNumber"
	| "identifier"
	| "ref"
	| "dice"
	| "newline"
	| "eof";

export const NoneKeyword = "none";
export const TrueKeyword = "true";
export const FalseKeyword = "false";

export function IsBooleanKeyword(text: string): boolean {
	return text === TrueKeyword || text === FalseKeyword;
}

/**
 * Configures the document/root keywords for a concrete format built on top of
 * this generic block syntax. For example D&D uses `{ formatKeyword: "D5C",
 * rootKeyword: "Character" }` and Storyteller uses `"STC"` / `"Character"`.
 */
export interface FormatOptions {
	formatKeyword: string;
	rootKeyword: string;
}
