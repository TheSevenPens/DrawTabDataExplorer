/**
 * Regenerates the two IAF-over-time panels embedded in `docs/WEBMCP.md`.
 *
 *   npx tsx scripts/gen-webmcp-chart.ts
 *
 * Emits a light and a dark SVG (the repo rule is that the two modes are
 * separately chosen steps, never a flip — see CLAUDE.md § Chart colours).
 * Text is baked with literal px sizes and an explicit family because a
 * standalone SVG has no `:root` for `var()` to resolve against, same reason
 * `svgTextStyle` exists for in-app exports.
 *
 * The four-brand cap is not cosmetic: the categorical palette was validated
 * for four slots in both modes, and a fifth series failed all-pairs CVD
 * separation. Brands beyond the top four by datapoint count are named in a
 * footnote rather than silently dropped.
 */
import { writeFileSync } from 'node:fs';
import { createDiskDataSet } from '../data-repo/lib/dataset-node.js';
import { resolveRangeByUnit } from '../data-repo/lib/pressure/range-resolve.js';

const FAMILY = "'Open Sans','Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,sans-serif";

type Mode = 'light' | 'dark';
const THEME = {
	light: {
		surface: '#fcfcfb',
		ink: '#0b0b0b',
		sub: '#52514e',
		muted: '#898781',
		grid: '#e1e0d9',
		axis: '#c3c2b7',
		series: ['#2a78d6', '#eda100', '#e87ba4', '#008300'],
		pro: '#2a78d6',
		con: '#eb6834',
	},
	dark: {
		surface: '#1a1a19',
		ink: '#f0efec',
		sub: '#c3c2b7',
		muted: '#898781',
		grid: '#2c2c2a',
		axis: '#383835',
		series: ['#3987e5', '#c98500', '#d55181', '#008300'],
		pro: '#3987e5',
		con: '#d95926',
	},
} satisfies Record<Mode, Record<string, unknown>>;

const SHAPES = ['circle', 'triangle', 'square', 'diamond'] as const;
const DASHES = ['', '7 4', '3 3', '9 3 2 3'];

const W = 720;
const PL = 58;
const PR = 704;
const PW = PR - PL;
const PH = 252;
const P1T = 60;
const P2T = 430;
const X0 = 1996;
const X1 = 2028;
const YMAX = 14;
const H = 760;

const x = (yr: number) => PL + ((yr - X0) * PW) / (X1 - X0);
const y = (top: number, v: number) => top + PH - (v / YMAX) * PH;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r2 = (n: number) => Math.round(n * 100) / 100;

const med = (xs: number[]) => {
	const s = [...xs].sort((a, b) => a - b);
	const m = Math.floor(s.length / 2);
	return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
};
const fit = (pts: { yr: number; v: number }[]) => {
	const n = pts.length;
	const mx = pts.reduce((a, p) => a + p.yr, 0) / n;
	const my = pts.reduce((a, p) => a + p.v, 0) / n;
	const num = pts.reduce((a, p) => a + (p.yr - mx) * (p.v - my), 0);
	const den = pts.reduce((a, p) => a + (p.yr - mx) ** 2, 0);
	const slope = den === 0 ? 0 : num / den;
	return { slope, at: (yr: number) => my + slope * (yr - mx) };
};

// ---------------------------------------------------------------- load data

const ds = createDiskDataSet({ dataDir: 'data-repo/data', userId: 'sevenpens' });
const [pens, sessions, ranges, brands] = await Promise.all([
	ds.Pens.toArray(),
	ds.PressureResponse.toArray(),
	ds.PressureRange.toArray(),
	ds.Brands.toArray(),
]);

const brandLabel = new Map(
	brands.map((b) => [b.EntityId.toUpperCase(), b.BrandName ?? b.EntityId]),
);

const perUnit = resolveRangeByUnit('IAF', sessions, ranges);
const vals = new Map<string, number[]>();
for (const u of perUnit) {
	if (!vals.has(u.penEntityId)) vals.set(u.penEntityId, []);
	vals.get(u.penEntityId)!.push(u.value);
}

type Pt = { yr: number; v: number; brand: string; name: string };
const points: Pt[] = [];
for (const p of pens) {
	const vs = vals.get(p.EntityId);
	const yr = p.ReleaseYear ? Number(p.ReleaseYear) : NaN;
	if (!vs || !Number.isFinite(yr)) continue;
	points.push({ yr, v: r2(med(vs)), brand: p.Brand, name: p.PenName });
}

