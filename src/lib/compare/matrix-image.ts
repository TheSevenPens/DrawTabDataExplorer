/**
 * Lay out the Compare spec matrix as an image (#378): positioned text, rules
 * and washes that `CompareMatrixImage.svelte` draws as SVG, which the chart
 * exporter turns into PNG / SVG / PowerPoint.
 *
 * Pure and measurement-free: widths are estimated from the type scale, and a
 * value too long for its column is cut with an ellipsis (the full text is in
 * the Markdown / CSV exports). Colours are tones, not values — the component
 * maps them to tokens and the exporter bakes the computed colours.
 */

import { CHART_TYPE, type ChartTypeName } from '$lib/chart-type.js';
import type { CompareGroup } from '$lib/compare-matrix.js';
import type { SummaryGroup } from './summary';

export interface ImageCell {
	text: string;
	/** A second, dimmer line: "varies", "2 of 3 recorded". */
	sub?: string;
}

export interface MatrixImageInput {
	title: string;
	subtitle?: string;
	/** One per data column: a comparison column (summary) or a member (members). */
	columns: { name: string; color?: string }[];
	/** Members view: comparison columns spanning their members' sub-columns. */
	spans?: { name: string; color?: string; count: number }[];
	sections: {
		title: string;
		rows: { label: string; cells: ImageCell[]; differs: boolean }[];
	}[];
}

export type Tone = 'text' | 'muted' | 'dim';

export interface ImageText {
	x: number;
	y: number;
	text: string;
	role: ChartTypeName;
	tone: Tone;
	anchor: 'start' | 'middle';
}

export interface ImageRect {
	x: number;
	y: number;
	w: number;
	h: number;
	/** 'wash' = a differing row; 'swatch' = a column's identity colour. */
	kind: 'wash' | 'swatch';
	color?: string;
}

export interface ImageRule {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	strong: boolean;
}

export interface MatrixImageLayout {
	width: number;
	height: number;
	texts: ImageText[];
	rects: ImageRect[];
	rules: ImageRule[];
}

const PAD = 16;
const CELL_PAD = 8;
const ROW_H = 22;
const SUB_H = 13;
const SECTION_H = 28;
const LABEL_W = { min: 110, max: 220 };
const COL_W = { min: 96, max: 300 };

/** Rough rendered width of `text` in `role` — no DOM, so an estimate. */
export function estimateWidth(text: string, role: ChartTypeName): number {
	const r = CHART_TYPE[role];
	const perChar = r.size * (r.weight >= 600 ? 0.6 : 0.55) * (r.upper ? 1.15 : 1);
	return text.length * perChar + (r.tracking > 0 ? text.length * r.tracking * r.size : 0);
}

/** `text` cut with an ellipsis to fit `width` in `role`. */
export function fitText(text: string, width: number, role: ChartTypeName): string {
	if (estimateWidth(text, role) <= width) return text;
	let lo = 0;
	let hi = text.length;
	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2);
		if (estimateWidth(text.slice(0, mid) + '…', role) <= width) lo = mid;
		else hi = mid - 1;
	}
	return text.slice(0, lo).trimEnd() + '…';
}

const clamp = (v: number, { min, max }: { min: number; max: number }) =>
	Math.min(max, Math.max(min, Math.ceil(v)));

