/** A plain object with string or symbol own keys. */
export type PlainRecord = Record<PropertyKey, unknown>;

/** Returns whether a value is an ordinary or null-prototype object. */
export const isPlainRecord = (value: unknown): value is PlainRecord => {
	if (value === null || typeof value !== 'object') return false;
	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
};

/** Returns whether an object defines an own property. */
export const hasOwn = (value: object, property: PropertyKey): boolean =>
	Object.prototype.hasOwnProperty.call(value, property);

/** Adopts own data properties without invoking caller accessors or rereading values. */
export const copyDataRecord = (value: object, label: string): PlainRecord => {
	const copy = Object.create(null) as PlainRecord;
	for (const property of Reflect.ownKeys(value)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, property);
		if (descriptor === undefined || !('value' in descriptor)) {
			throw new TypeError(`${label} property "${String(property)}" must be a data property.`);
		}
		copy[property] = descriptor.value;
	}
	return Object.freeze(copy);
};

/** Adopts a closed plain record with one authoritative property check. */
export const copyClosedRecord = (value: unknown, allowed: readonly string[], label: string): PlainRecord => {
	if (!isPlainRecord(value)) throw new TypeError(`${label} must be a plain object.`);
	const owned = copyDataRecord(value, label);
	for (const property of Reflect.ownKeys(owned)) {
		if (typeof property !== 'string' || !allowed.includes(property)) {
			throw new TypeError(`${label} have unsupported property "${String(property)}".`);
		}
	}
	return owned;
};

/** Copies array data without invoking accessors, iterators, or inherited elements. */
export const copyArrayData = (value: readonly unknown[], label: string): readonly unknown[] => {
	const length = Object.getOwnPropertyDescriptor(value, 'length')?.value as unknown;
	if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) {
		throw new TypeError(`${label} must be an array.`);
	}
	const copy: unknown[] = new Array<unknown>(length);
	for (let index = 0; index < length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (descriptor === undefined) continue;
		if (!('value' in descriptor)) {
			throw new TypeError(`${label} element ${String(index)} must be a data property.`);
		}
		copy[index] = descriptor.value;
	}
	return Object.freeze(copy);
};

/** Adopts a dense string array in one read, without caller iteration. */
export const copyStringArray = (value: unknown, label: string): readonly string[] | undefined => {
	if (!Array.isArray(value)) return undefined;
	const copy = copyArrayData(value, label);
	for (let index = 0; index < copy.length; index += 1) {
		if (!hasOwn(copy, index) || typeof copy[index] !== 'string') return undefined;
	}
	return copy as readonly string[];
};

/** Checks Promise behavior without invoking a caller-defined then accessor. */
export const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
	if ((value === null || typeof value !== 'object') && typeof value !== 'function') return false;
	let current: object | null = value;
	while (current !== null) {
		const descriptor = Object.getOwnPropertyDescriptor(current, 'then');
		if (descriptor !== undefined) {
			if (!('value' in descriptor)) throw new TypeError('Value parser result "then" must be a data property.');
			return typeof descriptor.value === 'function';
		}
		current = Object.getPrototypeOf(current) as object | null;
	}
	return false;
};
