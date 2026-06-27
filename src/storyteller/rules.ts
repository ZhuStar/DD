import type { Diagnostic } from "../common/text/errors.ts";
import { MakeDiagnostic } from "../common/text/errors.ts";
import type { RuleObject } from "../common/rules/ruleObject.ts";

/**
 * Typed shapes for the Storyteller creation/advancement rule data. These live in
 * a `RuleObject.data` payload delivered by a `RuleSource`, so the *numbers* are
 * data (swappable per game line / edition / homebrew) while only the
 * interpretation below is code. Mortal vs. vampire differ purely by which
 * profile object their `Splat.Profile` reference resolves to.
 */

export interface GenerationStats {
	bloodPoolMax: number;
	bloodPerTurn: number;
	traitMax: number;
}

export interface PointAllotment {
	primary: number;
	secondary: number;
	tertiary: number;
}

export interface FreebieRules {
	budget: number;
	/** Freebie cost per dot, keyed by trait type (attribute, ability, …). */
	costs: Record<string, number>;
}

/** Experience cost rule: `new` for a first dot, `multiplier × currentRating` to raise. */
export interface ExperienceCostRule {
	newCost: number;
	multiplier: number;
}

export interface CreationProfile {
	/** Free dots every attribute/ability starts with before points are spent. */
	startingAttribute: number;
	startingAbility: number;
	attributePoints: PointAllotment;
	abilityPoints: PointAllotment;
	freebie: FreebieRules;
	experience: Record<string, ExperienceCostRule>;
	/** Generation table keyed by generation number (as a string). */
	generation: Record<string, GenerationStats>;
}

export interface ParsedProfile {
	profile?: CreationProfile;
	diagnostics: Diagnostic[];
}

const _defaultAllotment: PointAllotment = { primary: 0, secondary: 0, tertiary: 0 };

/**
 * Parses and validates a `CreationProfile` out of a rule object's `unknown`
 * `data` — the boundary where external rule content enters the system. Missing
 * or malformed fields produce diagnostics and fall back to safe defaults rather
 * than throwing.
 */
export function ParseCreationProfile(rule: RuleObject): ParsedProfile {
	const _diagnostics: Diagnostic[] = [];
	const _data = rule.data;

	if (!_isObject(_data)) {
		_diagnostics.push(
			MakeDiagnostic(
				"error",
				"profile/invalid",
				`Creation profile ${rule.source}:${rule.type}/${rule.ref.id} has no data object.`
			)
		);
		return { diagnostics: _diagnostics };
	}

	const _profile: CreationProfile = {
		startingAttribute: _num(_data["startingAttribute"], 1),
		startingAbility: _num(_data["startingAbility"], 0),
		attributePoints: _allotment(_data["attributePoints"]),
		abilityPoints: _allotment(_data["abilityPoints"]),
		freebie: _freebie(_data["freebie"], _diagnostics),
		experience: _experience(_data["experience"]),
		generation: _generation(_data["generation"]),
	};

	return { profile: _profile, diagnostics: _diagnostics };
}

function _allotment(value: unknown): PointAllotment {
	if (!_isObject(value)) {
		return { ..._defaultAllotment };
	}
	return {
		primary: _num(value["primary"], 0),
		secondary: _num(value["secondary"], 0),
		tertiary: _num(value["tertiary"], 0),
	};
}

function _freebie(value: unknown, diagnostics: Diagnostic[]): FreebieRules {
	if (!_isObject(value)) {
		diagnostics.push(
			MakeDiagnostic("warning", "profile/no-freebie", "Profile has no freebie rules.")
		);
		return { budget: 0, costs: {} };
	}
	const _costs: Record<string, number> = {};
	const _rawCosts = value["costs"];
	if (_isObject(_rawCosts)) {
		for (const [_key, _cost] of Object.entries(_rawCosts)) {
			if (typeof _cost === "number") {
				_costs[_key.toLowerCase()] = _cost;
			}
		}
	}
	return { budget: _num(value["budget"], 0), costs: _costs };
}

function _experience(value: unknown): Record<string, ExperienceCostRule> {
	const _rules: Record<string, ExperienceCostRule> = {};
	if (!_isObject(value)) {
		return _rules;
	}
	for (const [_key, _rule] of Object.entries(value)) {
		if (_isObject(_rule)) {
			_rules[_key.toLowerCase()] = {
				newCost: _num(_rule["newCost"], 0),
				multiplier: _num(_rule["multiplier"], 0),
			};
		}
	}
	return _rules;
}

function _generation(value: unknown): Record<string, GenerationStats> {
	const _table: Record<string, GenerationStats> = {};
	if (!_isObject(value)) {
		return _table;
	}
	for (const [_key, _stats] of Object.entries(value)) {
		if (_isObject(_stats)) {
			_table[_key] = {
				bloodPoolMax: _num(_stats["bloodPoolMax"], 0),
				bloodPerTurn: _num(_stats["bloodPerTurn"], 0),
				traitMax: _num(_stats["traitMax"], 5),
			};
		}
	}
	return _table;
}

function _isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function _num(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
