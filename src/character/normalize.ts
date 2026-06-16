import type {
	D5cBlockStatement,
	D5cDocument,
	D5cFieldStatement,
	D5cStatement,
	D5cValue,
} from "../d5c/ast.ts";
import type { RuleRef } from "../rules/ruleRef.ts";
import { RuleRefKey } from "../rules/ruleRef.ts";
import type {
	AbilityName,
	AbilityScores,
	Character,
	CharacterChoice,
	CharacterDocument,
	CharacterLevel,
	CharacterOrigin,
	CharacterOverride,
	CharacterSpells,
	CharacterState,
	Currency,
	Inventory,
	InventoryItem,
	ResourceState,
	UsedResource,
} from "./model.ts";

const _abilityKeyByName: Readonly<Record<string, AbilityName>> = {
	Strength: "strength",
	Dexterity: "dexterity",
	Constitution: "constitution",
	Intelligence: "intelligence",
	Wisdom: "wisdom",
	Charisma: "charisma",
};

const _missingClassRef: RuleRef = { source: "", type: "class", id: "" };

/**
 * Normalizes a raw D5C AST into a typed character model. Known blocks are
 * mapped into structured fields; unknown top-level statements are preserved in
 * `extensions`, and many leaf statements keep their `raw` AST node for tooling.
 *
 * This step is intentionally lenient: it does not reject malformed input.
 * Shape validation is the job of `ValidateD5cDocument`.
 */
export function NormalizeD5c(document: D5cDocument): CharacterDocument {
	const _character: Character = {
		name: document.character.name,
		inspiration: false,
		origin: {},
		levels: [],
		abilities: _defaultAbilities(),
		choices: [],
		spells: { spellbook: [], prepared: [], known: [] },
		inventory: { items: [], currency: _defaultCurrency() },
		state: {
			temporaryHp: 0,
			deathSaveSuccesses: 0,
			deathSaveFailures: 0,
			usedResources: [],
			conditions: [],
		},
		overrides: [],
		notes: {},
	};

	let _game = "";
	const _extensions: D5cStatement[] = [];

	for (const _stmt of document.character.body) {
		if (_stmt.kind === "field") {
			switch (_stmt.name) {
				case "Game":
					_game = _asString(_first(_stmt)) ?? _asIdentifier(_first(_stmt)) ?? "";
					break;
				case "Player":
					_assignOptional(_character, "player", _asString(_first(_stmt)));
					break;
				case "Xp":
					_assignOptional(_character, "xp", _asNumber(_first(_stmt)));
					break;
				case "Inspiration":
					_character.inspiration = _asBoolean(_first(_stmt)) ?? false;
					break;
				default:
					_extensions.push(_stmt);
			}
			continue;
		}

		if (_stmt.kind === "block") {
			switch (_stmt.name) {
				case "Origin":
					_character.origin = _normalizeOrigin(_stmt);
					break;
				case "Levels":
					_character.levels = _normalizeLevels(_stmt);
					break;
				case "Abilities":
					_normalizeAbilities(_stmt, _character.abilities);
					break;
				case "Choices":
					_character.choices = _normalizeChoices(_stmt.body);
					break;
				case "Spells":
					_character.spells = _normalizeSpells(_stmt);
					break;
				case "Inventory":
					_character.inventory = _normalizeInventory(_stmt);
					break;
				case "State":
					_character.state = _normalizeState(_stmt);
					break;
				case "Overrides":
					_character.overrides = _normalizeOverrides(_stmt);
					break;
				case "Notes":
					_character.notes = _normalizeNotes(_stmt);
					break;
				default:
					_extensions.push(_stmt);
			}
			continue;
		}

		_extensions.push(_stmt);
	}

	return {
		format: "D5C",
		formatVersion: document.version,
		game: _game,
		character: _character,
		extensions: _extensions,
	};
}

