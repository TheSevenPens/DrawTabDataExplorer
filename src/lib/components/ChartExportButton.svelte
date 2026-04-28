<script lang="ts">
	// Export trigger for chart components (currently SVG-based).
	//
	// Caller passes `getSvg`, a function that returns the live SVG element
	// of its chart, plus a `title` used for the download filename. The
	// component renders a small "Export ▾" dropdown with four actions:
	// Copy PNG, Copy SVG, Download PNG, Download SVG.
	//
	// PNG is produced by serializing the SVG, drawing it onto a canvas at
	// 2× scale on a white background (so transparent SVG fills don't
	// produce a transparent PNG), and exporting via canvas.toBlob.
	interface Props {
		getSvg: () => SVGElement | null | undefined;
		title: string;
		filename?: string;
	}
	let { getSvg, title, filename }: Props = $props();

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
		const el = getSvg();
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

	async function svgToPngBlob(): Promise<Blob | null> {
		const el = getSvg();
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
		const blob = await svgToPngBlob();
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
		const blob = await svgToPngBlob();
		if (!blob) {
			console.error('PNG export failed');
			return;
		}
		triggerDownload(blob, getFilename('png'));
		showToast('Downloaded PNG ✓');
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

	async function downloadPptx(): Promise<void> {
		open = false;
		showToast('Building PPTX…');
		const blob = await svgToPngBlob();
		if (!blob) {
			console.error('PNG export failed');
			return;
		}
		const el = getSvg();
		const dims = el ? getPixelDims(el) : { width: 800, height: 600 };
		try {
			const { exportChartAsPptx } = await import('$lib/pptx-export.js');
			const base = filename ?? slug(title || 'chart');
			await exportChartAsPptx({
				pngBlob: blob,
				pngWidth: dims.width,
				pngHeight: dims.height,
				title: title || 'Chart',
				filename: base,
			});
			showToast('Downloaded PPTX ✓');
		} catch (err) {
			console.error('PPTX export failed', err);
		}
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
		<div class="dropdown" role="menu" onclick={(e) => e.stopPropagation()}>
			<button type="button" class="item" onclick={copyPng}>Copy as PNG</button>
			<button type="button" class="item" onclick={copySvg}>Copy as SVG</button>
			<div class="separator" role="separator"></div>
			<button type="button" class="item" onclick={downloadPng}>Download PNG</button>
			<button type="button" class="item" onclick={downloadSvg}>Download SVG</button>
			<button type="button" class="item" onclick={downloadPptx}>Download PowerPoint</button>
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
