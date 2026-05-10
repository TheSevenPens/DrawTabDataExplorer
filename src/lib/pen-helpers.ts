import type { Pen } from '$data/lib/drawtab-loader.js';
import { penFullName } from '$data/lib/entities/pen-fields.js';
export { penFullName, penBrandAndName } from '$data/lib/entities/pen-fields.js';

export function buildPenNameMap(pens: Pen[]): Map<string, string> {
	return new Map(pens.map((p) => [p.EntityId, penFullName(p)]));
}

export function formatPenIds(ids: string[], penNameMap: Map<string, string>): string {
	return ids.map((id) => penNameMap.get(id) ?? id).join(', ');
}
