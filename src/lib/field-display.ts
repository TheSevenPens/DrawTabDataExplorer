import { getDisplayUnit, type UnitPreference } from '$data/lib/units.js';

const LABEL_UNITS = new Set(['mm', 'cm', 'g', 'degrees', 'Hz', 'ms']);

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
