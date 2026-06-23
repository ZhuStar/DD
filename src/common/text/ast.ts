import type { SourceLocation } from "./errors.ts";
import type { RuleRef } from "../rules/ruleRef.ts";

export interface DocStringValue {
	kind: "string";
	value: string;
	raw: string;
	location: SourceLocation;
}

export interface DocNumberValue {
	kind: "number";
	value: number;
	/** True when the literal carried an explicit sign, e.g. `+2` or `-2`. */
	signed: boolean;
	raw: string;
	location: SourceLocation;
}

export interface DocBooleanValue {
	kind: "boolean";
	value: boolean;
	location: SourceLocation;
}

export interface DocNoneValue {
	kind: "none";
	location: SourceLocation;
}

export interface DocIdentifierValue {
	kind: "identifier";
	name: string;
	location: SourceLocation;
}

export interface DocRefValue {
	kind: "ref";
	ref: RuleRef;
	raw: string;
	location: SourceLocation;
}

export interface DocDiceValue {
	kind: "dice";
	/** Number of dice. `null` for shorthand like `d6`. */
	count: number | null;
	sides: number;
	/** Flat modifier, e.g. `+1` or `-2`. `null` when absent. */
	modifier: number | null;
	raw: string;
	location: SourceLocation;
}

export type DocValue =
	| DocStringValue
	| DocNumberValue
	| DocBooleanValue
	| DocNoneValue
	| DocIdentifierValue
	| DocRefValue
	| DocDiceValue;

export interface DocFieldStatement {
	kind: "field";
	name: string;
	values: DocValue[];
	location: SourceLocation;
}

export interface DocBlockStatement {
	kind: "block";
	name: string;
	label?: DocValue;
	body: DocStatement[];
	location: SourceLocation;
}

export interface DocListItemStatement {
	kind: "listItem";
	value: DocValue;
	location: SourceLocation;
}

export type DocStatement =
	| DocFieldStatement
	| DocBlockStatement
	| DocListItemStatement;

/** The root block of a document (e.g. `Character "Name" { … }`). */
export interface DocRootNode {
	/** The root keyword, e.g. `Character`. */
	keyword: string;
	/** The root label, e.g. the quoted character name. */
	name: string;
	body: DocStatement[];
	location: SourceLocation;
}

export interface DocDocument {
	/** The format keyword from the header, e.g. `D5C` or `STC`. */
	format: string;
	version: number;
	root: DocRootNode;
	location: SourceLocation;
}
