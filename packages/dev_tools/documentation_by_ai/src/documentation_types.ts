///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationTypes — the inputs and saved record of a generation run
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Options for one generation call followed by one build. */
export type DocumentationOptions = {
	/** Explicit Codex model; the command defaults to gpt-6-luna. */
	model: string;
	/** Reasoning effort passed directly to Codex. */
	effort: 'low' | 'medium' | 'high';
	/** Repository-relative rule paths; an empty array selects all interface rules. */
	onlyRuleFiles: string[];
	/** Optional repository-relative directory containing verified captures and their manifest. */
	evidencePath?: string;
	/** Prints the assembled request without running a model, writing files or building. */
	isDryRun: boolean;
	/** Change history supplied as hints; every run still checks all current documentation. */
	hintsText?: string;
};

/** A file fingerprint saved with the run for later human investigation. */
export type DocumentationInput = {
	/** Repository-relative source path. */
	path: string;
	/** SHA-256 of the exact bytes available at the start of generation. */
	sha256: string;
};
