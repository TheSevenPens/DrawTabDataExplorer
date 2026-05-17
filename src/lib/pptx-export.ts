// PowerPoint (.pptx) export helper.
//
// pptxgenjs (~200 KB) is dynamically imported only when the user invokes
// a PowerPoint export, so the main bundle stays unaffected for users who
// never use this format.

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN = 0.5;
const TITLE_H = 0.6;
const CONTENT_TOP = MARGIN + TITLE_H + 0.15;

async function loadPptxGen(): Promise<typeof import('pptxgenjs').default> {
	const mod = await import('pptxgenjs');
	return mod.default;
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

	const date = new Date().toISOString().slice(0, 10);
	const fileName = `${opts.filename}-${date}.pptx`;
	await pres.writeFile({ fileName });
	return fileName;
}
