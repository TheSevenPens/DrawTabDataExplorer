import { getStorageJson, setStorageJson } from '$lib/storage.js';

const PREFIX = 'drawtabdata-colwidths-';

export function loadColumnWidths(entityType: string): Record<string, number> {
	return getStorageJson(PREFIX + entityType, {} as Record<string, number>);
}

export function saveColumnWidths(entityType: string, widths: Record<string, number>) {
	setStorageJson(PREFIX + entityType, widths);
}
