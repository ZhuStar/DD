export interface SourceLocation {
	line: number;
	column: number;
	offset: number;
}

export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
	severity: DiagnosticSeverity;
	code: string;
	message: string;
	location?: SourceLocation;
}

/**
 * Thrown by the lexer and parser on syntax errors. Always carries at least one
 * diagnostic so callers can render line/column information. Game-agnostic: the
 * same error type is shared by every system built on this text format.
 */
export class ParseError extends Error {
	public readonly diagnostics: Diagnostic[];

	public constructor(message: string, diagnostics: Diagnostic[]) {
		super(message);
		this.name = "ParseError";
		this.diagnostics = diagnostics;
	}

	public get location(): SourceLocation | undefined {
		return this.diagnostics[0]?.location;
	}
}

export function MakeDiagnostic(
	severity: DiagnosticSeverity,
	code: string,
	message: string,
	location?: SourceLocation
): Diagnostic {
	return location === undefined
		? { severity, code, message }
		: { severity, code, message, location };
}

export function FormatLocation(location?: SourceLocation): string {
	if (location === undefined) {
		return "<unknown>";
	}

	return `${location.line}:${location.column}`;
}
