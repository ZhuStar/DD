import type {
	D5cBlockStatement,
	D5cDocument,
	D5cStatement,
} from "../d5c/ast.ts";
import type { D5cDiagnostic } from "../d5c/errors.ts";
import { MakeDiagnostic } from "../d5c/errors.ts";
import { RuleRefKey } from "../rules/ruleRef.ts";
import type { CharacterDocument } from "./model.ts";

const _abilityNames = new Set([
	"Strength",
	"Dexterity",
	"Constitution",
	"Intelligence",
	"Wisdom",
	"Charisma",
]);

/**
 * Layer 2 shape validation. Operates on the raw AST and returns diagnostics; it
 * never throws. It checks structural expectations (ability names and numeric
 * scores, numeric level labels, a class per level, numeric currency, ref-only
 * spell lists) without applying any game-legality rules.
 */
export function ValidateD5cDocument(document: D5cDocument): D5cDiagnostic[] {
	const _diagnostics: D5cDiagnostic[] = [];
	const _body = document.character.body;

	_validateAbilities(_findBlock(_body, "Abilities"), _diagnostics);
	_validateLevels(_findBlock(_body, "Levels"), _diagnostics);
	_validateState(_findBlock(_body, "State"), _diagnostics);
	_validateInventory(_findBlock(_body, "Inventory"), _diagnostics);
	_validateSpells(_findBlock(_body, "Spells"), _diagnostics);

	return _diagnostics;
}

function _validateAbilities(
	block: D5cBlockStatement | undefined,
	diagnostics: D5cDiagnostic[]
): void {
	if (block === undefined) {
		diagnostics.push(
			MakeDiagnostic("error", "shape/missing-abilities", "Missing required Abilities block.")
		);
		return;
	}

	const _seen = new Set<string>();

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		if (!_abilityNames.has(_stmt.name)) {
			diagnostics.push(
				MakeDiagnostic(
					"error",
					"shape/unknown-ability",
					`Unknown ability "${_stmt.name}".`,
					_stmt.location
				)
			);
			continue;
		}
		_seen.add(_stmt.name);
		const _value = _stmt.values[0];
		if (_value === undefined || _value.kind !== "number") {
			diagnostics.push(
				MakeDiagnostic(
					"error",
					"shape/ability-not-number",
					`Ability "${_stmt.name}" must have a numeric score.`,
					_stmt.location
				)
			);
		}
	}

	for (const _name of _abilityNames) {
		if (!_seen.has(_name)) {
			diagnostics.push(
				MakeDiagnostic(
					"error",
					"shape/missing-ability",
					`Missing ability "${_name}".`,
					block.location
				)
			);
		}
	}
}

function _validateLevels(
	block: D5cBlockStatement | undefined,
	diagnostics: D5cDiagnostic[]
): void {
	if (block === undefined) {
		return;
	}

	for (const _stmt of block.body) {
		if (_stmt.kind !== "block" || _stmt.name !== "Level") {
			continue;
		}

		if (_stmt.label === undefined || _stmt.label.kind !== "number") {
			diagnostics.push(
				MakeDiagnostic(
					"error",
					"shape/level-label",
					"Level blocks must have a numeric label.",
					_stmt.location
				)
			);
		}

		const _class = _findField(_stmt.body, "Class");
		if (_class === undefined || _class.values[0]?.kind !== "ref") {
			diagnostics.push(
				MakeDiagnostic(
					"error",
					"shape/level-class",
					"Each Level must have a Class reference.",
					_stmt.location
				)
			);
		}

		const _hp = _findField(_stmt.body, "HitPoints");
		if (_hp !== undefined && _hp.values[0]?.kind !== "number") {
			diagnostics.push(
				MakeDiagnostic(
					"error",
					"shape/level-hitpoints",
					"HitPoints must be numeric.",
					_hp.location
				)
			);
		}
	}
}

function _validateState(
	block: D5cBlockStatement | undefined,
	diagnostics: D5cDiagnostic[]
): void {
	if (block === undefined) {
		return;
	}

	const _currentHp = _findField(block.body, "CurrentHp");
	if (_currentHp !== undefined && _currentHp.values[0]?.kind !== "number") {
		diagnostics.push(
			MakeDiagnostic(
				"error",
				"shape/currenthp-not-number",
				"CurrentHp must be numeric.",
				_currentHp.location
			)
		);
	}
}

function _validateInventory(
	block: D5cBlockStatement | undefined,
	diagnostics: D5cDiagnostic[]
): void {
	if (block === undefined) {
		return;
	}

	const _currency = _findBlock(block.body, "Currency");
	if (_currency === undefined) {
		return;
	}

	for (const _stmt of _currency.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		if (_stmt.values[0]?.kind !== "number") {
			diagnostics.push(
				MakeDiagnostic(
					"error",
					"shape/currency-not-number",
					`Currency "${_stmt.name}" must be numeric.`,
					_stmt.location
				)
			);
		}
	}
}

function _validateSpells(
	block: D5cBlockStatement | undefined,
	diagnostics: D5cDiagnostic[]
): void {
	if (block === undefined) {
		return;
	}

	for (const _name of ["Spellbook", "Prepared", "Known"]) {
		const _list = _findBlock(block.body, _name);
		if (_list === undefined) {
			continue;
		}
		for (const _stmt of _list.body) {
			if (_stmt.kind !== "listItem" || _stmt.value.kind !== "ref") {
				diagnostics.push(
					MakeDiagnostic(
						"error",
						"shape/spell-not-ref",
						`${_name} entries must be references.`,
						_stmt.location
					)
				);
			}
		}
	}
}

/**
 * Layer 3 (scaffold). A single trivial rules-level check proving where legality
 * validation will live: every prepared spell should also be in the spellbook.
 * Real rules validation (prepared-count limits, class spell legality,
 * multiclass prerequisites, proficiency, etc.) is intentionally not implemented
 * here.
 */
export function ValidateCharacterRules(document: CharacterDocument): D5cDiagnostic[] {
	const _diagnostics: D5cDiagnostic[] = [];
	const _book = new Set(document.character.spells.spellbook.map(RuleRefKey));

	for (const _ref of document.character.spells.prepared) {
		if (!_book.has(RuleRefKey(_ref))) {
			_diagnostics.push(
				MakeDiagnostic(
					"warning",
					"rules/prepared-not-in-spellbook",
					`Prepared spell ${RuleRefKey(_ref)} is not in the spellbook.`
				)
			);
		}
	}

	return _diagnostics;
}

function _findBlock(
	body: D5cStatement[],
	name: string
): D5cBlockStatement | undefined {
	for (const _stmt of body) {
		if (_stmt.kind === "block" && _stmt.name === name) {
			return _stmt;
		}
	}
	return undefined;
}

function _findField(
	body: D5cStatement[],
	name: string
): Extract<D5cStatement, { kind: "field" }> | undefined {
	for (const _stmt of body) {
		if (_stmt.kind === "field" && _stmt.name === name) {
			return _stmt;
		}
	}
	return undefined;
}
