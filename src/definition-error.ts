import type { DefinitionIssue } from './public-types.ts';

/** Error thrown when option definitions cannot be compiled. */
export class DefinitionError extends TypeError {
	/** All definition issues found during compilation. */
	readonly issues: readonly DefinitionIssue[];

	/** Creates an error from the complete set of compilation issues. */
	constructor(issues: readonly DefinitionIssue[]) {
		super(issues.map((issue) => issue.message).join('\n'));
		this.name = 'DefinitionError';
		this.issues = Object.freeze(
			issues.map((issue): DefinitionIssue => {
				if (issue.code === 'CONFLICTING_OPTION_PROPERTIES') {
					const properties: typeof issue.properties = Object.freeze([
						...issue.properties
					]);
					return Object.freeze({ ...issue, properties });
				}
				return Object.freeze({ ...issue });
			})
		);
	}
}
