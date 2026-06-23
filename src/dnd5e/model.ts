import type { DocBlockStatement, DocStatement } from "../common/text/ast.ts";
import type { RuleRef } from "../common/rules/ruleRef.ts";
import type { Override } from "../common/character.ts";

export interface CharacterDocument {
	format: "D5C";
	formatVersion: number;
	game: string;
	character: Character;
	/** Unknown top-level statements, preserved verbatim for extensions. */
	extensions: DocStatement[];
}

export interface Character {
	name: string;
	player?: string;
	xp?: number;
	inspiration: boolean;
	origin: CharacterOrigin;
	levels: CharacterLevel[];
	abilities: AbilityScores;
	choices: CharacterChoice[];
	spells: CharacterSpells;
	inventory: Inventory;
	state: CharacterState;
	overrides: CharacterOverride[];
	notes: Record<string, string>;
}

export interface CharacterOrigin {
	species?: RuleRef;
	subspecies?: RuleRef;
	background?: RuleRef;
	alignment?: string;
}

export interface CharacterLevel {
	level: number;
	classRef: RuleRef;
	subclassRef?: RuleRef;
	hitPoints?: number;
	choices: CharacterChoice[];
}

export interface AbilityScores {
	strength: number;
	dexterity: number;
	constitution: number;
	intelligence: number;
	wisdom: number;
	charisma: number;
}

export interface CharacterChoice {
	kind: string;
	ref?: RuleRef;
	source?: string;
	value?: unknown;
	raw?: DocStatement;
}

export interface CharacterSpells {
	spellbook: RuleRef[];
	prepared: RuleRef[];
	known: RuleRef[];
}

export interface Inventory {
	items: InventoryItem[];
	currency: Currency;
}

export interface InventoryItem {
	name: string;
	ref?: RuleRef;
	quantity: number;
	equipped: boolean;
	charges?: ResourceState;
	notes?: string;
	raw?: DocBlockStatement;
}

export interface Currency {
	cp: number;
	sp: number;
	ep: number;
	gp: number;
	pp: number;
}

export interface CharacterState {
	currentHp?: number;
	temporaryHp: number;
	deathSaveSuccesses: number;
	deathSaveFailures: number;
	usedResources: UsedResource[];
	conditions: RuleRef[];
}

export interface UsedResource {
	kind: string;
	key: string;
	amount: number;
	raw?: DocStatement;
}

export interface ResourceState {
	current: number;
	max?: number;
}

/** D&D's override type is the shared `Override` from common. */
export type CharacterOverride = Override;

export const AbilityNames = [
	"strength",
	"dexterity",
	"constitution",
	"intelligence",
	"wisdom",
	"charisma",
] as const;

export type AbilityName = (typeof AbilityNames)[number];