const byBrand = new Map<string, Pt[]>();
for (const pt of points) {
	if (!byBrand.has(pt.brand)) byBrand.set(pt.brand, []);
	byBrand.get(pt.brand)!.push(pt);
}
const ranked = [...byBrand.entries()].sort((a, b) => b[1].length - a[1].length);
const shown = ranked.slice(0, 4);
const omitted = ranked.slice(4);

// Panel 2 is deliberately Wacom-specific: it exists to show one real
// aggregation reversal, not as a general facet. "One" is Wacom's consumer
// line; every other Wacom pen here is Intuos / Pro / Art.
const wacom = byBrand.get('WACOM') ?? [];
const pro = wacom.filter((p) => !/One/.test(p.name));
const con = wacom.filter((p) => /One/.test(p.name));

// ------------------------------------------------------------------- render

function mark(shape: string, cx: number, cy: number, fill: string, ring: string) {
	const common = `fill="${fill}" stroke="${ring}" stroke-width="2"`;
	if (shape === 'circle') return `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="5" ${common}/>`;
	if (shape === 'square')
		return `<rect x="${r2(cx - 4.5)}" y="${r2(cy - 4.5)}" width="9" height="9" ${common}/>`;
	if (shape === 'triangle')
		return `<path d="M${r2(cx)},${r2(cy - 6)} L${r2(cx + 5.5)},${r2(cy + 4.5)} L${r2(cx - 5.5)},${r2(cy + 4.5)} Z" ${common}/>`;
	return `<path d="M${r2(cx)},${r2(cy - 6)} L${r2(cx + 6)},${r2(cy)} L${r2(cx)},${r2(cy + 6)} L${r2(cx - 6)},${r2(cy)} Z" ${common}/>`;
}

function text(s: string, tx: number, ty: number, size: number, fill: string, extra = '') {
	return `<text x="${r2(tx)}" y="${r2(ty)}" font-family="${FAMILY}" font-size="${size}" fill="${fill}" ${extra}>${esc(s)}</text>`;
}

function axes(t: (typeof THEME)['light'], top: number) {
	const o: string[] = [];
	for (let v = 0; v <= YMAX; v += 2) {
		const gy = y(top, v);
		o.push(
			`<line x1="${PL}" y1="${r2(gy)}" x2="${PR}" y2="${r2(gy)}" stroke="${t.grid}" stroke-width="1"/>`,
		);
		o.push(text(`${v} gf`, PL - 8, gy + 4, 11, t.muted, 'text-anchor="end"'));
	}
	for (let yr = X0; yr <= X1; yr += 4) {
		o.push(text(String(yr), x(yr), top + PH + 20, 11, t.muted, 'text-anchor="middle"'));
	}
	o.push(
		`<line x1="${PL}" y1="${r2(top + PH)}" x2="${PR}" y2="${r2(top + PH)}" stroke="${t.axis}" stroke-width="1"/>`,
	);
	o.push(text('release year', (PL + PR) / 2, top + PH + 40, 11, t.muted, 'text-anchor="middle"'));
	o.push(
		text(
			'measured IAF',
			18,
			top + PH / 2,
			11,
			t.muted,
			`text-anchor="middle" transform="rotate(-90 18 ${r2(top + PH / 2)})"`,
		),
	);
	return o.join('');
}

function legend(
	items: { label: string; color: string; shape?: string; dash?: string }[],
	ty: number,
	t: (typeof THEME)['light'],
) {
	const o: string[] = [];
	let cx = PL;
	for (const it of items) {
		if (it.shape) o.push(mark(it.shape, cx + 6, ty - 4, it.color, t.surface));
		else
			o.push(
				`<line x1="${cx}" y1="${ty - 4}" x2="${cx + 14}" y2="${ty - 4}" stroke="${it.color}" stroke-width="2" stroke-dasharray="${it.dash ?? ''}"/>`,
			);
		o.push(text(it.label, cx + 19, ty, 11, t.sub));
		cx += 19 + it.label.length * 5.9 + 20;
	}
	return o.join('');
}

