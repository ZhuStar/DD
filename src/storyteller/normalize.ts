import type {
	DocBlockStatement,
	DocDocument,
	DocFieldStatement,
	DocStatement,
} from "../common/text/ast.ts";
import {
	AsNumber,
	AsRef,
	AsString,
	AssignOptional,
	FirstValue,
	ValueToPrimitive,
} from "../common/text/values.ts";
import { NormalizeNotes, NormalizeOverrides } from "../common/character.ts";
import type {
	AbilityRating,
	Attributes,
	Concept,
	Experience,
	HealthTrack,
	MeritFlaw,
	Path,
	Pool,
	Splat,
	StorytellerCharacter,
	StorytellerDocument,
	TrackedTrait,
	TraitRating,
	Virtues,
} from "./model.ts";

const _gameLineNames = new Set(["Gameline", "Game-line", "GameLine"]);

/**
 * Normalizes a raw STC AST into a typed Storyteller character model. Like the
 * D&D normalizer, it is lenient (shape validation lives in `ValidateStcDocument`)
 * and preserves unknown top-level statements in `extensions`.
 */
export function NormalizeStc(document: DocDocument): StorytellerDocument {
	const _character: StorytellerCharacter = {
		name: document.root.name,
		concept: {},
		splat: { extras: {} },
		attributes: { physical: {}, social: {}, mental: {} },
		abilities: [],
		advantages: [],
		virtues: { conscience: 0, selfControl: 0, courage: 0 },
		willpower: { rating: 0, current: 0 },
		path: { name: "", rating: 0 },
		pools: [],
		health: { bashing: 0, lethal: 0, aggravated: 0 },
		experience: { total: 0, unspent: 0 },
		meritsFlaws: [],
		overrides: [],
		notes: {},
	};

	let _game = "";
	const _extensions: DocStatement[] = [];

	for (const _stmt of document.root.body) {
		if (_stmt.kind === "field") {
			switch (_stmt.name) {
				case "Game":
					_game = AsString(FirstValue(_stmt)) ?? _identifier(_stmt) ?? "";
					break;
				case "Player":
					AssignOptional(_character, "player", AsString(FirstValue(_stmt)));
					break;
				case "Chronicle":
					AssignOptional(_character, "chronicle", AsString(FirstValue(_stmt)));
					break;
				default:
					_extensions.push(_stmt);
			}
			continue;
		}

		if (_stmt.kind === "block") {
			switch (_stmt.name) {
				case "Concept":
					_character.concept = _normalizeConcept(_stmt);
					break;
				case "Splat":
					_character.splat = _normalizeSplat(_stmt);
					break;
				case "Attributes":
					_character.attributes = _normalizeAttributes(_stmt);
					break;
				case "Abilities":
					_character.abilities = _normalizeAbilities(_stmt);
					break;
				case "Advantages":
					_character.advantages = _normalizeAdvantages(_stmt);
					break;
				case "Virtues":
					_character.virtues = _normalizeVirtues(_stmt);
					break;
				case "Willpower":
					_character.willpower = _normalizeTracked(_stmt);
					break;
				case "Path":
					_character.path = _normalizePath(_stmt);
					break;
				case "Pools":
					_character.pools = _normalizePools(_stmt);
					break;
				case "Health":
					_character.health = _normalizeHealth(_stmt);
					break;
				case "Experience":
					_character.experience = _normalizeExperience(_stmt);
					break;
				case "MeritsFlaws":
					_character.meritsFlaws = _normalizeMeritsFlaws(_stmt);
					break;
				case "Overrides":
					_character.overrides = NormalizeOverrides(_stmt);
					break;
				case "Notes":
					_character.notes = NormalizeNotes(_stmt);
					break;
				default:
					_extensions.push(_stmt);
			}
			continue;
		}

		_extensions.push(_stmt);
	}

	return {
		format: "STC",
		formatVersion: document.version,
		game: _game,
		character: _character,
		extensions: _extensions,
	};
}

function _normalizeConcept(block: DocBlockStatement): Concept {
	const _concept: Concept = {};
	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _value = AsString(FirstValue(_stmt));
		switch (_stmt.name) {
			case "Nature":
				AssignOptional(_concept, "nature", _value);
				break;
			case "Demeanor":
				AssignOptional(_concept, "demeanor", _value);
				break;
			case "Concept":
				AssignOptional(_concept, "concept", _value);
				break;
		}
	}
	return _concept;
}

function _normalizeSplat(block: DocBlockStatement): Splat {
	const _splat: Splat = { extras: {} };

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _value = FirstValue(_stmt);

		if (_gameLineNames.has(_stmt.name)) {
			AssignOptional(_splat, "gameLine", AsRef(_value));
			continue;
		}
		if (_stmt.name === "Generation") {
			AssignOptional(_splat, "generation", AsNumber(_value));
			continue;
		}

		// Any other line-specific defining trait (Clan, Tribe, Tradition, …).
		// The first one that is a reference becomes the primary archetype.
		_splat.extras[_stmt.name.toLowerCase()] =
			_value === undefined ? undefined : ValueToPrimitive(_value);
		if (_splat.archetype === undefined) {
			AssignOptional(_splat, "archetype", AsRef(_value));
		}
	}

	return _splat;
}

