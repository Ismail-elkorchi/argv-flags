const differsByOneInsertion = (
	shorter: readonly string[],
	longer: readonly string[]
): boolean => {
	let shortIndex = 0;
	let longIndex = 0;
	let skipped = false;
	while (shortIndex < shorter.length && longIndex < longer.length) {
		if (shorter[shortIndex] === longer[longIndex]) {
			shortIndex += 1;
			longIndex += 1;
			continue;
		}
		if (skipped) {
			return false;
		}
		skipped = true;
		longIndex += 1;
	}
	return true;
};

const differsByOneSameLengthEdit = (
	input: readonly string[],
	candidate: readonly string[]
): boolean => {
	const mismatches: number[] = [];
	for (let index = 0; index < input.length; index += 1) {
		if (input[index] !== candidate[index]) {
			mismatches.push(index);
			if (mismatches.length > 2) {
				return false;
			}
		}
	}
	if (mismatches.length === 1) {
		return true;
	}
	if (mismatches.length !== 2) {
		return false;
	}
	const first = mismatches[0];
	const second = mismatches[1];
	return (
		first !== undefined &&
		second === first + 1 &&
		input[first] === candidate[second] &&
		input[second] === candidate[first]
	);
};

const differsByOneEdit = (input: string, candidate: string): boolean => {
	const inputPoints = Array.from(input);
	const candidatePoints = Array.from(candidate);
	const difference = inputPoints.length - candidatePoints.length;
	if (difference === 0) {
		return differsByOneSameLengthEdit(inputPoints, candidatePoints);
	}
	if (difference === -1) {
		return differsByOneInsertion(inputPoints, candidatePoints);
	}
	if (difference === 1) {
		return differsByOneInsertion(candidatePoints, inputPoints);
	}
	return false;
};

/** Creates stable one-edit and strict-prefix suggestions. */
export const createSuggestions = (
	input: string,
	candidates: readonly string[],
	allowPrefix: boolean
): readonly string[] => {
	const edits: string[] = [];
	const prefixes: string[] = [];
	const seen = new Set<string>();
	for (const candidate of candidates) {
		if (candidate.length === 0 || seen.has(candidate)) {
			continue;
		}
		seen.add(candidate);
		if (differsByOneEdit(input, candidate)) {
			edits.push(candidate);
		} else if (
			allowPrefix &&
			input.length < candidate.length &&
			candidate.startsWith(input)
		) {
			prefixes.push(candidate);
		}
	}
	return Object.freeze([...edits, ...prefixes].slice(0, 3));
};

/** Adds the first advisory suggestion to an issue message. */
export const addSuggestionToMessage = (
	message: string,
	suggestions: readonly string[]
): string => {
	const first = suggestions[0];
	return first === undefined ? message : `${message} Did you mean "${first}"?`;
};
