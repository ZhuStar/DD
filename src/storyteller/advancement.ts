import type { Diagnostic } from "../common/text/errors.ts";
import { MakeDiagnostic } from "../common/text/errors.ts";
import type {
	HistoryEntry,
	StorytellerDocument,
	TraitChange,
} from "./model.ts";
import { AbilityGroupOf, AttributeGroupOf } from "./model.ts";
import type { CreationProfile } from "./rules.ts";
import { BudgetFor, DeriveStoryteller } from "./derive.ts";
import type { DerivedStoryteller } from "./derive.ts";

/**
 * Experience cost to change a trait of `traitType`: `newCost` for a brand-new
 * dot, otherwise `multiplier × currentRating`. Returns `undefined` when the
 * profile defines no rule for that trait type.
 */
export function ExperienceCost(
	profile: CreationProfile,
	traitType: string,
	currentRating: number,
	isNew: boolean
): number | undefined {
	const _rule = profile.experience[traitType.toLowerCase()];
	if (_rule === undefined) {
		return undefined;
	}
	return isNew ? _rule.newCost : _rule.multiplier * currentRating;
}

/** Freebie cost to raise a trait of `traitType` by `dots`. */
export function FreebieCost(
	profile: CreationProfile,
	traitType: string,
	dots: number
): number | undefined {
	const _perDot = profile.freebie.costs[traitType.toLowerCase()];
	return _perDot === undefined ? undefined : _perDot * dots;
}

export interface LedgerState {
	xpEarned: number;
	xpSpent: number;
	xpAvailable: number;
	freebieSpent: number;
}

export interface LedgerStep {
	entry: HistoryEntry;
	state: LedgerState;
}

export interface ReplayResult {
	steps: LedgerStep[];
	final: LedgerState;
	diagnostics: Diagnostic[];
}

/**
 * Replays the history ledger in order, maintaining a running experience balance
 * and validating each spend against the profile's cost rules. Flags cost
 * mismatches, overspends (negative balance), freebie over-budget, and
 * creation-point allocations that do not match the priority budgets. All costs
 * come from the profile (rule data); nothing here is hardcoded.
 */
export function ReplayHistory(
	document: StorytellerDocument,
	profile: CreationProfile
): ReplayResult {
	const _diagnostics: Diagnostic[] = [];
	const _steps: LedgerStep[] = [];
	const _creationByGroup = new Map<string, number>();

	let _xpEarned = 0;
	let _xpSpent = 0;
	let _freebieSpent = 0;

	for (const _entry of document.character.history) {
		_xpEarned += _entry.xpGained ?? 0;
		let _entryXpSpent = 0;

		for (const _change of _entry.changes) {
			const _cost = _evaluateChange(_change, profile, _diagnostics);

			if (_change.pool === "experience") {
				_xpSpent += _cost;
				_entryXpSpent += _cost;
			} else if (_change.pool === "freebie") {
				_freebieSpent += _cost;
			} else if (_change.pool === "creation") {
				const _group = _creationGroup(_change);
				if (_group !== undefined) {
					_creationByGroup.set(_group, (_creationByGroup.get(_group) ?? 0) + _dots(_change));
				}
			}
		}

		if (_entry.xpSpent !== undefined && _entry.changes.some((c) => c.pool === "experience")) {
			if (_entry.xpSpent !== _entryXpSpent) {
				_diagnostics.push(
					MakeDiagnostic(
						"warning",
						"advancement/entry-xp-mismatch",
						`Entry "${_entry.kind}" records XpSpent ${_entry.xpSpent} but its raises cost ${_entryXpSpent}.`
					)
				);
			}
		}

		const _available = _xpEarned - _xpSpent;
		if (_available < 0) {
			_diagnostics.push(
				MakeDiagnostic(
					"error",
					"advancement/insufficient-xp",
					`After "${_entry.kind}", experience went negative (${_available}).`
				)
			);
		}

		_steps.push({
			entry: _entry,
			state: {
				xpEarned: _xpEarned,
				xpSpent: _xpSpent,
				xpAvailable: _available,
				freebieSpent: _freebieSpent,
			},
		});
	}

	if (profile.freebie.budget > 0 && _freebieSpent > profile.freebie.budget) {
		_diagnostics.push(
			MakeDiagnostic(
				"error",
				"advancement/freebie-over-budget",
				`Spent ${_freebieSpent} freebie points but the budget is ${profile.freebie.budget}.`
			)
		);
	}

	_checkCreationBudgets(document, profile, _creationByGroup, _diagnostics);

	const _final: LedgerState = {
		xpEarned: _xpEarned,
		xpSpent: _xpSpent,
		xpAvailable: _xpEarned - _xpSpent,
		freebieSpent: _freebieSpent,
	};

	return { steps: _steps, final: _final, diagnostics: _diagnostics };
}

