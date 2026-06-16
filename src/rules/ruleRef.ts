/**
 * A logical reference to a rule object, of the form `@source:type/id`.
 *
 * `source` is a logical namespace (for example `srd2014`, `homebrew`,
 * `campaign`). It is NOT a filename or path; where a source physically lives is
 * the concern of a source adapter, not of this reference.
 */
export interface RuleRef {
	source: string;
	type: string;
	id: string;
}

/** Matches the body of a reference: `source:type/id` (without the leading `@`). */
export const RuleRefBodyPattern =
	/^([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+)\/([A-Za-z0-9_./-]+)$/;

/** Matches a full reference token including the leading `@`. */
export const RuleRefPattern =
	/^@([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+)\/([A-Za-z0-9_./-]+)$/;

/**
 * Produces a stable key for a reference, suitable for use as a Map key.
 * The leading `@` is intentionally omitted.
 */
export function RuleRefKey(ref: RuleRef): string {
	return `${ref.source}:${ref.type}/${ref.id}`;
}

/** Formats a reference back into its canonical `@source:type/id` text form. */
export function FormatRuleRef(ref: RuleRef): string {
	return `@${RuleRefKey(ref)}`;
}

export function RuleRefEquals(a: RuleRef, b: RuleRef): boolean {
	return a.source === b.source && a.type === b.type && a.id === b.id;
}

/**
 * Parses a reference from text. Accepts both `@source:type/id` and the
 * `source:type/id` body form. Returns `undefined` when the text is not a valid
 * reference.
 */
export function TryParseRuleRef(text: string): RuleRef | undefined {
	const _body = text.startsWith("@") ? text.slice(1) : text;
	const _match = RuleRefBodyPattern.exec(_body);

	if (_match === null) {
		return undefined;
	}

	return { source: _match[1]!, type: _match[2]!, id: _match[3]! };
}

/** Parses a reference from text, throwing a `TypeError` on invalid input. */
export function ParseRuleRef(text: string): RuleRef {
	const _ref = TryParseRuleRef(text);

	if (_ref === undefined) {
		throw new TypeError(`Invalid rule reference: ${JSON.stringify(text)}`);
	}

	return _ref;
}