function _normalizeAttributes(block: DocBlockStatement): Attributes {
	const _attributes: Attributes = { physical: {}, social: {}, mental: {} };

	for (const _stmt of block.body) {
		if (_stmt.kind !== "block") {
			continue;
		}
		let _group: Record<string, number> | undefined;
		if (_stmt.name === "Physical") {
			_group = _attributes.physical;
		} else if (_stmt.name === "Social") {
			_group = _attributes.social;
		} else if (_stmt.name === "Mental") {
			_group = _attributes.mental;
		}
		if (_group === undefined) {
			continue;
		}
		for (const _trait of _stmt.body) {
			if (_trait.kind !== "field") {
				continue;
			}
			const _rating = AsNumber(FirstValue(_trait));
			if (_rating !== undefined) {
				_group[_trait.name.toLowerCase()] = _rating;
			}
		}
	}

	return _attributes;
}

function _normalizeAbilities(block: DocBlockStatement): AbilityRating[] {
	const _abilities: AbilityRating[] = [];

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _entry: AbilityRating = {
			category: _stmt.name.toLowerCase(),
			rating: _ratingOf(_stmt),
			raw: _stmt,
		};
		AssignOptional(_entry, "ref", _refOf(_stmt));
		AssignOptional(_entry, "name", _nameOf(_stmt));
		AssignOptional(_entry, "specialty", _specialtyOf(_stmt));
		_abilities.push(_entry);
	}

	return _abilities;
}

function _normalizeAdvantages(block: DocBlockStatement): TraitRating[] {
	const _advantages: TraitRating[] = [];

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _entry: TraitRating = {
			kind: _stmt.name.toLowerCase(),
			rating: _ratingOf(_stmt),
			raw: _stmt,
		};
		AssignOptional(_entry, "ref", _refOf(_stmt));
		AssignOptional(_entry, "name", _nameOf(_stmt));
		_advantages.push(_entry);
	}

	return _advantages;
}

function _normalizeVirtues(block: DocBlockStatement): Virtues {
	const _virtues: Virtues = { conscience: 0, selfControl: 0, courage: 0 };
	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _value = AsNumber(FirstValue(_stmt)) ?? 0;
		switch (_stmt.name) {
			case "Conscience":
			case "Conviction":
				_virtues.conscience = _value;
				break;
			case "SelfControl":
			case "Instinct":
				_virtues.selfControl = _value;
				break;
			case "Courage":
				_virtues.courage = _value;
				break;
		}
	}
	return _virtues;
}

function _normalizeTracked(block: DocBlockStatement): TrackedTrait {
	const _rating = AsNumber(_fieldValue(block, "Rating")) ?? 0;
	const _current = AsNumber(_fieldValue(block, "Current")) ?? _rating;
	return { rating: _rating, current: _current };
}

function _normalizePath(block: DocBlockStatement): Path {
	return {
		name: AsString(_fieldValue(block, "Name")) ?? "Humanity",
		rating: AsNumber(_fieldValue(block, "Rating")) ?? 0,
	};
}

function _normalizePools(block: DocBlockStatement): Pool[] {
	const _pools: Pool[] = [];
	for (const _stmt of block.body) {
		if (_stmt.kind !== "block") {
			continue;
		}
		_pools.push({
			name: _stmt.name,
			max: AsNumber(_fieldValue(_stmt, "Max")) ?? 0,
			current: AsNumber(_fieldValue(_stmt, "Current")) ?? 0,
		});
	}
	return _pools;
}

function _normalizeHealth(block: DocBlockStatement): HealthTrack {
	return {
		bashing: AsNumber(_fieldValue(block, "Bashing")) ?? 0,
		lethal: AsNumber(_fieldValue(block, "Lethal")) ?? 0,
		aggravated: AsNumber(_fieldValue(block, "Aggravated")) ?? 0,
	};
}

function _normalizeExperience(block: DocBlockStatement): Experience {
	return {
		total: AsNumber(_fieldValue(block, "Total")) ?? 0,
		unspent: AsNumber(_fieldValue(block, "Unspent")) ?? 0,
	};
}

function _normalizeMeritsFlaws(block: DocBlockStatement): MeritFlaw[] {
	const _entries: MeritFlaw[] = [];
	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _entry: MeritFlaw = {
			kind: _stmt.name.toLowerCase(),
			value: _ratingOf(_stmt),
			raw: _stmt,
		};
		AssignOptional(_entry, "ref", _refOf(_stmt));
		AssignOptional(_entry, "name", _nameOf(_stmt));
		_entries.push(_entry);
	}
	return _entries;
}

// --- field-shape helpers for `Kind <ref|name> <rating> [specialty "x"]` ---

function _refOf(field: DocFieldStatement): ReturnType<typeof AsRef> {
	for (const _value of field.values) {
		if (_value.kind === "ref") {
			return _value.ref;
		}
	}
	return undefined;
}

function _nameOf(field: DocFieldStatement): string | undefined {
	// A leading string name is used only when no reference is present.
	if (_refOf(field) !== undefined) {
		return undefined;
	}
	for (const _value of field.values) {
		if (_value.kind === "string") {
			return _value.value;
		}
	}
	return undefined;
}

function _ratingOf(field: DocFieldStatement): number {
	for (const _value of field.values) {
		if (_value.kind === "number") {
			return _value.value;
		}
	}
	return 0;
}

function _specialtyOf(field: DocFieldStatement): string | undefined {
	for (let _i = 0; _i < field.values.length; _i += 1) {
		const _value = field.values[_i]!;
		if (_value.kind === "identifier" && _value.name === "specialty") {
			return AsString(field.values[_i + 1]);
		}
	}
	return undefined;
}

function _fieldValue(block: DocBlockStatement, name: string) {
	for (const _stmt of block.body) {
		if (_stmt.kind === "field" && _stmt.name === name) {
			return FirstValue(_stmt);
		}
	}
	return undefined;
}

function _identifier(field: DocFieldStatement): string | undefined {
	const _value = FirstValue(field);
	return _value !== undefined && _value.kind === "identifier" ? _value.name : undefined;
}
