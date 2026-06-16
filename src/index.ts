// High-level pipeline: D5C text -> AST -> character model -> resolved graph.
export { ParseD5c, Parser } from "./d5c/parser.ts";
export { NormalizeD5c } from "./character/normalize.ts";
export { ResolveCharacter } from "./resolve/resolveCharacter.ts";

// Lower-level lexer/parser for tests and advanced users.
export { Lexer, Tokenize } from "./d5c/lexer.ts";
export type { Token } from "./d5c/lexer.ts";

// Diagnostics and errors.
export {
	D5cParseError,
	MakeDiagnostic,
	FormatLocation,
} from "./d5c/errors.ts";
export type {
	SourceLocation,
	D5cDiagnostic,
	DiagnosticSeverity,
} from "./d5c/errors.ts";

// AST types.
export type {
	D5cDocument,
	D5cCharacterNode,
	D5cStatement,
	D5cFieldStatement,
	D5cBlockStatement,
	D5cListItemStatement,
	D5cValue,
	D5cStringValue,
	D5cNumberValue,
	D5cBooleanValue,
	D5cNoneValue,
	D5cIdentifierValue,
	D5cRefValue,
	D5cDiceValue,
} from "./d5c/ast.ts";

// Character model + validation.
export type {
	CharacterDocument,
	Character,
	CharacterOrigin,
	CharacterLevel,
	AbilityScores,
	AbilityName,
	CharacterChoice,
	CharacterSpells,
	Inventory,
	InventoryItem,
	Currency,
	CharacterState,
	UsedResource,
	ResourceState,
	CharacterOverride,
} from "./character/model.ts";
export { AbilityNames } from "./character/model.ts";
export { ValidateD5cDocument, ValidateCharacterRules } from "./character/validate.ts";

// Rules API.
export type { RuleRef } from "./rules/ruleRef.ts";
export {
	RuleRefKey,
	FormatRuleRef,
	RuleRefEquals,
	ParseRuleRef,
	TryParseRuleRef,
	RuleRefPattern,
	RuleRefBodyPattern,
} from "./rules/ruleRef.ts";
export type {
	RuleObject,
	RuleEffect,
	RuleChoiceDefinition,
	RulePrerequisite,
} from "./rules/ruleObject.ts";
export type { RuleSource, RuleQuery } from "./rules/ruleSource.ts";
export { RuleRegistry } from "./rules/ruleRegistry.ts";
export { InMemoryRuleSource } from "./rules/inMemoryRuleSource.ts";
export { CollectRuleRefs } from "./rules/ruleResolver.ts";
export type { CollectedRef } from "./rules/ruleResolver.ts";

// Resolved graph.
export type {
	ResolvedCharacterDocument,
	ResolvedRuleMap,
	ResolveDiagnostic,
} from "./resolve/resolvedCharacter.ts";
