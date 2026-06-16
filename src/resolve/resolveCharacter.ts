import type { CharacterDocument } from "../character/model.ts";
import type { RuleObject } from "../rules/ruleObject.ts";
import { RuleRefKey } from "../rules/ruleRef.ts";
import type { RuleRegistry } from "../rules/ruleRegistry.ts";
import { CollectRuleRefs } from "../rules/ruleResolver.ts";
import type {
	ResolveDiagnostic,
	ResolvedCharacterDocument,
} from "./resolvedCharacter.ts";

/**
 * Resolves every rule reference used by a normalized character through the
 * registry. Missing references and missing namespaces become diagnostics; this
 * function does not throw for ordinary resolution failures. It throws only for
 * programmer error (a missing registry).
 */
export async function ResolveCharacter(
	document: CharacterDocument,
	registry: RuleRegistry
): Promise<ResolvedCharacterDocument> {
	if (registry === undefined || registry === null) {
		throw new TypeError("ResolveCharacter requires a RuleRegistry.");
	}

	const _collected = CollectRuleRefs(document);
	const _byKey = new Map<string, RuleObject>();
	const _diagnostics: ResolveDiagnostic[] = [];
	const _seen = new Set<string>();

	for (const { ref, usage } of _collected) {
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

	return {
		document,
		rules: { byKey: _byKey },
		diagnostics: _diagnostics,
	};
}
