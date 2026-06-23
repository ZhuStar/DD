import type {
	DocBlockStatement,
	DocDocument,
	DocFieldStatement,
	DocStatement,
	DocValue,
} from "../common/text/ast.ts";
import {
	AsBoolean,
	AsIdentifier,
	AsNumber,
	AsRef,
	AsString,
	AssignOptional,
	FirstValue,
	ValueToPrimitive,
} from "../common/text/values.ts";
import type { RuleRef } from "../common/rules/ruleRef.ts";
import { RuleRefKey } from "../common/rules/ruleRef.ts";
import { NormalizeNotes, NormalizeOverrides } from "../common/character.ts";
import type {
	AbilityName,
	AbilityScores,
	Character,
	CharacterChoice,
	CharacterDocument,
	CharacterLevel,
	CharacterOrigin,
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
export function NormalizeD5c(document: DocDocument): CharacterDocument {
	const _character: Character = {
		name: document.root.name,
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
	const _extensions: DocStatement[] = [];

	for (const _stmt of document.root.body) {
		if (_stmt.kind === "field") {
			switch (_stmt.name) {
				case "Game":
					_game = AsString(FirstValue(_stmt)) ?? AsIdentifier(FirstValue(_stmt)) ?? "";
					break;
				case "Player":
					AssignOptional(_character, "player", AsString(FirstValue(_stmt)));
					break;
				case "Xp":
					AssignOptional(_character, "xp", AsNumber(FirstValue(_stmt)));
					break;
				case "Inspiration":
					_character.inspiration = AsBoolean(FirstValue(_stmt)) ?? false;
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
		format: "D5C",
		formatVersion: document.version,
		game: _game,
		character: _character,
		extensions: _extensions,
	};
}

function _normalizeOrigin(block: DocBlockStatement): CharacterOrigin {
	const _origin: CharacterOrigin = {};

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _value = FirstValue(_stmt);
		switch (_stmt.name) {
			case "Species":
				AssignOptional(_origin, "species", AsRef(_value));
				break;
			case "Subspecies":
				AssignOptional(_origin, "subspecies", AsRef(_value));
				break;
			case "Background":
				AssignOptional(_origin, "background", AsRef(_value));
				break;
			case "Alignment":
				AssignOptional(_origin, "alignment", AsString(_value));
				break;
		}
	}

	return _origin;
}

function _normalizeLevels(block: DocBlockStatement): CharacterLevel[] {
	const _levels: CharacterLevel[] = [];

	for (const _stmt of block.body) {
		if (_stmt.kind !== "block" || _stmt.name !== "Level") {
			continue;
		}

		const _level: CharacterLevel = {
			level: AsNumber(_stmt.label) ?? Number.NaN,
			classRef: _missingClassRef,
			choices: [],
		};

		for (const _inner of _stmt.body) {
			if (_inner.kind === "field") {
				const _value = FirstValue(_inner);
				switch (_inner.name) {
					case "Class":
						_level.classRef = AsRef(_value) ?? _missingClassRef;
						break;
					case "Subclass":
						AssignOptional(_level, "subclassRef", AsRef(_value));
						break;
					case "HitPoints":
						AssignOptional(_level, "hitPoints", AsNumber(_value));
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

function _normalizeAbilities(block: DocBlockStatement, abilities: AbilityScores): void {
	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _key = _abilityKeyByName[_stmt.name];
		const _value = AsNumber(FirstValue(_stmt));
		if (_key !== undefined && _value !== undefined) {
			abilities[_key] = _value;
		}
	}
}

function _normalizeChoices(body: DocStatement[]): CharacterChoice[] {
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

function _normalizeChoiceField(field: DocFieldStatement): CharacterChoice {
	const _choice: CharacterChoice = { kind: field.name.toLowerCase(), raw: field };

	for (let _i = 0; _i < field.values.length; _i += 1) {
		const _value = field.values[_i]!;
		if (_value.kind === "ref" && _choice.ref === undefined) {
			_choice.ref = _value.ref;
		}
		if (_value.kind === "identifier" && _value.name === "from") {
			const _next = field.values[_i + 1];
			const _source = AsIdentifier(_next) ?? AsString(_next);
			if (_source !== undefined) {
				_choice.source = _source;
			}
		}
	}

	return _choice;
}

function _normalizeChoiceBlock(block: DocBlockStatement): CharacterChoice {
	const _kind = _labelToKind(block) ?? block.name.toLowerCase();
	const _value: Record<string, unknown> = {};

	for (const _stmt of block.body) {
		if (_stmt.kind === "field") {
			const _first = FirstValue(_stmt);
			_value[_stmt.name.toLowerCase()] =
				_first === undefined ? undefined : ValueToPrimitive(_first);
		}
	}

	return { kind: _kind, value: _value, raw: block };
}

function _normalizeSpells(block: DocBlockStatement): CharacterSpells {
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

function _normalizeInventory(block: DocBlockStatement): Inventory {
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

function _normalizeItem(block: DocBlockStatement): InventoryItem {
	const _item: InventoryItem = {
		name: AsString(block.label) ?? AsIdentifier(block.label) ?? block.name,
		quantity: 1,
		equipped: false,
		raw: block,
	};

	for (const _stmt of block.body) {
		if (_stmt.kind === "field") {
			const _value = FirstValue(_stmt);
			switch (_stmt.name) {
				case "Ref":
					AssignOptional(_item, "ref", AsRef(_value));
					break;
				case "Equipped":
					_item.equipped = AsBoolean(_value) ?? false;
					break;
				case "Quantity":
					_item.quantity = AsNumber(_value) ?? 1;
					break;
				case "Notes":
					AssignOptional(_item, "notes", AsString(_value));
					break;
			}
		} else if (_stmt.kind === "block" && _stmt.name === "Charges") {
			_item.charges = _normalizeResourceState(_stmt);
		}
	}

	return _item;
}

function _normalizeResourceState(block: DocBlockStatement): ResourceState {
	const _state: ResourceState = { current: 0 };

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _value = AsNumber(FirstValue(_stmt));
		if (_stmt.name === "Current" && _value !== undefined) {
			_state.current = _value;
		} else if (_stmt.name === "Max" && _value !== undefined) {
			_state.max = _value;
		}
	}

	return _state;
}

function _normalizeCurrency(block: DocBlockStatement): Currency {
	const _currency = _defaultCurrency();

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _value = AsNumber(FirstValue(_stmt));
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

function _normalizeState(block: DocBlockStatement): CharacterState {
	const _state: CharacterState = {
		temporaryHp: 0,
		deathSaveSuccesses: 0,
		deathSaveFailures: 0,
		usedResources: [],
		conditions: [],
	};

	for (const _stmt of block.body) {
		if (_stmt.kind === "field") {
			const _value = AsNumber(FirstValue(_stmt));
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

function _applyDeathSaves(block: DocBlockStatement, state: CharacterState): void {
	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _value = AsNumber(FirstValue(_stmt));
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

function _normalizeUsedResources(block: DocBlockStatement): UsedResource[] {
	const _used: UsedResource[] = [];

	for (const _stmt of block.body) {
		if (_stmt.kind !== "field") {
			continue;
		}
		const _key = _usedKey(_stmt.values[0]);
		const _amount = AsNumber(_stmt.values[1]) ?? 0;
		_used.push({ kind: _stmt.name, key: _key, amount: _amount, raw: _stmt });
	}

	return _used;
}

function _collectRefs(body: DocStatement[]): RuleRef[] {
	const _refs: RuleRef[] = [];
	for (const _stmt of body) {
		if (_stmt.kind === "listItem" && _stmt.value.kind === "ref") {
			_refs.push(_stmt.value.ref);
		}
	}
	return _refs;
}

function _labelToKind(block: DocBlockStatement): string | undefined {
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

function _usedKey(value: DocValue | undefined): string {
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
