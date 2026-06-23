import type { RuleRegistry } from "../common/rules/ruleRegistry.ts";
import type { ResolvedDocument } from "../common/resolve/resolved.ts";
import { ResolveReferences } from "../common/resolve/resolveReferences.ts";
import type { StorytellerDocument } from "./model.ts";
import { CollectCharacterRefs } from "./collectRefs.ts";

export type ResolvedStorytellerDocument = ResolvedDocument<StorytellerDocument>;

/**
 * Resolves every rule reference used by a normalized Storyteller character
 * through the registry, reusing the shared `ResolveReferences` engine. Missing
 * references become diagnostics, never exceptions.
 */
export async function ResolveStorytellerCharacter(
	document: StorytellerDocument,
	registry: RuleRegistry
): Promise<ResolvedStorytellerDocument> {
	const _refs = CollectCharacterRefs(document);
	const { rules, diagnostics } = await ResolveReferences(_refs, registry);
	return { document, rules, diagnostics };
}
