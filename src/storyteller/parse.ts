import type { DocDocument } from "../common/text/ast.ts";
import { ParseDocument } from "../common/text/parser.ts";

/** The STC format keywords: `STC <version>` and a `Character` root block. */
export const StcFormat = { formatKeyword: "STC", rootKeyword: "Character" } as const;

/** Parses STC ("Storyteller Character") text into a raw AST. */
export function ParseStc(text: string): DocDocument {
	return ParseDocument(text, StcFormat);
}
