// Saved views persist a `Step[]` pipeline, and steps reference fields by
// their FieldDef key. Renaming a key therefore breaks every stored view that
// mentions it — the step survives round-tripping but points at a field that
// no longer exists, so the view silently loses a column or a filter.
//
// This maps old keys to current ones on load. Entries are permanent: a view
// saved before a rename can surface at any time, so nothing here expires.

/** Old FieldDef key -> current key. */
export const RENAMED_FIELD_KEYS: Readonly<Record<string, string>> = {
	// Model.LaunchYear became Model.ReleaseYear, so the tablet field key
	// followed. "Launch" and "release" were two words for one event, and the
	// mismatch invited reading them as announced-vs-shipped.
	ModelLaunchYear: 'ModelReleaseYear',
};

/** Properties of a Step that hold a single field key. */
const SINGLE_KEY_PROPS = new Set(['field']);
/** Properties that hold an array of field keys. */
const ARRAY_KEY_PROPS = new Set(['fields', 'groupBy']);

function rename(key: string): string {
	return RENAMED_FIELD_KEYS[key] ?? key;
}

/**
 * Deep-copy `value`, rewriting renamed field keys wherever a step holds one.
 *
 * Only properties known to carry field keys are touched — a filter's `value`
 * that happens to equal an old key is left alone, since it is data the user
 * typed, not a reference. Structure is otherwise preserved exactly, so steps
 * this module knows nothing about round-trip untouched.
 */
export function migrateFieldKeys<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((entry) => migrateFieldKeys(entry)) as unknown as T;
	}
	if (value === null || typeof value !== 'object') return value;

	const out: Record<string, unknown> = {};
	for (const [prop, entry] of Object.entries(value as Record<string, unknown>)) {
		if (SINGLE_KEY_PROPS.has(prop) && typeof entry === 'string') {
			out[prop] = rename(entry);
		} else if (
			ARRAY_KEY_PROPS.has(prop) &&
			Array.isArray(entry) &&
			entry.every((e) => typeof e === 'string')
		) {
			out[prop] = (entry as string[]).map(rename);
		} else {
			out[prop] = migrateFieldKeys(entry);
		}
	}
	return out as T;
}
