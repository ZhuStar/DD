import type { DocBlockStatement, DocDocument } from "../common/text/ast.ts";
import type { Diagnostic } from "../common/text/errors.ts";
import { MakeDiagnostic } from "../common/text/errors.ts";
import { FindBlock } from "../common/text/values.ts";
import type { StorytellerDocument } from "./model.ts";
import { AttributeNames } from "./model.ts";

/**
 * Layer 2 shape validation for STC. Returns diagnostics; never throws. Checks
 * that the nine attributes are present and numeric, that grouped categories
 * exist, and that rated entries (abilities, advantages, merits/flaws) carry a
 * numeric rating — without applying game-legality rules.
 */
export function ValidateStcDocument(document: DocDocument): Diagnostic[] {
	const _diagnostics: Diagnostic[] = [];
	const _body = document.root.body;

	_validateAttributes(FindBlock(_body, "Attributes"), _diagnostics);
	_validateRatedBlock(FindBlock(_body, "Abilities"), "ability", _diagnostics);
	_validateRatedBlock(FindBlock(_body, "Advantages"), "advantage", _diagnostics);
	_validateRatedBlock(FindBlock(_body, "MeritsFlaws"), "merit/flaw", _diagnostics);

	return _diagnostics;
}

function _validateAttributes(
	block: DocBlockStatement | undefined,
	diagnostics: Diagnostic[]
): void {
	if (block === undefined) {
		diagnostics.push(
			MakeDiagnostic("error", "shape/missing-attributes", "Missing required Attributes block.")
		);
		return;
	}

	for (const _category of ["physical", "social", "mental"] as const) {
		const _groupName = _category.charAt(0).toUpperCase() + _category.slice(1);
		const _group = FindBlock(block.body, _groupName);
		if (_group === undefined) {
			diagnostics.push(
				MakeDiagnostic(
					"error",
					"shape/missing-attribute-group",
					`Missing ${_groupName} attribute group.`,
					block.location
				)
			);
			continue;
		}

		const _seen = new Set<string>();
		for (const _stmt of _group.body) {
			if (_stmt.kind !== "field") {
				continue;
			}
			_seen.add(_stmt.name);
			if (_stmt.values[0]?.kind !== "number") {
				diagnostics.push(
					MakeDiagnostic(
						"error",
						"shape/attribute-not-number",
						`Attribute "${_stmt.name}" must be numeric.`,
						_stmt.location
					)
				);
			}
		}

		for (const _expected of AttributeNames[_category]) {
			if (!_seen.has(_expected)) {
				diagnostics.push(
					MakeDiagnostic(
						"error",
						"shape/missing-attribute",
						`Missing attribute "${_expected}".`,
						_group.location
					)
				);
			}
		}
	}
}

function _validateRatedBlock(
	block: DocBlockStatement | undefined,
	label: string,
	diagnostics: Diagnostic[]
): void {
	if (block === undefined) {
		return;
	}

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _hasRating = _stmt.values.some((v) => v.kind === "number");
		if (!_hasRating) {
			diagnostics.push(
				MakeDiagnostic(
					"error",
					"shape/missing-rating",
					`${label} "${_stmt.name}" must have a numeric rating.`,
					_stmt.location
				)
			);
		}
	}
}

/**
 * Layer 3 (scaffold). Two trivial rules-level checks proving where legality
 * validation will live: current Willpower may not exceed its rating, and a
 * pool's current may not exceed its maximum. Full Storyteller legality
 * (attribute/ability point spends, generation caps on traits, discipline
 * prerequisites, etc.) is intentionally not implemented here.
 */
export function ValidateStorytellerRules(document: StorytellerDocument): Diagnostic[] {
	const _diagnostics: Diagnostic[] = [];
	const _character = document.character;

	if (_character.willpower.current > _character.willpower.rating) {
		_diagnostics.push(
			MakeDiagnostic(
				"warning",
				"rules/willpower-over-rating",
				`Current Willpower (${_character.willpower.current}) exceeds its rating (${_character.willpower.rating}).`
			)
		);
	}

	for (const _pool of _character.pools) {
		if (_pool.current > _pool.max) {
			_diagnostics.push(
				MakeDiagnostic(
					"warning",
					"rules/pool-over-max",
					`${_pool.name} current (${_pool.current}) exceeds its maximum (${_pool.max}).`
				)
			);
		}
	}

	return _diagnostics;
}
