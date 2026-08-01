import { isDenseStringArray } from './value-guards.ts';

const readStringArrayProperty = (
	value: unknown,
	property: string
): readonly string[] | undefined => {
	if (value === null || typeof value !== 'object') {
		return undefined;
	}
	const propertyValue = (value as Record<string, unknown>)[property];
	return isDenseStringArray(propertyValue) ? propertyValue : undefined;
};

/** Resolves argv without importing a runtime-specific module. */
export const resolveRuntimeArgv = (): string[] => {
	const runtimeGlobals = globalThis as typeof globalThis & {
		process?: unknown;
		Deno?: unknown;
	};
	const processArgv = readStringArrayProperty(runtimeGlobals.process, 'argv');
	if (processArgv !== undefined) {
		return processArgv.slice(2);
	}
	const denoArgv = readStringArrayProperty(runtimeGlobals.Deno, 'args');
	return denoArgv === undefined ? [] : [...denoArgv];
};
