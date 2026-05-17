// Re-export the canonical formatters from data-repo so consumers can
// import them via $lib without reaching into $data.
export {
	tabletFullName,
	tabletBrandAndName,
	tabletNameAndId,
} from '$data/lib/entities/tablet-fields.js';

import type { Tablet } from '$data/lib/drawtab-loader.js';
import { yearNum } from '$lib/year.js';

export function compareTabletByYearDesc(a: Tablet, b: Tablet): number {
	return yearNum(b.Model.LaunchYear) - yearNum(a.Model.LaunchYear);
}
