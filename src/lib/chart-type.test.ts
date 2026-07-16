import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
	CHART_TYPE,
	TYPE_SCALE,
	TRACK_WIDE,
	CHART_FONT_FAMILY,
	svgTextStyle,
	chartJsFont,
	type ChartTypeName,
} from './chart-type.js';

const LAYOUT = readFileSync('src/routes/+layout.svelte', 'utf8');
const APP_HTML = readFileSync('src/app.html', 'utf8');

function cssPx(name: string): number {
	const m = LAYOUT.match(new RegExp(`--${name}:\\s*(\\d+)px`));
	if (!m) throw new Error(`--${name} not found in +layout.svelte`);
	return Number(m[1]);
}

describe('chart type scale mirrors the CSS tokens (drift guard)', () => {
	it('TYPE_SCALE equals the --type-* values in +layout.svelte', () => {
		expect(TYPE_SCALE.subhead).toBe(cssPx('type-subhead'));
		expect(TYPE_SCALE.body).toBe(cssPx('type-body'));
		expect(TYPE_SCALE.caption).toBe(cssPx('type-caption'));
		expect(TYPE_SCALE.micro).toBe(cssPx('type-micro'));
	});

	it('TRACK_WIDE equals --track-wide', () => {
		const m = LAYOUT.match(/--track-wide:\s*([\d.]+)em/);
		expect(m).toBeTruthy();
		expect(TRACK_WIDE).toBe(Number(m![1]));
	});

	it('every role size is an actual scale step, never an ad-hoc number', () => {
		const steps = new Set<number>(Object.values(TYPE_SCALE));
		for (const [name, role] of Object.entries(CHART_TYPE)) {
			expect(steps, `role "${name}" size ${role.size} is off-scale`).toContain(role.size);
		}
	});

	it('the chart font family leads with the same face app.html ships', () => {
		// Both should start with Open Sans; a stale 'Google Sans' here is the
		// exact bug this catches.
		expect(CHART_FONT_FAMILY).toMatch(/^'Open Sans'/);
		expect(APP_HTML).toMatch(/family=Open\+Sans/);
	});
});

describe('svgTextStyle', () => {
	it('bakes literal px and an explicit family so export survives without :root', () => {
		const s = svgTextStyle('axisTick');
		expect(s).toContain(`font-size:${TYPE_SCALE.micro}px`);
		expect(s).toContain("font-family:'Open Sans'");
		expect(s).not.toContain('var('); // a token here would vanish on export
	});

	it('emits Metro caps only for the zone role', () => {
		expect(svgTextStyle('zoneLabel')).toContain('text-transform:uppercase');
		expect(svgTextStyle('zoneLabel')).toContain(`letter-spacing:${TRACK_WIDE}em`);
		expect(svgTextStyle('axisTick')).not.toContain('text-transform');
	});

	it('omits letter-spacing when tracking is 0', () => {
		expect(svgTextStyle('axisTitle')).not.toContain('letter-spacing');
	});
});

describe('chartJsFont', () => {
	it('hands Chart.js the shared family and the role size', () => {
		for (const name of Object.keys(CHART_TYPE) as ChartTypeName[]) {
			const f = chartJsFont(name);
			expect(f.family).toBe(CHART_FONT_FAMILY);
			expect(f.size).toBe(CHART_TYPE[name].size);
		}
	});
});
