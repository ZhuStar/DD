import type { RuleRegistry } from "../common/rules/ruleRegistry.ts";
import type { ResolvedDocument } from "../common/resolve/resolved.ts";
import { ResolveReferences } from "../common/resolve/resolveReferences.ts";
import type { CharacterDocument } from "./model.ts";
import { CollectCharacterRefs } from "./collectRefs.ts";

export type ResolvedCharacterDocument = ResolvedDocument<CharacterDocument>;

/**
 * Resolves every rule reference used by a normalized D&D character through the
 * registry. Reference collection is D&D-specific; the resolution engine is the
 * shared `ResolveReferences`. Missing references become diagnostics, never
 * exceptions.
 */
export async function ResolveCharacter(
	document: CharacterDocument,
	registry: RuleRegistry
): Promise<ResolvedCharacterDocument> {
	const _refs = CollectCharacterRefs(document);
	const { rules, diagnostics } = await ResolveReferences(_refs, registry);
	return { document, rules, diagnostics };
}
