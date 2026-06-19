import type { SourceLocation } from "../text/errors.ts";
import type { RuleObject } from "../rules/ruleObject.ts";
import type { RuleRef } from "../rules/ruleRef.ts";

export interface ResolveDiagnostic {
	severity: "error" | "warning";
	code: string;
	message: string;
	ref?: RuleRef;
	location?: SourceLocation;
}

export interface ResolvedRuleMap {
	/** Resolved rule objects keyed by `RuleRefKey`. */
	byKey: Map<string, RuleObject>;
}

/**
 * The output of resolving a normalized model: the original document, the
 * resolved rule objects, and any diagnostics. Generic over the model type so
 * each system can resolve its own character shape.
 */
export interface ResolvedDocument<TModel> {
	document: TModel;
	rules: ResolvedRuleMap;
	diagnostics: ResolveDiagnostic[];
}

/** A reference collected from a model, tagged with where it was used. */
export interface CollectedRef {
	ref: RuleRef;
	usage: string;
}
