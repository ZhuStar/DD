import type { RuleObject } from "../rules/ruleObject.ts";
import { RuleRefKey } from "../rules/ruleRef.ts";
import type { RuleRegistry } from "../rules/ruleRegistry.ts";
import type { CollectedRef, ResolveDiagnostic, ResolvedRuleMap } from "./resolved.ts";

export interface ReferenceResolution {
	rules: ResolvedRuleMap;
	diagnostics: ResolveDiagnostic[];
}

/**
 * Resolves a list of collected references through the registry. This is the
 * game-agnostic core of resolution: each system collects its own references
 * from its own model, then hands them here.
 *
 * Missing namespaces and missing rules become diagnostics; this never throws
 * for ordinary resolution failures. It throws only for programmer error.
 */
export async function ResolveReferences(
	refs: CollectedRef[],
	registry: RuleRegistry
): Promise<ReferenceResolution> {
	if (registry === undefined || registry === null) {
		throw new TypeError("ResolveReferences requires a RuleRegistry.");
	}

	const _byKey = new Map<string, RuleObject>();
	const _diagnostics: ResolveDiagnostic[] = [];
	const _seen = new Set<string>();

	for (const { ref, usage } of refs) {
		const _key = RuleRefKey(ref);
		if (_seen.has(_key)) {
			continue;
		}
		_seen.add(_key);

		if (!registry.HasSource(ref.source)) {
			_diagnostics.push({
				severity: "error",
				code: "resolve/unknown-source",
				message: `No rule source registered for namespace "${ref.source}" (used by ${usage}).`,
				ref,
			});
			continue;
		}

		const _object = await registry.Get(ref);
		if (_object === undefined) {
			_diagnostics.push({
				severity: "error",
				code: "resolve/missing-rule",
				message: `Rule not found: ${_key} (used by ${usage}).`,
				ref,
			});
			continue;
		}

		_byKey.set(_key, _object);
	}

	return { rules: { byKey: _byKey }, diagnostics: _diagnostics };
}
