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
	extras: Record<string, unknown>;
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
