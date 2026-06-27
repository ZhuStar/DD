// Public API for the classic Storyteller System (STC).
export { ParseStc, StcFormat } from "./parse.ts";
export { NormalizeStc } from "./normalize.ts";
export { ValidateStcDocument, ValidateStorytellerRules } from "./validate.ts";
export { CollectCharacterRefs } from "./collectRefs.ts";
export { ResolveStorytellerCharacter } from "./resolveCharacter.ts";
export type { ResolvedStorytellerDocument } from "./resolveCharacter.ts";

// Rules / derivation engine (reads creation profiles from rule data).
export { ParseCreationProfile } from "./rules.ts";
export type {
	CreationProfile,
	GenerationStats,
	PointAllotment,
	FreebieRules,
	ExperienceCostRule,
	ParsedProfile,
} from "./rules.ts";
export {
	DeriveStoryteller,
	GenerationStatsFor,
	BudgetFor,
	ProfileFromResolved,
} from "./derive.ts";
export type {
	DerivedStoryteller,
	AttributeNumbers,
	AbilityNumbers,
} from "./derive.ts";
export {
	ExperienceCost,
	FreebieCost,
	ReplayHistory,
	EvaluateStoryteller,
} from "./advancement.ts";
export type {
	LedgerState,
	LedgerStep,
	ReplayResult,
	StorytellerEvaluation,
} from "./advancement.ts";

export type {
	StorytellerDocument,
	StorytellerCharacter,
	Concept,
	Splat,
	Priority,
	Priorities,
	SpendPool,
	TraitChange,
	HistoryEntry,
	Attributes,
	AttributeGroup,
	AttributeCategory,
	AbilityCategoryGroup,
	AbilityCategory,
	AbilityRating,
	TraitRating,
	Virtues,
	TrackedTrait,
	Path,
	Pool,
	HealthTrack,
	Experience,
	MeritFlaw,
} from "./model.ts";
export { AttributeNames, AttributeGroupOf, AbilityGroupOf } from "./model.ts";