function render(mode: Mode) {
	const t = THEME[mode];
	const o: string[] = [];
	o.push(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="ttl desc">`,
	);
	o.push(
		`<title id="ttl">Measured pen initial activation force by release year</title>`,
		`<desc id="desc">Top panel: measured IAF against release year for the four best-covered brands, with a fitted trend line each. Bottom panel: Wacom alone, split into pro and consumer product lines, where both sub-groups trend downward while the combined fit trends upward.</desc>`,
	);
	o.push(`<rect width="${W}" height="${H}" fill="${t.surface}"/>`);

	// --- panel 1
	o.push(text('Measured IAF by release year — lower is better', PL, 24, 14, t.ink));
	o.push(
		legend(
			shown.map(([b], i) => ({
				label: `${brandLabel.get(b) ?? b} (n=${byBrand.get(b)!.length})`,
				color: t.series[i],
				shape: SHAPES[i],
			})),
			46,
			t,
		),
	);
	o.push(axes(t, P1T));
	shown.forEach(([, pts], i) => {
		if (pts.length >= 3) {
			const f = fit(pts.map((p) => ({ yr: p.yr, v: p.v })));
			const a = Math.min(...pts.map((p) => p.yr));
			const b = Math.max(...pts.map((p) => p.yr));
			o.push(
				`<line x1="${r2(x(a))}" y1="${r2(y(P1T, f.at(a)))}" x2="${r2(x(b))}" y2="${r2(y(P1T, f.at(b)))}" stroke="${t.series[i]}" stroke-width="2" stroke-dasharray="${DASHES[i]}" stroke-linecap="round"/>`,
			);
		}
		for (const p of pts) o.push(mark(SHAPES[i], x(p.yr), y(P1T, p.v), t.series[i], t.surface));
	});

	// --- panel 2
	o.push(text('Wacom alone — both sub-lines fall, the combined fit rises', PL, 394, 14, t.ink));
	const fPro = fit(pro.map((p) => ({ yr: p.yr, v: p.v })));
	const fAll = fit(wacom.map((p) => ({ yr: p.yr, v: p.v })));
	const sgn = (n: number) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2);
	o.push(
		legend(
			[
				{
					label: `Pro line (n=${pro.length}, ${sgn(fPro.slope)} gf/yr)`,
					color: t.pro,
					shape: 'circle',
				},
				{ label: `Consumer One (n=${con.length})`, color: t.con, shape: 'triangle' },
				{ label: `Combined fit (${sgn(fAll.slope)} gf/yr)`, color: t.muted, dash: '7 4' },
			],
			416,
			t,
		),
	);
	o.push(axes(t, P2T));
	const yrA = Math.min(...wacom.map((p) => p.yr));
	const yrB = Math.max(...wacom.map((p) => p.yr));
	o.push(
		`<line x1="${r2(x(yrA))}" y1="${r2(y(P2T, fAll.at(yrA)))}" x2="${r2(x(yrB))}" y2="${r2(y(P2T, fAll.at(yrB)))}" stroke="${t.muted}" stroke-width="2" stroke-dasharray="7 4" stroke-linecap="round"/>`,
	);
	o.push(
		`<line x1="${r2(x(yrA))}" y1="${r2(y(P2T, fPro.at(yrA)))}" x2="${r2(x(yrB))}" y2="${r2(y(P2T, fPro.at(yrB)))}" stroke="${t.pro}" stroke-width="2" stroke-linecap="round"/>`,
	);
	if (con.length >= 2) {
		const fCon = fit(con.map((p) => ({ yr: p.yr, v: p.v })));
		const a = Math.min(...con.map((p) => p.yr));
		const b = Math.max(...con.map((p) => p.yr));
		o.push(
			`<line x1="${r2(x(a))}" y1="${r2(y(P2T, fCon.at(a)))}" x2="${r2(x(b))}" y2="${r2(y(P2T, fCon.at(b)))}" stroke="${t.con}" stroke-width="2" stroke-linecap="round"/>`,
		);
	}
	for (const p of pro) o.push(mark('circle', x(p.yr), y(P2T, p.v), t.pro, t.surface));
	for (const p of con) o.push(mark('triangle', x(p.yr), y(P2T, p.v), t.con, t.surface));

	const note = omitted.length
		? `${points.length - omitted.reduce((a, [, v]) => a + v.length, 0)} of ${points.length} pens shown; omitted for palette limits: ` +
			omitted.map(([b, v]) => `${brandLabel.get(b) ?? b} (n=${v.length})`).join(', ')
		: `all ${points.length} pens with a measured IAF and a release year`;
	o.push(text(note, PL, H - 14, 11, t.muted));
	o.push('</svg>');
	return o.join('\n');
}

for (const mode of ['light', 'dark'] as Mode[]) {
	const path = `docs/images/webmcp-iaf-trend-${mode}.svg`;
	writeFileSync(path, render(mode) + '\n');
	console.log('wrote', path);
}
console.log(
	`points=${points.length} shown=${shown.map(([b]) => b).join(',')} omitted=${omitted.map(([b]) => b).join(',') || 'none'}`,
);
