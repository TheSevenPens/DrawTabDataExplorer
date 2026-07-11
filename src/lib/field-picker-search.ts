export type FieldLabelSegment = { text: string; match: boolean };

export function normalizeFieldSearch(query: string): string {
	return query.trim().toLowerCase();
}

export function fieldMatchesQuery(field: { label: string; key: string }, query: string): boolean {
	const q = normalizeFieldSearch(query);
	if (!q) return false;
	return field.label.toLowerCase().includes(q) || field.key.toLowerCase().includes(q);
}

/** Split a field label into segments; the substring matching `query` is marked match. */
export function highlightFieldLabel(label: string, query: string): FieldLabelSegment[] {
	const q = normalizeFieldSearch(query);
	if (!q) return [{ text: label, match: false }];

	const lower = label.toLowerCase();
	const idx = lower.indexOf(q);
	if (idx === -1) return [{ text: label, match: false }];

	const end = idx + q.length;
	const segments: FieldLabelSegment[] = [];
	if (idx > 0) segments.push({ text: label.slice(0, idx), match: false });
	segments.push({ text: label.slice(idx, end), match: true });
	if (end < label.length) segments.push({ text: label.slice(end), match: false });
	return segments;
}

/** True when the query matches the field key but not the visible label. */
export function fieldLabelBoldWhenKeyMatch(
	field: { label: string; key: string },
	query: string,
): boolean {
	const q = normalizeFieldSearch(query);
	if (!q) return false;
	return field.key.toLowerCase().includes(q) && !field.label.toLowerCase().includes(q);
}
