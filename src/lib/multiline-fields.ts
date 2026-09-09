// Splitting a field list into the spec-grid fields and the free-text ones.
//
// A `multiline` FieldDisplayDef (queriton) holds prose the author wrote as
// prose — today the tablet/pen `Notes` fields, which may be many lines of
// markdown. Detail views lay those out as a full-width preformatted block
// under the spec grid rather than as a one-line `<dd>`, so the line breaks
// and indentation survive.

import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';

/** One free-text field with a value, ready to render as a block. */
export interface MultilineFieldValue {
	key: string;
	label: string;
	value: string;
}

/** The fields a detail view should keep in its spec grid. */
export function inlineFields(fields: AnyFieldDisplayDef[]): AnyFieldDisplayDef[] {
	return fields.filter((f) => !f.multiline);
}

/**
 * The free-text fields that actually have something to say for `item`.
 * Whitespace-only values count as empty — an all-spaces note is nothing.
 */
export function multilineFieldValues(
	item: Record<string, unknown>,
	fields: AnyFieldDisplayDef[],
): MultilineFieldValue[] {
	const out: MultilineFieldValue[] = [];
	for (const f of fields) {
		if (!f.multiline) continue;
		const value = f.getValue(item);
		if (!value || value.trim() === '') continue;
		out.push({ key: f.key, label: f.label, value });
	}
	return out;
}
