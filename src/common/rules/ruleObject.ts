import type { RuleRef } from "./ruleRef.ts";

/**
 * A single effect a rule applies. Intentionally generic so a future rules
 * engine can define and interpret its own effect kinds without changes here.
 */
export interface RuleEffect {
	kind: string;
	target?: string;
	value?: unknown;
	condition?: unknown;
}

/** A choice a rule offers (for example "pick two skills from this list"). */
export interface RuleChoiceDefinition {
	id: string;
	kind: string;
	count?: number;
	options?: RuleRef[];
	data?: unknown;
}

/** A prerequisite a rule imposes (for example a minimum ability score). */
export interface RulePrerequisite {
	kind: string;
	data?: unknown;
}

/**
 * A source-independent rule object. `data` is deliberately `unknown`: it is the
 * boundary where external rule content enters the system and must be validated
 * by whoever consumes it. The reference/type envelope keeps it routable.
 */
export interface RuleObject {
	ref: RuleRef;
	name: string;
	type: string;
	source: string;
	version?: string;
	tags?: string[];
	data: unknown;
	effects?: RuleEffect[];
	choices?: RuleChoiceDefinition[];
	prerequisites?: RulePrerequisite[];
}
