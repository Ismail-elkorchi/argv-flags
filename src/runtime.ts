import { isStringArray } from './value-guards.ts';

const readStringArrayProperty = (
	value: unknown,
	property: string
): readonly string[] | undefined => {
	if (value === null || typeof value !== 'object') {
		return undefined;
	}
	const propertyValue = (value as Record<string, unknown>)[property];
	return isStringArray(propertyValue) ? propertyValue : undefined;
};

/** Resolves raw CLI arguments without importing a runtime-specific module. */
export const resolveRuntimeArguments = (): string[] => {
	const runtimeGlobals = globalThis as typeof globalThis & {
		process?: unknown;
		Deno?: unknown;
	};
	const processArguments = readStringArrayProperty(runtimeGlobals.process, 'argv');
	if (processArguments !== undefined) {
		return processArguments.slice(2);
	}

	const denoArguments = readStringArrayProperty(runtimeGlobals.Deno, 'args');
	return denoArguments === undefined ? [] : [...denoArguments];
};
