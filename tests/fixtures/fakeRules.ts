import { InMemoryRuleSource } from "../../src/rules/inMemoryRuleSource.ts";
import type { RuleObject } from "../../src/rules/ruleObject.ts";
import type { RuleRef } from "../../src/rules/ruleRef.ts";

/**
 * Builds a fake rule object for a reference. Uses only placeholder mechanical
 * data (no official rule text) so fixtures stay free of copyrighted content.
 */
export function FakeRule(ref: RuleRef): RuleObject {
	return {
		ref,
		source: ref.source,
		type: ref.type,
		name: _toTitle(ref.id),
		tags: [ref.type],
		data: ref.type === "class" ? { hitDie: "d6" } : {},
	};
}

/** Builds an in-memory source covering exactly the given refs for one namespace. */
export function BuildFakeSource(refs: RuleRef[], id = "srd2014"): InMemoryRuleSource {
	const _source = new InMemoryRuleSource(id);
	for (const _ref of refs) {
		if (_ref.source === id) {
			_source.Add(FakeRule(_ref));
		}
	}
	return _source;
}

function _toTitle(id: string): string {
	return id
		.split(/[-/]/)
		.filter((part) => part.length > 0)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}