function _normalizeOrigin(block: D5cBlockStatement): CharacterOrigin {
	const _origin: CharacterOrigin = {};

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _value = _first(_stmt);
		switch (_stmt.name) {
			case "Species":
				_assignOptional(_origin, "species", _asRef(_value));
				break;
			case "Subspecies":
				_assignOptional(_origin, "subspecies", _asRef(_value));
				break;
			case "Background":
				_assignOptional(_origin, "background", _asRef(_value));
				break;
			case "Alignment":
				_assignOptional(_origin, "alignment", _asString(_value));
				break;
		}
	}

	return _origin;
}

function _normalizeLevels(block: D5cBlockStatement): CharacterLevel[] {
	const _levels: CharacterLevel[] = [];

	for (const _stmt of block.body) {
		if (_stmt.kind !== "block" || _stmt.name !== "Level") {
			continue;
		}

		const _level: CharacterLevel = {
			level: _asNumber(_stmt.label) ?? Number.NaN,
			classRef: _missingClassRef,
			choices: [],
		};

		for (const _inner of _stmt.body) {
			if (_inner.kind === "field") {
				const _value = _first(_inner);
				switch (_inner.name) {
					case "Class":
						_level.classRef = _asRef(_value) ?? _missingClassRef;
						break;
					case "Subclass":
						_assignOptional(_level, "subclassRef", _asRef(_value));
						break;
					case "HitPoints":
						_assignOptional(_level, "hitPoints", _asNumber(_value));
						break;
				}
			} else if (_inner.kind === "block" && _inner.name === "Choice") {
				_level.choices.push(_normalizeChoiceBlock(_inner));
			}
		}

		_levels.push(_level);
	}

	return _levels;
}

function _normalizeAbilities(block: D5cBlockStatement, abilities: AbilityScores): void {
	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _key = _abilityKeyByName[_stmt.name];
		const _value = _asNumber(_first(_stmt));
		if (_key !== undefined && _value !== undefined) {
			abilities[_key] = _value;
		}
	}
}

function _normalizeChoices(body: D5cStatement[]): CharacterChoice[] {
	const _choices: CharacterChoice[] = [];

	for (const _stmt of body) {
		if (_stmt.kind === "field") {
			_choices.push(_normalizeChoiceField(_stmt));
		} else if (_stmt.kind === "block") {
			_choices.push(_normalizeChoiceBlock(_stmt));
		}
	}

	return _choices;
}

function _normalizeChoiceField(field: D5cFieldStatement): CharacterChoice {
	const _choice: CharacterChoice = { kind: field.name.toLowerCase(), raw: field };

	for (let _i = 0; _i < field.values.length; _i += 1) {
		const _value = field.values[_i]!;
		if (_value.kind === "ref" && _choice.ref === undefined) {
			_choice.ref = _value.ref;
		}
		if (_value.kind === "identifier" && _value.name === "from") {
			const _next = field.values[_i + 1];
			const _source = _asIdentifier(_next) ?? _asString(_next);
			if (_source !== undefined) {
				_choice.source = _source;
			}
		}
	}

	return _choice;
}

function _normalizeChoiceBlock(block: D5cBlockStatement): CharacterChoice {
	const _kind = _labelToKind(block) ?? block.name.toLowerCase();
	const _value: Record<string, unknown> = {};

	for (const _stmt of block.body) {
		if (_stmt.kind === "field") {
			_value[_stmt.name.toLowerCase()] = _firstPrimitive(_stmt);
		}
	}

	return { kind: _kind, value: _value, raw: block };
}

function _normalizeSpells(block: D5cBlockStatement): CharacterSpells {
	const _spells: CharacterSpells = { spellbook: [], prepared: [], known: [] };

	for (const _stmt of block.body) {
		if (_stmt.kind !== "block") {
			continue;
		}
		switch (_stmt.name) {
			case "Spellbook":
				_spells.spellbook = _collectRefs(_stmt.body);
				break;
			case "Prepared":
				_spells.prepared = _collectRefs(_stmt.body);
				break;
			case "Known":
				_spells.known = _collectRefs(_stmt.body);
				break;
		}
	}

	return _spells;
}

