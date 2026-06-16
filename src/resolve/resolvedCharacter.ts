import type { SourceLocation } from "../d5c/errors.ts";
import type { CharacterDocument } from "../character/model.ts";
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

export interface ResolvedCharacterDocument {
	document: CharacterDocument;
	rules: ResolvedRuleMap;
	diagnostics: ResolveDiagnostic[];
}