export function layoutMatrixImage(input: MatrixImageInput): MatrixImageLayout {
	const texts: ImageText[] = [];
	const rects: ImageRect[] = [];
	const rules: ImageRule[] = [];
	const rows = input.sections.flatMap((s) => s.rows);

	const labelW = clamp(
		Math.max(0, ...rows.map((r) => estimateWidth(r.label, 'seriesLabel'))) + CELL_PAD * 2,
		LABEL_W,
	);
	const colW = input.columns.map((c, i) =>
		clamp(
			Math.max(
				estimateWidth(c.name, 'axisTitle') + (c.color ? 14 : 0),
				...rows.map((r) => estimateWidth(r.cells[i]?.text ?? '', 'subtitle')),
			) +
				CELL_PAD * 2,
			COL_W,
		),
	);
	const colX: number[] = [];
	let x = PAD + labelW;
	for (const w of colW) {
		colX.push(x);
		x += w;
	}
	const width = Math.max(x + PAD, 320);
	const right = width - PAD;

	let y = PAD;
	texts.push({
		x: PAD,
		y: y + 14,
		text: input.title,
		role: 'title',
		tone: 'text',
		anchor: 'start',
	});
	y += 24;
	if (input.subtitle) {
		const sub = fitText(input.subtitle, right - PAD, 'subtitle');
		texts.push({ x: PAD, y: y + 10, text: sub, role: 'subtitle', tone: 'muted', anchor: 'start' });
		y += 18;
	}
	y += 8;

	// Members view: the comparison columns span their members.
	if (input.spans) {
		let i = 0;
		for (const span of input.spans) {
			const x0 = colX[i];
			const x1 = (colX[i + span.count - 1] ?? x0) + (colW[i + span.count - 1] ?? 0);
			rects.push({ x: x0 + CELL_PAD, y: y + 3, w: 9, h: 9, kind: 'swatch', color: span.color });
			const name = fitText(span.name, x1 - x0 - CELL_PAD * 2 - 14, 'axisTitle');
			texts.push({
				x: x0 + CELL_PAD + 14,
				y: y + 11,
				text: name,
				role: 'axisTitle',
				tone: 'text',
				anchor: 'start',
			});
			rules.push({ x1: x0 + CELL_PAD, y1: y + 18, x2: x1 - CELL_PAD, y2: y + 18, strong: false });
			i += span.count;
		}
		y += 24;
	}

	// Column heads.
	input.columns.forEach((c, i) => {
		let tx = colX[i] + CELL_PAD;
		if (c.color && !input.spans) {
			rects.push({ x: tx, y: y + 3, w: 9, h: 9, kind: 'swatch', color: c.color });
			tx += 14;
		}
		const name = fitText(c.name, colX[i] + colW[i] - CELL_PAD - tx, 'axisTitle');
		texts.push({ x: tx, y: y + 11, text: name, role: 'axisTitle', tone: 'text', anchor: 'start' });
	});
	y += 20;
	rules.push({ x1: PAD, y1: y, x2: right, y2: y, strong: true });

	for (const section of input.sections) {
		texts.push({
			x: PAD,
			y: y + SECTION_H - 8,
			text: section.title,
			role: 'zoneLabel',
			tone: 'dim',
			anchor: 'start',
		});
		y += SECTION_H;
		rules.push({ x1: PAD, y1: y, x2: right, y2: y, strong: false });
		for (const row of section.rows) {
			const h = ROW_H + (row.cells.some((c) => c.sub) ? SUB_H : 0);
			if (row.differs) rects.push({ x: colX[0], y, w: right - colX[0], h, kind: 'wash' });
			texts.push({
				x: PAD + CELL_PAD,
				y: y + 15,
				text: fitText(row.label, labelW - CELL_PAD * 2, 'seriesLabel'),
				role: 'seriesLabel',
				tone: 'muted',
				anchor: 'start',
			});
			row.cells.forEach((cell, i) => {
				const w = colW[i] - CELL_PAD * 2;
				const tx = colX[i] + CELL_PAD;
				texts.push({
					x: tx,
					y: y + 15,
					text: fitText(cell.text || '—', w, 'subtitle'),
					role: 'subtitle',
					tone: cell.text ? 'text' : 'dim',
					anchor: 'start',
				});
				if (cell.sub)
					texts.push({
						x: tx,
						y: y + 15 + SUB_H,
						text: fitText(cell.sub, w, 'axisTick'),
						role: 'axisTick',
						tone: 'dim',
						anchor: 'start',
					});
			});
			y += h;
			rules.push({ x1: PAD, y1: y, x2: right, y2: y, strong: false });
		}
	}

	return { width, height: y + PAD, texts, rects, rules };
}

type ImageColumn = { name: string; color?: string };

/** The summary view as an image: one data column per comparison column. */
export function summaryImageInput(
	title: string,
	subtitle: string,
	columns: readonly ImageColumn[],
	groups: readonly SummaryGroup[],
): MatrixImageInput {
	return {
		title,
		subtitle,
		columns: [...columns],
		sections: groups.map((g) => ({
			title: g.group,
			rows: g.rows.map((r) => ({
				label: r.label,
				differs: r.differs,
				cells: r.cells.map((c) => ({
					text: c.text,
					sub: [c.varies ? 'varies' : '', c.note].filter(Boolean).join(' · ') || undefined,
				})),
			})),
		})),
	};
}

/**
 * The members view as an image: one data column per member, under a span per
 * comparison column. `members[i]` are column i's member labels, in the order
 * the matrix's values run.
 */
export function membersImageInput(
	title: string,
	subtitle: string,
	columns: readonly ImageColumn[],
	members: readonly (readonly string[])[],
	groups: readonly CompareGroup[],
): MatrixImageInput {
	return {
		title,
		subtitle,
		columns: members.flat().map((name) => ({ name })),
		spans: columns
			.map((c, i) => ({ ...c, count: members[i]?.length ?? 0 }))
			.filter((s) => s.count > 0),
		sections: groups.map((g) => ({
			title: g.group,
			rows: g.fields.map((r) => ({
				label: r.label,
				differs: r.differs,
				cells: r.values.map((text) => ({ text })),
			})),
		})),
	};
}
