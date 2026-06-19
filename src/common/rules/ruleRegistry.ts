import type { RuleObject } from "./ruleObject.ts";
import type { RuleRef } from "./ruleRef.ts";
import type { RuleSource } from "./ruleSource.ts";

/**
 * Routes rule references to the source that owns their namespace. The registry
 * holds no rule data itself; it only knows which source answers for which
 * logical namespace.
 */
export class RuleRegistry {
	private readonly _sources = new Map<string, RuleSource>();

	public AddSource(source: RuleSource): void {
		if (this._sources.has(source.id)) {
			throw new Error(`Rule source already registered: ${source.id}`);
		}

		this._sources.set(source.id, source);
	}

	public HasSource(sourceId: string): boolean {
		return this._sources.has(sourceId);
	}

	public GetSource(sourceId: string): RuleSource | undefined {
		return this._sources.get(sourceId);
	}

	public async Get(ref: RuleRef): Promise<RuleObject | undefined> {
		const _source = this._sources.get(ref.source);

		if (_source === undefined) {
			return undefined;
		}

		return await _source.Get(ref);
	}

	public async Has(ref: RuleRef): Promise<boolean> {
		const _source = this._sources.get(ref.source);

		if (_source === undefined) {
			return false;
		}

		return await _source.Has(ref);
	}
}
