import type { RuleRef } from "../common/rules/ruleRef.ts";
import type { CollectedRef } from "../common/resolve/resolved.ts";
import type { StorytellerDocument } from "./model.ts";

/**
 * Walks a normalized Storyteller character and collects every `RuleRef` it
 * uses, tagged with a usage label. Pure traversal: no resolution, no
 * `RuleSource` access.
 */
export function CollectCharacterRefs(document: StorytellerDocument): CollectedRef[] {
	const _refs: CollectedRef[] = [];
	const _character = document.character;

	_pushOptional(_refs, _character.splat.gameLine, "splat.gameLine");
	_pushOptional(_refs, _character.splat.archetype, "splat.archetype");
	for (const [_key, _value] of Object.entries(_character.splat.extras)) {
		if (_isRuleRef(_value)) {
			_refs.push({ ref: _value, usage: `splat.${_key}` });
		}
	}

	for (const _ability of _character.abilities) {
		_pushOptional(_refs, _ability.ref, `ability.${_ability.category}`);
	}

	for (const _advantage of _character.advantages) {
		_pushOptional(_refs, _advantage.ref, `advantage.${_advantage.kind}`);
	}

	for (const _mf of _character.meritsFlaws) {
		_pushOptional(_refs, _mf.ref, `meritFlaw.${_mf.kind}`);
	}

	return _refs;
}

function _pushOptional(target: CollectedRef[], ref: RuleRef | undefined, usage: string): void {
	if (ref !== undefined) {
		target.push({ ref, usage });
	}
}

function _isRuleRef(value: unknown): value is RuleRef {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as RuleRef).source === "string" &&
		typeof (value as RuleRef).type === "string" &&
		typeof (value as RuleRef).id === "string"
	);
}
