/**
 * Shared chart palette for the pressure-response chart and any
 * companion components (legend tables, color swatches, etc).
 *
 * Picking colors at the parent level and threading them through both
 * `<PressureChart>` and `<PressureResponseChartLegendTable>` keeps swatches in the
 * legend in sync with the lines on the chart.
 */
export const CHART_PALETTE = [
	'#2563eb',
	'#d97706',
	'#16a34a',
	'#dc2626',
	'#9333ea',
	'#0891b2',
	'#ca8a04',
	'#db2777',
] as const;

export function paletteColor(index: number): string {
	return CHART_PALETTE[index % CHART_PALETTE.length];
}
