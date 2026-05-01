// Typed error classes for the data-access layer. Pages can `instanceof`-check
// to render distinct messages for "data not found" vs "decode failed" vs
// "network error", instead of all collapsing to a generic spinner / "loading".

export class DataNotFoundError extends Error {
	readonly kind = 'not-found' as const;
	constructor(
		readonly resource: string,
		message?: string,
	) {
		super(message ?? `Data not found: ${resource}`);
		this.name = 'DataNotFoundError';
	}
}

export class DataDecodeError extends Error {
	readonly kind = 'decode' as const;
	constructor(
		readonly resource: string,
		readonly cause?: unknown,
		message?: string,
	) {
		super(message ?? `Failed to decode: ${resource}`);
		this.name = 'DataDecodeError';
	}
}

export class DataNetworkError extends Error {
	readonly kind = 'network' as const;
	constructor(
		readonly resource: string,
		readonly cause?: unknown,
		message?: string,
	) {
		super(message ?? `Network error fetching: ${resource}`);
		this.name = 'DataNetworkError';
	}
}

export type DataError = DataNotFoundError | DataDecodeError | DataNetworkError;

export function isDataError(err: unknown): err is DataError {
	return (
		err instanceof DataNotFoundError ||
		err instanceof DataDecodeError ||
		err instanceof DataNetworkError
	);
}
