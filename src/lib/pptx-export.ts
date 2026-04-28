// PowerPoint (.pptx) export helpers.
//
// `pptxgenjs` (~200 KB) is dynamically imported only when the user
// invokes a PPT export, so the main bundle stays unaffected for users
// who never use this format.
//
// Slides use the library's default 16:9 widescreen layout. The slide
// content area below is sized as 13.333 × 7.5 inches.

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN = 0.5;
const TITLE_H = 0.6;
const CONTENT_TOP = MARGIN + TITLE_H + 0.15;

function dateStamp(): string {
	return new Date().toISOString().slice(0, 10);
}

function pptxFilename(base: string): string {
	return `${base}-${dateStamp()}.pptx`;
}

async function loadPptxGen(): Promise<typeof import('pptxgenjs').default> {
	const mod = await import('pptxgenjs');
	return mod.default;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error ?? new Error('read failed'));
		reader.readAsDataURL(blob);
	});
}

interface ExportTableOpts {
	headers: string[];
	rows: (string | number)[][];
	title: string;
	filename: string;
}

/**
 * Build a single-slide PPTX with a title and a native PowerPoint table,
 * then trigger a download. Returns the filename written.
 */
export async function exportTableAsPptx(opts: ExportTableOpts): Promise<string> {
	const PptxGenJS = await loadPptxGen();
	const pres = new PptxGenJS();
	pres.layout = 'LAYOUT_WIDE';
	const slide = pres.addSlide();

	// Title
	slide.addText(opts.title, {
		x: MARGIN,
		y: MARGIN,
		w: SLIDE_W - 2 * MARGIN,
		h: TITLE_H,
		fontSize: 22,
		bold: true,
		color: '111111',
	});

	// Table — first row is header (bold), the rest are data
	const ppRows: { text: string; options?: Record<string, unknown> }[][] = [];
	ppRows.push(
		opts.headers.map((h) => ({
			text: String(h),
			options: { bold: true, fill: { color: 'EEEEEE' } },
		})),
	);
	for (const r of opts.rows) {
		ppRows.push(r.map((c) => ({ text: c == null ? '' : String(c) })));
	}

	const tableW = SLIDE_W - 2 * MARGIN;
	const tableH = SLIDE_H - CONTENT_TOP - MARGIN;
	slide.addTable(ppRows as any, {
		x: MARGIN,
		y: CONTENT_TOP,
		w: tableW,
		h: tableH,
		fontSize: 10,
		colW: distributeWidths(opts.headers.length, tableW),
		border: { type: 'solid', color: 'CCCCCC', pt: 0.5 },
		valign: 'middle',
		autoPage: true,
		autoPageRepeatHeader: true,
		autoPageSlideStartY: CONTENT_TOP,
	});

	const filename = pptxFilename(opts.filename);
	await pres.writeFile({ fileName: filename });
	return filename;
}

function distributeWidths(n: number, totalW: number): number[] {
	if (n <= 0) return [totalW];
	const w = totalW / n;
	return Array.from({ length: n }, () => w);
}

interface ExportChartOpts {
	/** PNG bytes of the rendered chart. */
	pngBlob: Blob;
	/** Optional intrinsic pixel dimensions of the PNG, used to preserve aspect ratio. */
	pngWidth?: number;
	pngHeight?: number;
	title: string;
	filename: string;
}

/**
 * Build a single-slide PPTX with a title and the chart embedded as a PNG,
 * then trigger a download. Returns the filename written.
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

	const dataUrl = await blobToDataUrl(opts.pngBlob);

	// Fit the image into the available content area, preserving aspect ratio.
	const availW = SLIDE_W - 2 * MARGIN;
	const availH = SLIDE_H - CONTENT_TOP - MARGIN;
	const aspect =
		opts.pngWidth && opts.pngHeight && opts.pngWidth > 0 && opts.pngHeight > 0
			? opts.pngWidth / opts.pngHeight
			: availW / availH;

	let w = availW;
	let h = w / aspect;
	if (h > availH) {
		h = availH;
		w = h * aspect;
	}
	const x = MARGIN + (availW - w) / 2;
	const y = CONTENT_TOP + (availH - h) / 2;

	slide.addImage({ data: dataUrl, x, y, w, h });

	const filename = pptxFilename(opts.filename);
	await pres.writeFile({ fileName: filename });
	return filename;
}
