// Re-export the canonical formatters from data-repo so consumers can
// import them via $lib without reaching into $data.
export {
	tabletFullName,
	tabletBrandAndName,
	tabletNameAndId,
} from '$data/lib/entities/tablet-fields.js';

import type { Tablet } from '$data/lib/drawtab-loader.js';
import { tabletFullName, tabletNameAndId } from '$data/lib/entities/tablet-fields.js';
import { yearNum } from '$lib/year.js';

export function compareTabletByYearDesc(a: Tablet, b: Tablet): number {
	return yearNum(b.Model.LaunchYear) - yearNum(a.Model.LaunchYear);
}

export function buildTabletNameMap(tablets: Tablet[]): Map<string, string> {
	return new Map(tablets.map((t) => [t.Meta.EntityId, tabletFullName(t)]));
}

/** EntityId → "Name (Id)" (no brand prefix) — used for the Tablet column in
 * the IAF/MAX by-sample tables (PressureRangeTab). */
export function buildTabletNameAndIdMap(tablets: Tablet[]): Map<string, string> {
	return new Map(tablets.map((t) => [t.Meta.EntityId, tabletNameAndId(t)]));
}