function _normalizeInventory(block: D5cBlockStatement): Inventory {
	const _inventory: Inventory = { items: [], currency: _defaultCurrency() };

	for (const _stmt of block.body) {
		if (_stmt.kind !== "block") {
			continue;
		}
		if (_stmt.name === "Item") {
			_inventory.items.push(_normalizeItem(_stmt));
		} else if (_stmt.name === "Currency") {
			_inventory.currency = _normalizeCurrency(_stmt);
		}
	}

	return _inventory;
}

function _normalizeItem(block: D5cBlockStatement): InventoryItem {
	const _item: InventoryItem = {
		name: _asString(block.label) ?? _asIdentifier(block.label) ?? block.name,
		quantity: 1,
		equipped: false,
		raw: block,
	};

	for (const _stmt of block.body) {
		if (_stmt.kind === "field") {
			const _value = _first(_stmt);
			switch (_stmt.name) {
				case "Ref":
					_assignOptional(_item, "ref", _asRef(_value));
					break;
				case "Equipped":
					_item.equipped = _asBoolean(_value) ?? false;
					break;
				case "Quantity":
					_item.quantity = _asNumber(_value) ?? 1;
					break;
				case "Notes":
					_assignOptional(_item, "notes", _asString(_value));
					break;
			}
		} else if (_stmt.kind === "block" && _stmt.name === "Charges") {
			_item.charges = _normalizeResourceState(_stmt);
		}
	}

	return _item;
}

function _normalizeResourceState(block: D5cBlockStatement): ResourceState {
	const _state: ResourceState = { current: 0 };

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _value = _asNumber(_first(_stmt));
		if (_stmt.name === "Current" && _value !== undefined) {
			_state.current = _value;
		} else if (_stmt.name === "Max" && _value !== undefined) {
			_state.max = _value;
		}
	}

	return _state;
}

function _normalizeCurrency(block: D5cBlockStatement): Currency {
	const _currency = _defaultCurrency();

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _value = _asNumber(_first(_stmt));
		if (_value === undefined) {
			continue;
		}
		switch (_stmt.name) {
			case "Cp":
				_currency.cp = _value;
				break;
			case "Sp":
				_currency.sp = _value;
				break;
			case "Ep":
				_currency.ep = _value;
				break;
			case "Gp":
				_currency.gp = _value;
				break;
			case "Pp":
				_currency.pp = _value;
				break;
		}
	}

	return _currency;
}

function _normalizeState(block: D5cBlockStatement): CharacterState {
	const _state: CharacterState = {
		temporaryHp: 0,
		deathSaveSuccesses: 0,
		deathSaveFailures: 0,
		usedResources: [],
		conditions: [],
	};

	for (const _stmt of block.body) {
		if (_stmt.kind === "field") {
			const _value = _asNumber(_first(_stmt));
			if (_stmt.name === "CurrentHp" && _value !== undefined) {
				_state.currentHp = _value;
			} else if (_stmt.name === "TemporaryHp" && _value !== undefined) {
				_state.temporaryHp = _value;
			}
		} else if (_stmt.kind === "block") {
			switch (_stmt.name) {
				case "DeathSaves":
					_applyDeathSaves(_stmt, _state);
					break;
				case "Used":
					_state.usedResources = _normalizeUsedResources(_stmt);
					break;
				case "Conditions":
					_state.conditions = _collectRefs(_stmt.body);
					break;
			}
		}
	}

	return _state;
}

function _applyDeathSaves(block: D5cBlockStatement, state: CharacterState): void {
	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _value = _asNumber(_first(_stmt));
		if (_value === undefined) {
			continue;
		}
		if (_stmt.name === "Successes") {
			state.deathSaveSuccesses = _value;
		} else if (_stmt.name === "Failures") {
			state.deathSaveFailures = _value;
		}
	}
}

function _normalizeUsedResources(block: D5cBlockStatement): UsedResource[] {
	const _used: UsedResource[] = [];

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _key = _usedKey(_stmt.values[0]);
		const _amount = _asNumber(_stmt.values[1]) ?? 0;
		_used.push({ kind: _stmt.name, key: _key, amount: _amount, raw: _stmt });
	}

	return _used;
}

