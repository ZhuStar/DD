import type { RuleObject } from "./ruleObject.ts";
import type { RuleRef } from "./ruleRef.ts";
import { RuleRefKey } from "./ruleRef.ts";
import type { RuleQuery, RuleSource } from "./ruleSource.ts";

/**
 * An in-memory `RuleSource` for tests, examples, and generated content. It owns
 * exactly one namespace and rejects rule objects that belong to another.
 */
export class InMemoryRuleSource implements RuleSource {
	public readonly id: string;

	private readonly _rules = new Map<string, RuleObject>();

	public constructor(id: string, rules: RuleObject[] = []) {
		this.id = id;

		for (const _rule of rules) {
			this.Add(_rule);
		}
	}

	public Add(rule: RuleObject): void {
		if (rule.ref.source !== this.id) {
			throw new Error(
				`Rule source mismatch. Expected ${this.id}, got ${rule.ref.source}.`
			);
		}

		this._rules.set(RuleRefKey(rule.ref), rule);
	}

	public async Has(ref: RuleRef): Promise<boolean> {
		return this._rules.has(RuleRefKey(ref));
	}

	public async Get(ref: RuleRef): Promise<RuleObject | undefined> {
		return this._rules.get(RuleRefKey(ref));
	}

	public async *List(query?: RuleQuery): AsyncIterable<RuleObject> {
		for (const _rule of this._rules.values()) {
			if (!_matchesQuery(_rule, query)) {
				continue;
			}
			yield _rule;
		}
	}
}

function _matchesQuery(rule: RuleObject, query?: RuleQuery): boolean {
	if (query === undefined) {
		return true;
	}

	if (query.source !== undefined && rule.source !== query.source) {
		return false;
	}

	if (query.type !== undefined && rule.type !== query.type) {
		return false;
	}

	if (query.tags !== undefined && query.tags.length > 0) {
		const _tags = rule.tags ?? [];
		for (const _tag of query.tags) {
			if (!_tags.includes(_tag)) {
				return false;
			}
		}
	}

	if (query.text !== undefined && query.text !== "") {
		if (!rule.name.toLowerCase().includes(query.text.toLowerCase())) {
			return false;
		}
	}

	return true;
}
