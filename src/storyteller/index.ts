// Public API for the classic Storyteller System (STC).
export { ParseStc, StcFormat } from "./parse.ts";
export { NormalizeStc } from "./normalize.ts";
export { ValidateStcDocument, ValidateStorytellerRules } from "./validate.ts";
export { CollectCharacterRefs } from "./collectRefs.ts";
export { ResolveStorytellerCharacter } from "./resolveCharacter.ts";
export type { ResolvedStorytellerDocument } from "./resolveCharacter.ts";

export type {
	StorytellerDocument,
	StorytellerCharacter,
	Concept,
	Splat,
	Attributes,
	AttributeGroup,
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
export { AttributeNames } from "./model.ts";
