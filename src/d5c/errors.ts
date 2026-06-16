export interface SourceLocation {
	line: number;
	column: number;
	offset: number;
}

export type DiagnosticSeverity = "error" | "warning";

export interface D5cDiagnostic {
	severity: DiagnosticSeverity;
	code: string;
	message: string;
	location?: SourceLocation;
}

/**
 * Thrown by the lexer and parser on syntax errors. Always carries at least one
 * diagnostic so callers can render line/column information.
 */
export class D5cParseError extends Error {
	public readonly diagnostics: D5cDiagnostic[];

	public constructor(message: string, diagnostics: D5cDiagnostic[]) {
		super(message);
		this.name = "D5cParseError";
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
): D5cDiagnostic {
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
