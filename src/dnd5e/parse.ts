import type { DocDocument } from "../common/text/ast.ts";
import { ParseDocument } from "../common/text/parser.ts";

/** The D5C format keywords: `D5C <version>` and a `Character` root block. */
export const D5cFormat = { formatKeyword: "D5C", rootKeyword: "Character" } as const;

/** Parses D5C ("D&D 5e Character") text into a raw AST. */
export function ParseD5c(text: string): DocDocument {
	return ParseDocument(text, D5cFormat);
}
