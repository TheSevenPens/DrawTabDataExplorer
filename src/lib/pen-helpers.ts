import { brandName, type Pen } from '$data/lib/drawtab-loader.js';

export function buildPenNameMap(pens: Pen[]): Map<string, string> {
	return new Map(pens.map(p => [p.PenId, `${brandName(p.Brand)} ${p.PenName} (${p.PenId})`]));
}

export function formatPenIds(ids: string[], penNameMap: Map<string, string>): string {
	return ids.map(id => penNameMap.get(id) ?? id).join(', ');
}