function _normalizeOverrides(block: D5cBlockStatement): CharacterOverride[] {
	const _overrides: CharacterOverride[] = [];

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}

		const _becauseIndex = _stmt.values.findIndex(
			(v) => v.kind === "identifier" && v.name === "because"
		);
		const _reason =
			_becauseIndex >= 0 ? _asString(_stmt.values[_becauseIndex + 1]) : undefined;
		const _end = _becauseIndex >= 0 ? _becauseIndex : _stmt.values.length;
		const _parts = _stmt.values.slice(0, _end).map(_valueToPrimitive);
		const _value = _parts.length === 1 ? _parts[0] : _parts;

		const _override: CharacterOverride = {
			target: _stmt.name,
			value: _value,
			raw: _stmt,
		};
		if (_reason !== undefined) {
			_override.reason = _reason;
		}
		_overrides.push(_override);
	}

	return _overrides;
}

function _normalizeNotes(block: D5cBlockStatement): Record<string, string> {
	const _notes: Record<string, string> = {};

	for (const _stmt of block.body) {
		if (_stmt.kind === "field") {
			_notes[_stmt.name] = _asString(_first(_stmt)) ?? "";
		}
	}

	return _notes;
}

function _collectRefs(body: D5cStatement[]): RuleRef[] {
	const _refs: RuleRef[] = [];
	for (const _stmt of body) {
		if (_stmt.kind === "listItem" && _stmt.value.kind === "ref") {
			_refs.push(_stmt.value.ref);
		}
	}
	return _refs;
}

function _labelToKind(block: D5cBlockStatement): string | undefined {
	const _label = block.label;
	if (_label === undefined) {
		return undefined;
	}
	if (_label.kind === "identifier") {
		return _label.name;
	}
	if (_label.kind === "string") {
		return _label.value;
	}
	return undefined;
}

function _first(field: D5cFieldStatement): D5cValue | undefined {
	return field.values[0];
}

function _firstPrimitive(field: D5cFieldStatement): unknown {
	const _value = field.values[0];
	return _value === undefined ? undefined : _valueToPrimitive(_value);
}

function _valueToPrimitive(value: D5cValue): unknown {
	switch (value.kind) {
		case "string":
			return value.value;
		case "number":
			return value.value;
		case "boolean":
			return value.value;
		case "none":
			return null;
		case "identifier":
			return value.name;
		case "ref":
			return value.ref;
		case "dice":
			return value.raw;
	}
}

function _usedKey(value: D5cValue | undefined): string {
	if (value === undefined) {
		return "";
	}
	switch (value.kind) {
		case "number":
			return String(value.value);
		case "identifier":
			return value.name;
		case "dice":
			return value.raw;
		case "string":
			return value.value;
		case "ref":
			return RuleRefKey(value.ref);
		default:
			return "";
	}
}

function _asNumber(value: D5cValue | undefined): number | undefined {
	return value !== undefined && value.kind === "number" ? value.value : undefined;
}

function _asString(value: D5cValue | undefined): string | undefined {
	return value !== undefined && value.kind === "string" ? value.value : undefined;
}

function _asBoolean(value: D5cValue | undefined): boolean | undefined {
	return value !== undefined && value.kind === "boolean" ? value.value : undefined;
}

function _asIdentifier(value: D5cValue | undefined): string | undefined {
	return value !== undefined && value.kind === "identifier" ? value.name : undefined;
}

function _asRef(value: D5cValue | undefined): RuleRef | undefined {
	return value !== undefined && value.kind === "ref" ? value.ref : undefined;
}

function _assignOptional<T, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
	if (value !== undefined) {
		target[key] = value;
	}
}

function _defaultAbilities(): AbilityScores {
	return {
		strength: 10,
		dexterity: 10,
		constitution: 10,
		intelligence: 10,
		wisdom: 10,
		charisma: 10,
	};
}

function _defaultCurrency(): Currency {
	return { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
}
