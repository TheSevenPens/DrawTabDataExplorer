import { getDisplayUnit, formatValue, type UnitPreference } from '$data/lib/units.js';

const LABEL_UNITS = new Set(['mm', 'cm', 'g', 'degrees', 'Hz', 'ms']);

// Units that have a meaningful alternate conversion to show
const CONVERTIBLE_UNITS = new Set(['mm', 'g', 'LPmm', 'px/mm']);

export function stripUnit(label: string, unit: string | undefined): string {
	const m = label.match(/^(.+)\s*\(([^)]+)\)$/);
	if (m && (unit || LABEL_UNITS.has(m[2]))) return m[1].trim();
	return label;
}

export function valueSuffix(label: string, unit: string | undefined, pref: UnitPreference): string {
	if (unit) return ' ' + getDisplayUnit(unit, pref);
	const m = label.match(/\(([^)]+)\)$/);
	return m && LABEL_UNITS.has(m[1]) ? ' ' + m[1] : '';
}

/**
 * Format a value with its primary unit and the alternate conversion in
 * parentheses. E.g. "660 g (23.28 oz)" in metric, "23.28 oz (660 g)" in imperial.
 * Returns just the primary value + unit if no conversion exists.
 */
export function formatValueWithAlt(
	rawValue: string,
	label: string,
	unit: string | undefined,
	pref: UnitPreference,
): string {
	if (!rawValue || rawValue === '-') return rawValue;

	// Display px/mm as px/cm in both modes
	if (unit === 'px/mm') {
		const num = Number(rawValue);
		if (!isNaN(num)) {
			const pxCm = (num * 10).toFixed(1);
			const ppi = formatValue(rawValue, unit, 'imperial');
			if (pref === 'metric') {
				return `${pxCm} px/cm (${ppi} PPI)`;
			} else {
				return `${ppi} PPI (${pxCm} px/cm)`;
			}
		}
	}

	const primaryVal = formatValue(rawValue, unit, pref);
	const primaryUnit = valueSuffix(label, unit, pref);
	const primary = primaryVal + primaryUnit;

	if (!unit || !CONVERTIBLE_UNITS.has(unit)) return primary;

	const altPref: UnitPreference = pref === 'metric' ? 'imperial' : 'metric';
	const altVal = formatValue(rawValue, unit, altPref);
	const altUnit = ' ' + getDisplayUnit(unit, altPref);

	return `${primary} (${altVal}${altUnit})`;
}