export interface StorytellerEvaluation {
	derived: DerivedStoryteller;
	ledger: ReplayResult;
	diagnostics: Diagnostic[];
}

/** Runs both the derivation and the history replay against a profile. */
export function EvaluateStoryteller(
	document: StorytellerDocument,
	profile: CreationProfile
): StorytellerEvaluation {
	const _derived = DeriveStoryteller(document, profile);
	const _ledger = ReplayHistory(document, profile);
	return {
		derived: _derived,
		ledger: _ledger,
		diagnostics: [..._derived.diagnostics, ..._ledger.diagnostics],
	};
}

function _evaluateChange(
	change: TraitChange,
	profile: CreationProfile,
	diagnostics: Diagnostic[]
): number {
	let _expected: number | undefined;

	if (change.pool === "experience") {
		const _from = change.from ?? 0;
		const _isNew = change.from === undefined || change.from === 0;
		_expected = ExperienceCost(profile, change.traitType, _from, _isNew);
		if (_expected === undefined) {
			diagnostics.push(
				MakeDiagnostic(
					"warning",
					"advancement/no-cost-rule",
					`No experience cost rule for trait type "${change.traitType}".`
				)
			);
		}
	} else if (change.pool === "freebie") {
		_expected = FreebieCost(profile, change.traitType, _dots(change));
		if (_expected === undefined) {
			diagnostics.push(
				MakeDiagnostic(
					"warning",
					"advancement/no-freebie-cost",
					`No freebie cost for trait type "${change.traitType}".`
				)
			);
		}
	} else if (change.pool === "creation") {
		// Creation points are 1:1 with dots.
		_expected = _dots(change);
	}

	if (change.cost !== undefined && _expected !== undefined && change.cost !== _expected) {
		diagnostics.push(
			MakeDiagnostic(
				"warning",
				"advancement/cost-mismatch",
				`${change.pool} change to ${change.traitType} records cost ${change.cost} but the profile implies ${_expected}.`
			)
		);
	}

	return change.cost ?? _expected ?? 0;
}

function _dots(change: TraitChange): number {
	if (change.from !== undefined && change.to !== undefined) {
		return change.to - change.from;
	}
	return 1;
}

function _creationGroup(change: TraitChange): string | undefined {
	const _attr = change.name === undefined ? undefined : AttributeGroupOf(change.name);
	if (_attr !== undefined) {
		return `attribute:${_attr}`;
	}
	const _ability = AbilityGroupOf(change.traitType);
	if (_ability !== undefined) {
		return `ability:${_ability}`;
	}
	return undefined;
}

function _checkCreationBudgets(
	document: StorytellerDocument,
	profile: CreationProfile,
	creationByGroup: Map<string, number>,
	diagnostics: Diagnostic[]
): void {
	if (creationByGroup.size === 0) {
		return;
	}

	const _priorities = document.character.priorities;

	for (const _group of ["physical", "social", "mental"] as const) {
		const _budget = BudgetFor(profile.attributePoints, _priorities.attributes[_group]);
		_compareAllocation(`attribute:${_group}`, _group, _budget, creationByGroup, diagnostics);
	}
	for (const _group of ["talents", "skills", "knowledges"] as const) {
		const _budget = BudgetFor(profile.abilityPoints, _priorities.abilities[_group]);
		_compareAllocation(`ability:${_group}`, _group, _budget, creationByGroup, diagnostics);
	}
}

function _compareAllocation(
	key: string,
	label: string,
	budget: number | undefined,
	creationByGroup: Map<string, number>,
	diagnostics: Diagnostic[]
): void {
	const _allocated = creationByGroup.get(key);
	if (_allocated === undefined || budget === undefined) {
		return;
	}
	if (_allocated !== budget) {
		diagnostics.push(
			MakeDiagnostic(
				"warning",
				"creation/budget-mismatch",
				`Creation allocated ${_allocated} dots to ${label} but the priority budget is ${budget}.`
			)
		);
	}
}
