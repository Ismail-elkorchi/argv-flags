/** Returns whether a value is a plain or null-prototype object. */
export const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
	if (value === null || typeof value !== 'object') {
		return false;
	}
	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
};

/** Returns whether an object defines an own property. */
export const hasOwn = (value: object, property: PropertyKey): boolean =>
	Object.prototype.hasOwnProperty.call(value, property);

/** Returns whether a value is a dense array containing only strings. */
export const isStringArray = (value: unknown): value is string[] => {
	if (!Array.isArray(value)) {
		return false;
	}
	for (const entry of value) {
		if (typeof entry !== 'string') {
			return false;
		}
	}
	return true;
};
