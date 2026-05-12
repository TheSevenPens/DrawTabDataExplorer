<script lang="ts">
	// Export trigger for chart components.
	//
	// Two modes:
	//   - SVG mode (caller passes `getSvg`): exports Copy PNG, Copy SVG,
	//     Download PNG, Download SVG. Used by SVG-based charts
	//     (ValueHistogram, BandsChart, TabletDimensionComparison).
	//   - Canvas mode (caller passes `getCanvas`, optionally `getDataHtml`):
	//     exports Copy PNG, Download PNG, and (when getDataHtml is set)
	//     Copy data HTML, Download HTML doc. Used by Chart.js-based charts
	//     (PressureChart).
	//
	// PNG in SVG mode is produced by serializing the SVG, drawing it onto
	// a canvas at 2× scale on a white background (so transparent SVG fills
	// don't produce a transparent PNG). PNG in canvas mode reads from the
	// chart's own canvas directly.
	interface Props {
		title: string;
		filename?: string;
		getSvg?: () => SVGElement | null | undefined;
		getCanvas?: () => HTMLCanvasElement | null | undefined;
		/** Returns an HTML string (a `<table>...`) for the data view. When
		 * present, two extra menu items appear: "Copy data" and
		 * "Download HTML". Only valid in canvas mode. */
		getDataHtml?: () => string;
	}
	let { getSvg, getCanvas, getDataHtml, title, filename }: Props = $props();
	let mode: 'svg' | 'canvas' = $derived(getCanvas ? 'canvas' : 'svg');

	let open = $state(false);
	let toast = $state<string | null>(null);

	function slug(s: string): string {
		return s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	function dateStamp(): string {
		return new Date().toISOString().slice(0, 10);
	}

	function getFilename(ext: string): string {
		const base = filename ?? slug(title || 'chart');
		return `${base}-${dateStamp()}.${ext}`;
	}

	function showToast(msg: string): void {
		toast = msg;
		setTimeout(() => {
			toast = null;
		}, 1500);
	}

	function getSvgString(): string | null {
		const el = getSvg?.();
		if (!el) return null;
		const clone = el.cloneNode(true) as SVGElement;
		if (!clone.getAttribute('xmlns')) {
			clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		}
		return new XMLSerializer().serializeToString(clone);
	}

	function getPixelDims(svgEl: SVGElement, scale = 2): { width: number; height: number } {
		const rect = svgEl.getBoundingClientRect();
		if (rect.width > 0 && rect.height > 0) {
			return { width: Math.round(rect.width * scale), height: Math.round(rect.height * scale) };
		}
		const w = parseFloat(svgEl.getAttribute('width') ?? '');
		const h = parseFloat(svgEl.getAttribute('height') ?? '');
		if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
			return { width: Math.round(w * scale), height: Math.round(h * scale) };
		}
		const vb = svgEl.getAttribute('viewBox')?.split(/\s+/).map(Number);
		if (vb && vb.length === 4 && Number.isFinite(vb[2]) && Number.isFinite(vb[3])) {
			return { width: Math.round(vb[2] * scale), height: Math.round(vb[3] * scale) };
		}
		return { width: 800, height: 600 };
	}

	async function canvasToPngBlob(): Promise<Blob | null> {
		const canvas = getCanvas?.();
		if (!canvas) return null;
		return new Promise<Blob | null>((resolve) => {
			canvas.toBlob((b) => resolve(b), 'image/png');
		});
	}

	async function getPngBlob(): Promise<Blob | null> {
		return mode === 'canvas' ? canvasToPngBlob() : svgToPngBlob();
	}

	async function svgToPngBlob(): Promise<Blob | null> {
		const el = getSvg?.();
		const svgString = getSvgString();
		if (!el || !svgString) return null;
		const { width, height } = getPixelDims(el);

		const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
		const url = URL.createObjectURL(svgBlob);

		try {
			const img = new Image();
			img.src = url;
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error('image load failed'));
			});

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) return null;

			// Paint a light background so transparent SVGs don't produce a
			// transparent PNG when pasted into a dark Word doc / Slack / etc.
			const bgVar = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim();
			ctx.fillStyle = bgVar || '#ffffff';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

			return await new Promise<Blob | null>((resolve) => {
				canvas.toBlob((b) => resolve(b), 'image/png');
			});
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	function triggerDownload(blob: Blob, name: string): void {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	async function copyPng(): Promise<void> {
		open = false;
		const blob = await getPngBlob();
		if (!blob) {
			console.error('PNG export failed');
			return;
		}
		try {
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			showToast('Copied PNG ✓');
		} catch (err) {
			console.error('Copy PNG failed', err);
		}
	}

	async function copySvg(): Promise<void> {
		open = false;
		const svg = getSvgString();
		if (!svg) {
			console.error('SVG missing');
			return;
		}
		try {
			await navigator.clipboard.writeText(svg);
			showToast('Copied SVG ✓');
		} catch (err) {
			console.error('Copy SVG failed', err);
		}
	}

	async function downloadPng(): Promise<void> {
		open = false;
		const blob = await getPngBlob();
		if (!blob) {
			console.error('PNG export failed');
			return;
		}
		triggerDownload(blob, getFilename('png'));
		showToast('Downloaded PNG ✓');
	}

	async function copyDataHtml(): Promise<void> {
		open = false;
		const html = getDataHtml?.();
		if (!html) return;
		try {
			await navigator.clipboard.write([
				new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) }),
			]);
			showToast('Copied data ✓');
		} catch (err) {
			console.error('Copy data failed', err);
		}
	}

	function downloadDataHtml(): void {
		open = false;
		const html = getDataHtml?.();
		if (!html) return;
		const doc = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${escHtml(title || 'chart')}</title>
<style>table{border-collapse:collapse;font-family:sans-serif;font-size:13px}th,td{padding:4px 10px;border-bottom:1px solid #ccc;text-align:left}</style>
</head><body>
<h2>${escHtml(title || 'chart')}</h2>
${html}
</body></html>`;
		triggerDownload(new Blob([doc], { type: 'text/html' }), getFilename('html'));
		showToast('Downloaded HTML ✓');
	}

	function escHtml(s: string): string {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function downloadSvg(): void {
		open = false;
		const svg = getSvgString();
		if (!svg) {
			console.error('SVG missing');
			return;
		}
		triggerDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), getFilename('svg'));
		showToast('Downloaded SVG ✓');
	}

	function onWindowClick(): void {
		if (open) open = false;
	}
</script>

<svelte:window onclick={onWindowClick} />

<div class="export-wrap">
	<button
		type="button"
		class="export-trigger"
		onclick={(e) => {
			e.stopPropagation();
			open = !open;
		}}
	>
		{toast ?? 'Export ▾'}
	</button>
	{#if open}
		<div class="dropdown">
			{#if mode === 'svg'}
				<button type="button" class="item" onclick={copyPng}>Copy as PNG</button>
				<button type="button" class="item" onclick={copySvg}>Copy as SVG</button>
				<div class="separator" role="separator"></div>
				<button type="button" class="item" onclick={downloadPng}>Download PNG</button>
				<button type="button" class="item" onclick={downloadSvg}>Download SVG</button>
			{:else}
				<button type="button" class="item" onclick={copyPng}>Copy as PNG</button>
				{#if getDataHtml}
					<button type="button" class="item" onclick={copyDataHtml}>Copy data as HTML</button>
				{/if}
				<div class="separator" role="separator"></div>
				<button type="button" class="item" onclick={downloadPng}>Download PNG</button>
				{#if getDataHtml}
					<button type="button" class="item" onclick={downloadDataHtml}>Download HTML</button>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.export-wrap {
		position: relative;
		display: inline-block;
	}
	.export-trigger {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		font-size: 12px;
		border: 1px solid var(--border, #ccc);
		border-radius: 4px;
		background: var(--bg-card, #fff);
		color: var(--text-muted, #666);
		cursor: pointer;
	}
	.export-trigger:hover {
		border-color: var(--text-dim, #999);
		color: var(--text, #333);
	}
	.dropdown {
		position: absolute;
		top: calc(100% + 2px);
		right: 0;
		background: var(--bg-card, #fff);
		border: 1px solid var(--border, #ccc);
		border-radius: 4px;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
		z-index: 50;
		min-width: 11rem;
		padding: 4px 0;
	}
	.item {
		display: block;
		width: 100%;
		padding: 0.4rem 0.8rem;
		font-size: 0.9rem;
		text-align: left;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text, #333);
	}
	.item:hover {
		background: var(--hover-bg, #f0f0f0);
	}
	.separator {
		height: 1px;
		background: var(--border-light, #e0e0e0);
		margin: 4px 0;
	}
</style>
