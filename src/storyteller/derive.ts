import type { Diagnostic } from "../common/text/errors.ts";
import { MakeDiagnostic } from "../common/text/errors.ts";
import { RuleRefKey } from "../common/rules/ruleRef.ts";
import type { Priority, StorytellerDocument } from "./model.ts";
import { AbilityGroupOf } from "./model.ts";
import type {
	CreationProfile,
	GenerationStats,
	ParsedProfile,
	PointAllotment,
} from "./rules.ts";
import { ParseCreationProfile } from "./rules.ts";
import type { ResolvedStorytellerDocument } from "./resolveCharacter.ts";

export interface AttributeNumbers {
	physical: number;
	social: number;
	mental: number;
}

export interface AbilityNumbers {
	talents: number;
	skills: number;
	knowledges: number;
}

/** The values an engine derives from stored choices — never stored in the file. */
export interface DerivedStoryteller {
	generation?: GenerationStats;
	bloodPoolMax?: number;
	bloodPerTurn?: number;
	traitMax?: number;
	attributeBudgets: Partial<AttributeNumbers>;
	abilityBudgets: Partial<AbilityNumbers>;
	attributeSpent: AttributeNumbers;
	abilitySpent: AbilityNumbers;
	diagnostics: Diagnostic[];
}

/** Looks up the generation row (blood pool / per-turn / trait cap) from a profile. */
export function GenerationStatsFor(
	profile: CreationProfile,
	generation: number
): GenerationStats | undefined {
	return profile.generation[String(generation)];
}

export function BudgetFor(
	allotment: PointAllotment,
	priority: Priority | undefined
): number | undefined {
	return priority === undefined ? undefined : allotment[priority];
}

/** Resolves and parses the creation profile referenced by `Splat.Profile`. */
export function ProfileFromResolved(resolved: ResolvedStorytellerDocument): ParsedProfile {
	const _ref = resolved.document.character.splat.profile;
	if (_ref === undefined) {
		return {
			diagnostics: [
				MakeDiagnostic("warning", "derive/no-profile", "Character has no Splat.Profile reference."),
			],
		};
	}
	const _rule = resolved.rules.byKey.get(RuleRefKey(_ref));
	if (_rule === undefined) {
		return {
			diagnostics: [
				MakeDiagnostic(
					"error",
					"derive/profile-unresolved",
					`Profile ${RuleRefKey(_ref)} did not resolve to a rule object.`
				),
			],
		};
	}
	return ParseCreationProfile(_rule);
}

/**
 * Derives the values a Storyteller sheet does not store: the generation-based
 * blood pool / trait cap, the attribute and ability point budgets implied by
 * the chosen priorities, and the dots currently spent. Cap violations on the
 * current sheet are reported as diagnostics. Everything comes from the supplied
 * profile (rule data), nothing is hardcoded.
 */
export function DeriveStoryteller(
	document: StorytellerDocument,
	profile: CreationProfile
): DerivedStoryteller {
	const _character = document.character;
	const _diagnostics: Diagnostic[] = [];

	const _derived: DerivedStoryteller = {
		attributeBudgets: {},
		abilityBudgets: {},
		attributeSpent: _attributeSpent(document, profile),
		abilitySpent: _abilitySpent(document),
		diagnostics: _diagnostics,
	};

	// Generation-derived stats.
	if (_character.splat.generation !== undefined) {
		const _stats = GenerationStatsFor(profile, _character.splat.generation);
		if (_stats === undefined) {
			_diagnostics.push(
				MakeDiagnostic(
					"warning",
					"derive/no-generation-row",
					`Profile has no generation row for generation ${_character.splat.generation}.`
				)
			);
		} else {
			_derived.generation = _stats;
			_derived.bloodPoolMax = _stats.bloodPoolMax;
			_derived.bloodPerTurn = _stats.bloodPerTurn;
			_derived.traitMax = _stats.traitMax;
		}
	}

	// Priority -> point budgets.
	for (const _group of ["physical", "social", "mental"] as const) {
		const _budget = BudgetFor(profile.attributePoints, _character.priorities.attributes[_group]);
		if (_budget !== undefined) {
			_derived.attributeBudgets[_group] = _budget;
		}
	}
	for (const _group of ["talents", "skills", "knowledges"] as const) {
		const _budget = BudgetFor(profile.abilityPoints, _character.priorities.abilities[_group]);
		if (_budget !== undefined) {
			_derived.abilityBudgets[_group] = _budget;
		}
	}

	// Cap check against the current sheet (a stored Blood pool over the
	// generation max, or a trait above the generation trait cap).
	const _traitMax = _derived.traitMax;
	if (_traitMax !== undefined) {
		for (const _group of ["physical", "social", "mental"] as const) {
			for (const [_name, _rating] of Object.entries(_character.attributes[_group])) {
				if (_rating > _traitMax) {
					_diagnostics.push(
						MakeDiagnostic(
							"error",
							"derive/over-cap",
							`Attribute ${_name} (${_rating}) exceeds the generation trait cap (${_traitMax}).`
						)
					);
				}
			}
		}
		for (const _ability of _character.abilities) {
			if (_ability.rating > _traitMax) {
				_diagnostics.push(
					MakeDiagnostic(
						"error",
						"derive/over-cap",
						`Ability ${_label(_ability.name, _ability.ref?.id)} (${_ability.rating}) exceeds the trait cap (${_traitMax}).`
					)
				);
			}
		}
	}

	const _bloodMax = _derived.bloodPoolMax;
	if (_bloodMax !== undefined) {
		for (const _pool of _character.pools) {
			if (_pool.name.toLowerCase().includes("blood") && _pool.max > _bloodMax) {
				_diagnostics.push(
					MakeDiagnostic(
						"error",
						"derive/blood-over-max",
						`${_pool.name} max (${_pool.max}) exceeds the generation blood-pool max (${_bloodMax}).`
					)
				);
			}
		}
	}

	return _derived;
}

function _attributeSpent(document: StorytellerDocument, profile: CreationProfile): AttributeNumbers {
	const _attrs = document.character.attributes;
	const _spent = (group: Record<string, number>): number => {
		const _values = Object.values(group);
		const _sum = _values.reduce((total, n) => total + n, 0);
		return _sum - profile.startingAttribute * _values.length;
	};
	return {
		physical: _spent(_attrs.physical),
		social: _spent(_attrs.social),
		mental: _spent(_attrs.mental),
	};
}

function _abilitySpent(document: StorytellerDocument): AbilityNumbers {
	const _spent: AbilityNumbers = { talents: 0, skills: 0, knowledges: 0 };
	for (const _ability of document.character.abilities) {
		const _group = AbilityGroupOf(_ability.category);
		if (_group !== undefined) {
			_spent[_group] += _ability.rating;
		}
	}
	return _spent;
}

function _label(name: string | undefined, id: string | undefined): string {
	return name ?? id ?? "trait";
}
