import type { CharacterDocument } from "../character/model.ts";
import type { RuleRef } from "./ruleRef.ts";

export interface CollectedRef {
	ref: RuleRef;
	/** Where in the character the reference was used (best effort). */
	usage: string;
}

/**
 * Walks a normalized character and collects every `RuleRef` it uses, tagged
 * with a short usage label for diagnostics. This is pure traversal: it performs
 * no resolution and touches no `RuleSource`.
 */
export function CollectRuleRefs(document: CharacterDocument): CollectedRef[] {
	const _refs: CollectedRef[] = [];
	const _character = document.character;

	_pushOptional(_refs, _character.origin.species, "origin.species");
	_pushOptional(_refs, _character.origin.subspecies, "origin.subspecies");
	_pushOptional(_refs, _character.origin.background, "origin.background");

	for (const _level of _character.levels) {
		if (_level.classRef.source !== "") {
			_refs.push({ ref: _level.classRef, usage: `levels[${_level.level}].class` });
		}
		_pushOptional(_refs, _level.subclassRef, `levels[${_level.level}].subclass`);
	}

	for (const _choice of _character.choices) {
		_pushOptional(_refs, _choice.ref, `choice.${_choice.kind}`);
	}

	for (const _ref of _character.spells.spellbook) {
		_refs.push({ ref: _ref, usage: "spells.spellbook" });
	}
	for (const _ref of _character.spells.prepared) {
		_refs.push({ ref: _ref, usage: "spells.prepared" });
	}
	for (const _ref of _character.spells.known) {
		_refs.push({ ref: _ref, usage: "spells.known" });
	}

	for (const _item of _character.inventory.items) {
		_pushOptional(_refs, _item.ref, `inventory.${_item.name}`);
	}

	for (const _ref of _character.state.conditions) {
		_refs.push({ ref: _ref, usage: "state.conditions" });
	}

	return _refs;
}

function _pushOptional(target: CollectedRef[], ref: RuleRef | undefined, usage: string): void {
	if (ref !== undefined) {
		target.push({ ref, usage });
	}
}
