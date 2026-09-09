// PowerPoint (.pptx) export helper.
//
// pptxgenjs (~200 KB) is dynamically imported only when the user invokes
// a PowerPoint export, so the main bundle stays unaffected for users who
// never use this format.

import { datedFilename } from '$lib/chart-export/filenames.js';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN = 0.5;
const TITLE_H = 0.6;
const CONTENT_TOP = MARGIN + TITLE_H + 0.15;

async function loadPptxGen(): Promise<typeof import('pptxgenjs').default> {
	const mod = await import('pptxgenjs');
	return mod.default;
}

/**
 * Largest w x h with the given aspect ratio that fits inside the box —
 * "contain", not "cover", so a chart is never cropped to fill the slide.
 * A non-finite or non-positive aspect falls back to filling the box, which
 * is what an image of unknown size should do.
 */
export function fitContain(
	availW: number,
	availH: number,
	aspect: number,
): { w: number; h: number } {
	if (!Number.isFinite(aspect) || aspect <= 0) return { w: availW, h: availH };
	const h = availW / aspect;
	if (h <= availH) return { w: availW, h };
	return { w: availH * aspect, h: availH };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error ?? new Error('could not read blob'));
		reader.readAsDataURL(blob);
	});
}

function distributeWidths(n: number, totalW: number): number[] {
	if (n <= 0) return [totalW];
	return Array.from({ length: n }, () => totalW / n);
}

interface ExportTableOpts {
	headers: string[];
	rows: (string | number)[][];
	title: string;
	/** Filename without extension or date stamp. */
	filename: string;
	/** How many data rows to fit on each slide. Must be >= 1. */
	rowsPerSlide: number;
}

/**
 * Build a multi-slide PPTX with one chunk of rows per slide, then trigger
 * a download. Returns the filename written.
 */
export async function exportTableAsPptx(opts: ExportTableOpts): Promise<string> {
	const PptxGenJS = await loadPptxGen();
	const pres = new PptxGenJS();
	pres.layout = 'LAYOUT_WIDE';

	const perSlide = Math.max(1, Math.floor(opts.rowsPerSlide));
	const chunks: (string | number)[][][] = [];
	for (let i = 0; i < opts.rows.length; i += perSlide) {
		chunks.push(opts.rows.slice(i, i + perSlide));
	}
	if (chunks.length === 0) chunks.push([]);

	const tableW = SLIDE_W - 2 * MARGIN;
	const tableH = SLIDE_H - CONTENT_TOP - MARGIN;
	const colW = distributeWidths(opts.headers.length, tableW);

	chunks.forEach((chunk, idx) => {
		const slide = pres.addSlide();
		const slideTitle =
			chunks.length > 1 ? `${opts.title}  (${idx + 1}/${chunks.length})` : opts.title;

		slide.addText(slideTitle, {
			x: MARGIN,
			y: MARGIN,
			w: SLIDE_W - 2 * MARGIN,
			h: TITLE_H,
			fontSize: 22,
			bold: true,
			color: '111111',
		});

		const ppRows: { text: string; options?: Record<string, unknown> }[][] = [];
		ppRows.push(
			opts.headers.map((h) => ({
				text: String(h),
				options: { bold: true, fill: { color: 'EEEEEE' } },
			})),
		);
		for (const r of chunk) {
			ppRows.push(r.map((c) => ({ text: c == null ? '' : String(c) })));
		}

		slide.addTable(ppRows as never, {
			x: MARGIN,
			y: CONTENT_TOP,
			w: tableW,
			h: tableH,
			fontSize: 10,
			colW,
			border: { type: 'solid', color: 'CCCCCC', pt: 0.5 },
			valign: 'middle',
		});
	});

	const fileName = datedFilename(opts.filename, 'pptx');
	await pres.writeFile({ fileName });
	return fileName;
}

interface ExportChartOpts {
	/** PNG bytes of the rendered chart. */
	pngBlob: Blob;
	/** Intrinsic pixel size of the PNG, used to preserve aspect ratio.
	 * Omit and the image fills the content area. */
	pngWidth?: number;
	pngHeight?: number;
	title: string;
	/** Filename without extension or date stamp. */
	filename: string;
}

/**
 * Build a single-slide PPTX with a title and the chart embedded as a PNG,
 * then trigger a download. Returns the filename written.
 *
 * The PNG is expected to come from `ChartExportButton`'s existing pipeline,
 * which has already flattened computed colours and fonts onto the SVG — so
 * the slide matches what is on screen, current theme included, rather than
 * falling back to unresolved `var()` colours.
 */
export async function exportChartAsPptx(opts: ExportChartOpts): Promise<string> {
	const PptxGenJS = await loadPptxGen();
	const pres = new PptxGenJS();
	pres.layout = 'LAYOUT_WIDE';
	const slide = pres.addSlide();

	slide.addText(opts.title, {
		x: MARGIN,
		y: MARGIN,
		w: SLIDE_W - 2 * MARGIN,
		h: TITLE_H,
		fontSize: 22,
		bold: true,
		color: '111111',
	});

	const availW = SLIDE_W - 2 * MARGIN;
	const availH = SLIDE_H - CONTENT_TOP - MARGIN;
	const aspect = opts.pngWidth && opts.pngHeight ? opts.pngWidth / opts.pngHeight : Number.NaN;
	const { w, h } = fitContain(availW, availH, aspect);

	slide.addImage({
		data: await blobToDataUrl(opts.pngBlob),
		x: MARGIN + (availW - w) / 2,
		y: CONTENT_TOP + (availH - h) / 2,
		w,
		h,
	});

	const fileName = datedFilename(opts.filename, 'pptx');
	await pres.writeFile({ fileName });
	return fileName;
}
