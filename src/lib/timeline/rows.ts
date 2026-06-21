import type { Tablet, Pen, Driver } from '$data/lib/drawtab-loader.js';

// One grouped period of the timeline (a year, or a year-month). Built in the
// timeline page's grouping pass; shared with the table view so both render
// from the same filtered/sorted data.
export interface TimelinePeriod {
	sort: string;
	year: string;
	month: number | null; // 1-12 when known
	monthUnknown: boolean; // year-month mode, item has no month
	tablets: Tablet[];
	pens: Pen[];
	drivers: Driver[];
}

export interface TimelineRow {
	periodSort: string;
	year: string;
	month: number | null;
	monthUnknown: boolean;
	category: 'Tablet' | 'Pen' | 'Driver';
	brand: string; // raw brand code; format with brandName() at render
	name: string;
	id: string;
	detail: string; // tablet Type / driver OS label; '' for pens
	entityId: string;
}

const OS_LABELS: Record<string, string> = { MACOS: 'macOS', WINDOWS: 'Windows' };

// Flatten the grouped periods into a single ordered row list for the table
// view. Period order (and thus sort direction) is preserved from the input;
// within a period the order is tablets, then pens, then drivers — matching the
// timeline view's section order. Empty periods (the "No releases" filler years
// in year mode) contribute no rows.
export function buildTimelineRows(periods: TimelinePeriod[]): TimelineRow[] {
	const rows: TimelineRow[] = [];
	for (const p of periods) {
		const base = {
			periodSort: p.sort,
			year: p.year,
			month: p.month,
			monthUnknown: p.monthUnknown,
		};
		for (const t of p.tablets) {
			rows.push({
				...base,
				category: 'Tablet',
				brand: t.Model.Brand,
				name: t.Model.Name,
				id: t.Model.Id,
				detail: t.Model.Type,
				entityId: t.Meta.EntityId,
			});
		}
		for (const pen of p.pens) {
			rows.push({
				...base,
				category: 'Pen',
				brand: pen.Brand,
				name: pen.PenName,
				id: pen.PenId,
				detail: '',
				entityId: pen.EntityId,
			});
		}
		for (const d of p.drivers) {
			rows.push({
				...base,
				category: 'Driver',
				brand: d.Brand,
				name: d.DriverVersion,
				id: '',
				detail: OS_LABELS[d.OSFamily] ?? d.OSFamily,
				entityId: d.EntityId,
			});
		}
	}
	return rows;
}
