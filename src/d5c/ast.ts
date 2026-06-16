import type { SourceLocation } from "./errors.ts";
import type { RuleRef } from "../rules/ruleRef.ts";

export interface D5cStringValue {
	kind: "string";
	value: string;
	raw: string;
	location: SourceLocation;
}

export interface D5cNumberValue {
	kind: "number";
	value: number;
	/** True when the literal carried an explicit sign, e.g. `+2` or `-2`. */
	signed: boolean;
	raw: string;
	location: SourceLocation;
}

export interface D5cBooleanValue {
	kind: "boolean";
	value: boolean;
	location: SourceLocation;
}

export interface D5cNoneValue {
	kind: "none";
	location: SourceLocation;
}

export interface D5cIdentifierValue {
	kind: "identifier";
	name: string;
	location: SourceLocation;
}

export interface D5cRefValue {
	kind: "ref";
	ref: RuleRef;
	raw: string;
	location: SourceLocation;
}

export interface D5cDiceValue {
	kind: "dice";
	/** Number of dice. `null` for shorthand like `d6`. */
	count: number | null;
	sides: number;
	/** Flat modifier, e.g. `+1` or `-2`. `null` when absent. */
	modifier: number | null;
	raw: string;
	location: SourceLocation;
}

export type D5cValue =
	| D5cStringValue
	| D5cNumberValue
	| D5cBooleanValue
	| D5cNoneValue
	| D5cIdentifierValue
	| D5cRefValue
	| D5cDiceValue;

export interface D5cFieldStatement {
	kind: "field";
	name: string;
	values: D5cValue[];
	location: SourceLocation;
}

export interface D5cBlockStatement {
	kind: "block";
	name: string;
	label?: D5cValue;
	body: D5cStatement[];
	location: SourceLocation;
}

export interface D5cListItemStatement {
	kind: "listItem";
	value: D5cValue;
	location: SourceLocation;
}

export type D5cStatement =
	| D5cFieldStatement
	| D5cBlockStatement
	| D5cListItemStatement;

export interface D5cCharacterNode {
	name: string;
	body: D5cStatement[];
	location: SourceLocation;
}

export interface D5cDocument {
	kind: "D5C";
	version: number;
	character: D5cCharacterNode;
	location: SourceLocation;
}
