import type {
	DocBlockStatement,
	DocFieldStatement,
	DocStatement,
	DocValue,
} from "./ast.ts";
import type { RuleRef } from "../rules/ruleRef.ts";

/** Returns the first value of a field, or `undefined` when it has none. */
export function FirstValue(field: DocFieldStatement): DocValue | undefined {
	return field.values[0];
}

export function AsNumber(value: DocValue | undefined): number | undefined {
	return value !== undefined && value.kind === "number" ? value.value : undefined;
}

export function AsString(value: DocValue | undefined): string | undefined {
	return value !== undefined && value.kind === "string" ? value.value : undefined;
}

export function AsBoolean(value: DocValue | undefined): boolean | undefined {
	return value !== undefined && value.kind === "boolean" ? value.value : undefined;
}

export function AsIdentifier(value: DocValue | undefined): string | undefined {
	return value !== undefined && value.kind === "identifier" ? value.name : undefined;
}

export function AsRef(value: DocValue | undefined): RuleRef | undefined {
	return value !== undefined && value.kind === "ref" ? value.ref : undefined;
}

/** Reduces any value to a plain JS primitive (refs stay as `RuleRef`). */
export function ValueToPrimitive(value: DocValue): unknown {
	switch (value.kind) {
		case "string":
			return value.value;
		case "number":
			return value.value;
		case "boolean":
			return value.value;
		case "none":
			return null;
		case "identifier":
			return value.name;
		case "ref":
			return value.ref;
		case "dice":
			return value.raw;
	}
}

export function FindBlock(
	body: DocStatement[],
	name: string
): DocBlockStatement | undefined {
	for (const _stmt of body) {
		if (_stmt.kind === "block" && _stmt.name === name) {
			return _stmt;
		}
	}
	return undefined;
}

export function FindField(
	body: DocStatement[],
	name: string
): DocFieldStatement | undefined {
	for (const _stmt of body) {
		if (_stmt.kind === "field" && _stmt.name === name) {
			return _stmt;
		}
	}
	return undefined;
}

/** Assigns a value to a target property only when it is defined. */
export function AssignOptional<T, K extends keyof T>(
	target: T,
	key: K,
	value: T[K] | undefined
): void {
	if (value !== undefined) {
		target[key] = value;
	}
}
