// Grouping behind the inventory Timeline tab (#80): units by the date they
// were ordered, newest first — year, then month.
//
// OrderDate is "YYYY-MM-DD" for almost every unit, but a few are empty or
// "UNKNOWN". Those are returned separately as `undated` rather than dropped:
// a timeline of what you own that silently leaves units out answers "do I
// have one?" wrongly. A "YYYY" or "YYYY-MM" date is kept, in a no-month /
// no-day position at the end of its year / month.

export interface OrderMonth<T> {
	/** 1–12, or null when the date gives only a year. */
	month: number | null;
	units: T[];
}

export interface OrderYear<T> {
	year: string;
	count: number;
	months: OrderMonth<T>[];
}

export interface OrderTimeline<T> {
	years: OrderYear<T>[];
	undated: T[];
}

interface Unit {
	OrderDate?: string;
	InventoryId: string;
}

const DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

export function groupByOrderDate<T extends Unit>(units: readonly T[]): OrderTimeline<T> {
	const dated: { unit: T; key: string; year: string; month: number | null }[] = [];
	const undated: T[] = [];
	for (const unit of units) {
		const m = DATE.exec((unit.OrderDate ?? '').trim());
		if (!m) {
			undated.push(unit);
			continue;
		}
		const month = m[2] ? Number(m[2]) : null;
		// Missing parts sort as "00" so, newest-first, they land after the
		// dated entries of the same year / month.
		const key = `${m[1]}-${m[2] ?? '00'}-${m[3] ?? '00'}`;
		dated.push({ unit, key, year: m[1], month });
	}
	// Newest first; same day in InventoryId order, so the result is stable.
	dated.sort((a, b) =>
		a.key === b.key ? a.unit.InventoryId.localeCompare(b.unit.InventoryId) : a.key < b.key ? 1 : -1,
	);

	const years: OrderYear<T>[] = [];
	for (const d of dated) {
		let y = years.at(-1);
		if (!y || y.year !== d.year) {
			y = { year: d.year, count: 0, months: [] };
			years.push(y);
		}
		let mo = y.months.at(-1);
		if (!mo || mo.month !== d.month) {
			mo = { month: d.month, units: [] };
			y.months.push(mo);
		}
		mo.units.push(d.unit);
		y.count++;
	}
	undated.sort((a, b) => a.InventoryId.localeCompare(b.InventoryId));
	return { years, undated };
}
