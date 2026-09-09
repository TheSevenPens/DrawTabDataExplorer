// The single definition of what a table cell says.
//
// A field's stored value and its rendered text are allowed to differ, and
// three separate mechanisms make them differ:
//
//   * `cellLinks` replaces the text wholesale — the inventory pages draw a
//     tablet's ModelName in a column whose field is TabletEntityId.
//   * `getDisplayValue` rewrites it — Brand stores "XPPEN" and draws
//     "XP-Pen"; Age stores "8" and draws "8 years 6 months".
//   * `formatValue` converts units — a diagonal stored in mm draws in
//     inches when the viewer prefers imperial.
//
// Search used to read `getValue` while the table drew one of the above, so
// the screen said "Cintiq Pro 27" and typing "cin" matched nothing, and
// every XP-Pen row was reachable only by typing "xppen" — a string that
// appears nowhere on the page. Both the table and the search now resolve
// text through here, so they cannot drift apart again.

import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
import { formatValue, type UnitPreference } from '$data/lib/units.js';
import type { CellLinks } from '$lib/table-types.js';

export interface CellTextOptions {
	cellLinks?: CellLinks;
	unitPreference: UnitPreference;
}

/**
 * The text a cell shows for `field`, resolved in the same order
 * `ResultsTable` renders it: cell-link labels, then `getDisplayValue`,
 * then the unit-formatted stored value.
 *
 * A field with several links (rare, but `cellLinks` returns an array)
 * joins them the way the table does, so a search over this string sees
 * every label.
 */
export function cellText(
	// Heterogeneous entity rows — see table-types.ts (#221).
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	item: any,
	field: AnyFieldDisplayDef,
	{ cellLinks = {}, unitPreference }: CellTextOptions,
): string {
	const links = cellLinks[field.key];
	if (links)
		return links(item)
			.map((l) => l.label)
			.join(', ');
	if (field.getDisplayValue) return field.getDisplayValue(item);
	return formatValue(field.getValue(item), field.unit, unitPreference);
}
