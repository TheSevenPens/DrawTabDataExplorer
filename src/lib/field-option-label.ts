import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';

type FieldLike = Pick<AnyFieldDisplayDef, 'key' | 'label'> & { group?: string };

/** Dropdown / picker label: `Group · Label` when a group is set, else plain label. */
export function fieldOptionLabel(field: FieldLike): string {
	if (field.group) {
		return `${field.group} · ${field.label}`;
	}
	return field.label;
}

/** Resolve a field key to the same dropdown label used in pickers. */
export function fieldOptionLabelForKey(key: string, fields: FieldLike[]): string {
	const field = fields.find((f) => f.key === key);
	return field ? fieldOptionLabel(field) : key;
}
