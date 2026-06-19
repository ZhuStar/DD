import type { DocBlockStatement, DocStatement } from "./text/ast.ts";
import { AsString, ValueToPrimitive } from "./text/values.ts";

/**
 * A manual override of a derived value, with an optional human reason. This is
 * common to every system: `ArmorClass 15 because "Mage Armor"` for D&D,
 * `Initiative 6 because "Celerity active"` for Storyteller.
 */
export interface Override {
	target: string;
	value: unknown;
	reason?: string;
	raw?: DocStatement;
}

/**
 * Normalizes an `Overrides` block. Each field is `Target value* [because
 * "reason"]`; the reason tail is split off and the remaining values are reduced
 * to primitives (a single value is unwrapped, multiple are kept as an array).
 */
export function NormalizeOverrides(block: DocBlockStatement): Override[] {
	const _overrides: Override[] = [];

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}

		const _becauseIndex = _stmt.values.findIndex(
			(v) => v.kind === "identifier" && v.name === "because"
		);
		const _reason =
			_becauseIndex >= 0 ? AsString(_stmt.values[_becauseIndex + 1]) : undefined;
		const _end = _becauseIndex >= 0 ? _becauseIndex : _stmt.values.length;
		const _parts = _stmt.values.slice(0, _end).map(ValueToPrimitive);
		const _value = _parts.length === 1 ? _parts[0] : _parts;

		const _override: Override = { target: _stmt.name, value: _value, raw: _stmt };
		if (_reason !== undefined) {
			_override.reason = _reason;
		}
		_overrides.push(_override);
	}

	return _overrides;
}

/** Normalizes a `Notes` block into a `name -> text` record. */
export function NormalizeNotes(block: DocBlockStatement): Record<string, string> {
	const _notes: Record<string, string> = {};

	for (const _stmt of block.body) {
		if (_stmt.kind === "field") {
			_notes[_stmt.name] = AsString(_stmt.values[0]) ?? "";
		}
	}

	return _notes;
}
