import type { DocBlockStatement, DocStatement } from "../common/text/ast.ts";
import type { RuleRef } from "../common/rules/ruleRef.ts";
import type { Override } from "../common/character.ts";

/**
 * A normalized classic Storyteller System character ("STC"). This models the
 * common World of Darkness chassis (Attributes, Abilities, Advantages, Virtues,
 * Willpower, a morality Path, pools, health levels, experience) used across the
 * original/revised game lines — NOT the 5th-edition rules. Splat-specific
 * content (clan, disciplines, merits, …) is stored as references, never as
 * copied rule text.
 */
export interface StorytellerDocument {
	format: "STC";
	formatVersion: number;
	game: string;
	character: StorytellerCharacter;
	/** Unknown top-level statements, preserved verbatim for extensions. */
	extensions: DocStatement[];
}

export interface StorytellerCharacter {
	name: string;
	player?: string;
	chronicle?: string;
	concept: Concept;
	splat: Splat;
	priorities: Priorities;
	attributes: Attributes;
	abilities: AbilityRating[];
	advantages: TraitRating[];
	virtues: Virtues;
	willpower: TrackedTrait;
	path: Path;
	pools: Pool[];
	health: HealthTrack;
	experience: Experience;
	meritsFlaws: MeritFlaw[];
	history: HistoryEntry[];
	overrides: Override[];
	notes: Record<string, string>;
}

export interface Concept {
	nature?: string;
	demeanor?: string;
	concept?: string;
}

export interface Splat {
	gameLine?: RuleRef;
	archetype?: RuleRef;
	generation?: number;
	/** Reference to the creation/advancement profile rule object to apply. */
	profile?: RuleRef;
	extras: Record<string, unknown>;
}

export type Priority = "primary" | "secondary" | "tertiary";

/** Which category got which priority during character creation. */
export interface Priorities {
	attributes: Partial<Record<string, Priority>>;
	abilities: Partial<Record<string, Priority>>;
}

/** Which budget a change was paid from. */
export type SpendPool = "freebie" | "experience" | string;

/** A single rating change recorded in the history ledger. */
export interface TraitChange {
	pool: SpendPool;
	/** The category of trait raised: attribute, ability, discipline, … */
	traitType: string;
	ref?: RuleRef;
	name?: string;
	from?: number;
	to?: number;
	/** Points recorded as spent (freebie points or experience). */
	cost?: number;
	raw?: DocStatement;
}

/**
 * One entry in the character's history: a creation snapshot, a freebie spend, a
 * session in which experience was earned, or an advancement in which it was
 * spent. This is stored play-state, not a derived value.
 */
export interface HistoryEntry {
	kind: string;
	label?: string;
	note?: string;
	xpGained?: number;
	xpSpent?: number;
	changes: TraitChange[];
	raw?: DocStatement;
}

/** The nine attributes, grouped into the three classic categories. */
export interface Attributes {
	physical: AttributeGroup;
	social: AttributeGroup;
	mental: AttributeGroup;
}

export interface AttributeGroup {
	[trait: string]: number;
}

export type AbilityCategory = "talent" | "skill" | "knowledge" | string;

/** An ability (Talent/Skill/Knowledge) referenced and rated in dots. */
export interface AbilityRating {
	category: AbilityCategory;
	ref?: RuleRef;
	name?: string;
	rating: number;
	specialty?: string;
	raw?: DocStatement;
}

/** A rated advantage: a Discipline, Background, Sphere, Gift, etc. */
export interface TraitRating {
	kind: string;
	ref?: RuleRef;
	name?: string;
	rating: number;
	raw?: DocStatement;
}

export interface Virtues {
	conscience: number;
	selfControl: number;
	courage: number;
}

/** A trait with a permanent rating and a current (spent-down) value. */
export interface TrackedTrait {
	rating: number;
	current: number;
}

/** A morality track such as Humanity or a Path of Enlightenment. */
export interface Path {
	name: string;
	rating: number;
}

/** A resource pool such as Blood, Gnosis, Quintessence, or Glamour. */
export interface Pool {
	name: string;
	max: number;
	current: number;
}

/**
 * Storyteller health is a track of seven levels taking three damage types.
 * We store the current amount of each type; computing penalties is a later
 * (rules-engine) concern.
 */
export interface HealthTrack {
	bashing: number;
	lethal: number;
	aggravated: number;
}

export interface Experience {
	total: number;
	unspent: number;
}

/** A Merit or Flaw, referenced with its point value. */
export interface MeritFlaw {
	kind: "merit" | "flaw" | string;
	ref?: RuleRef;
	name?: string;
	value: number;
	raw?: DocStatement;
}

export const AttributeNames = {
	physical: ["Strength", "Dexterity", "Stamina"],
	social: ["Charisma", "Manipulation", "Appearance"],
	mental: ["Perception", "Intelligence", "Wits"],
} as const;

export type AttributeCategory = "physical" | "social" | "mental";
export type AbilityCategoryGroup = "talents" | "skills" | "knowledges";

/** Maps an attribute name (any case) to its category, or `undefined`. */
export function AttributeGroupOf(attribute: string): AttributeCategory | undefined {
	const _lower = attribute.toLowerCase();
	for (const _group of ["physical", "social", "mental"] as const) {
		if (AttributeNames[_group].some((a) => a.toLowerCase() === _lower)) {
			return _group;
		}
	}
	return undefined;
}

/** Maps an ability category (`talent`/`skill`/`knowledge`, any case) to its group. */
export function AbilityGroupOf(category: string): AbilityCategoryGroup | undefined {
	switch (category.toLowerCase()) {
		case "talent":
		case "talents":
			return "talents";
		case "skill":
		case "skills":
			return "skills";
		case "knowledge":
		case "knowledges":
			return "knowledges";
		default:
			return undefined;
	}
}
