import type { RuleObject } from "./ruleObject.ts";
import type { RuleRef } from "./ruleRef.ts";

export interface RuleQuery {
	source?: string;
	type?: string;
	tags?: string[];
	text?: string;
}

/**
 * A source of rule objects for a single logical namespace.
 *
 * Contract:
 *  - `id` is the logical namespace this source owns (e.g. `srd2014`).
 *  - `Get` returns `undefined` when the source owns the namespace but lacks the
 *    requested object.
 *  - A source must not return objects for another namespace unless it is
 *    explicitly designed as an aggregate source.
 *  - Only resolver code uses a `RuleSource`. The character parser must not.
 */
export interface RuleSource {
	readonly id: string;

	Has(ref: RuleRef): Promise<boolean>;

	Get(ref: RuleRef): Promise<RuleObject | undefined>;

	List?(query?: RuleQuery): AsyncIterable<RuleObject>;
}
