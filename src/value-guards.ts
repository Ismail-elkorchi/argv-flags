/** A plain object with string or symbol own keys. */
export type PlainRecord = Record<PropertyKey, unknown>;

/** Returns whether a value is an ordinary or null-prototype object. */
export const isPlainRecord = (value: unknown): value is PlainRecord => {
	if (value === null || typeof value !== 'object') {
		return false;
	}
	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
};

/** Returns whether an object defines an own property. */
export const hasOwn = (value: object, property: PropertyKey): boolean =>
	Object.prototype.hasOwnProperty.call(value, property);

/** Reads an own data property after its container has been validated. */
export const readOwnDataProperty = (
	value: PlainRecord,
	property: PropertyKey
): unknown => value[property];

/** Rejects accessor properties at a validated public boundary. */
export const assertOwnDataProperties = (
	value: object,
	label: string
): void => {
	for (const property of Reflect.ownKeys(value)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, property);
		if (descriptor !== undefined && !('value' in descriptor)) {
			throw new TypeError(
				`${label} property "${String(property)}" must be a data property.`
			);
		}
	}
};

/** Returns whether a value is a dense array containing only strings. */
export const isDenseStringArray = (
	value: unknown
): value is readonly string[] => {
	if (!Array.isArray(value)) {
		return false;
	}
	for (let index = 0; index < value.length; index += 1) {
		if (!hasOwn(value, index) || typeof value[index] !== 'string') {
			return false;
		}
	}
	return true;
};

/** Returns whether a value behaves like a Promise. */
export const isPromiseLike = (
	value: unknown
): value is PromiseLike<unknown> =>
	(value !== null && typeof value === 'object') || typeof value === 'function'
		? typeof (value as { readonly then?: unknown }).then === 'function'
		: false;
