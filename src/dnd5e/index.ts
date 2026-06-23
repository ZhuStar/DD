// Public API for the D&D 5e (D5C) system.
export { ParseD5c, D5cFormat } from "./parse.ts";
export { NormalizeD5c } from "./normalize.ts";
export { ValidateD5cDocument, ValidateCharacterRules } from "./validate.ts";
export { CollectCharacterRefs } from "./collectRefs.ts";
export { ResolveCharacter } from "./resolveCharacter.ts";
export type { ResolvedCharacterDocument } from "./resolveCharacter.ts";

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
} from "./model.ts";
export { AbilityNames } from "./model.ts";
