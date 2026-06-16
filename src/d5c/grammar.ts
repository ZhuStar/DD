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

export const FormatKeyword = "D5C";
export const CharacterKeyword = "Character";
export const NoneKeyword = "none";
export const TrueKeyword = "true";
export const FalseKeyword = "false";

export function IsBooleanKeyword(text: string): boolean {
	return text === TrueKeyword || text === FalseKeyword;
}
