<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		Chart,
		LineController,
		LineElement,
		PointElement,
		LinearScale,
		Tooltip,
		Legend,
		Title,
		Filler,
	} from 'chart.js';
	import type { PressureRecord } from '$data/lib/pressure/interpolate.js';
	import {
		estimateP00,
		estimateP100,
		interpolatePhysical,
	} from '$data/lib/pressure/interpolate.js';

	Chart.register(
		LineController,
		LineElement,
		PointElement,
		LinearScale,
		Tooltip,
		Legend,
		Title,
		Filler,
	);

	export interface ChartSession {
		label: string;
		records: readonly PressureRecord[];
		color?: string;
	}

	type ViewMode = 'raw' | 'estimates' | 'standardized' | 'envelope';
	type ZoomMode = 'normal' | 'iaf' | 'max';
	type EnvelopeRange = 'minmax' | 'p05p95' | 'p25p75';

	let {
		sessions,
		height = 360,
		title = '',
	}: {
		sessions: ChartSession[];
		height?: number;
		title?: string;
	} = $props();

	let viewMode = $state<ViewMode>('estimates');
	let zoomMode = $state<ZoomMode>('normal');
	let envelopeRange = $state<EnvelopeRange>('minmax');

	const PALETTE = [
		'#2563eb',
		'#d97706',
		'#16a34a',
		'#dc2626',
		'#9333ea',
		'#0891b2',
		'#ca8a04',
		'#db2777',
	];

	// Logical pressure percentiles used for standardized + envelope modes.
	const STANDARD_PCTS = [0, 1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 99, 100];

	let canvas: HTMLCanvasElement | undefined = $state();
	let chart: Chart | null = null;

	function colorFor(i: number, override?: string) {
		return override ?? PALETTE[i % PALETTE.length];
	}

	function pctValue(sortedAsc: number[], pct: number): number {
		if (sortedAsc.length === 0) return NaN;
		if (sortedAsc.length === 1) return sortedAsc[0];
		const idx = (pct / 100) * (sortedAsc.length - 1);
		const lo = Math.floor(idx);
		const hi = Math.ceil(idx);
		if (lo === hi) return sortedAsc[lo];
		return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
	}

	/** For each session, return [physicalForce, logicalPct] pairs at the
	 * standard percentile levels (skipping nulls). */
	function standardizeSession(s: ChartSession): { x: number; y: number }[] {
		const out: { x: number; y: number }[] = [];
		for (const p of STANDARD_PCTS) {
			let x: number | null;
			if (p === 0) x = estimateP00(s.records);
			else if (p === 100) x = estimateP100(s.records);
			else x = interpolatePhysical(s.records, p);
			if (x !== null && isFinite(x)) out.push({ x, y: p });
		}
		return out;
	}

	/** Across all sessions at each standard percentile, gather the
	 * interpolated physical values and reduce to (low, mid, high) per the
	 * selected envelope range. */
	function buildEnvelope(sessions: ChartSession[]): {
		low: { x: number; y: number }[];
		mid: { x: number; y: number }[];
		high: { x: number; y: number }[];
	} {
		const low: { x: number; y: number }[] = [];
		const mid: { x: number; y: number }[] = [];
		const high: { x: number; y: number }[] = [];
		const [loP, hiP] =
			envelopeRange === 'minmax' ? [0, 100] : envelopeRange === 'p05p95' ? [5, 95] : [25, 75];
		for (const p of STANDARD_PCTS) {
			const vals: number[] = [];
			for (const s of sessions) {
				let x: number | null;
				if (p === 0) x = estimateP00(s.records);
				else if (p === 100) x = estimateP100(s.records);
				else x = interpolatePhysical(s.records, p);
				if (x !== null && isFinite(x)) vals.push(x);
			}
			if (vals.length === 0) continue;
			vals.sort((a, b) => a - b);
			low.push({ x: pctValue(vals, loP), y: p });
			mid.push({ x: pctValue(vals, 50), y: p });
			high.push({ x: pctValue(vals, hiP), y: p });
		}
		return { low, mid, high };
	}

	function buildDatasets(): any[] {
		if (sessions.length === 0) return [];

		if (viewMode === 'envelope') {
			const { low, mid, high } = buildEnvelope(sessions);
			const color = '#2563eb';
			return [
				{
					type: 'line',
					label: 'Envelope (low)',
					data: low,
					borderColor: color,
					backgroundColor: color + '33',
					borderWidth: 0,
					pointRadius: 0,
					fill: false,
				},
				{
					type: 'line',
					label: `Envelope (${envelopeRange})`,
					data: high,
					borderColor: color,
					backgroundColor: color + '33',
					borderWidth: 0,
					pointRadius: 0,
					fill: '-1',
				},
				{
					type: 'line',
					label: 'Median',
					data: mid,
					borderColor: color,
					backgroundColor: color,
					borderWidth: 2,
					pointRadius: 2.5,
					fill: false,
				},
			];
		}

		if (viewMode === 'standardized') {
			return sessions.map((s, i) => {
				const color = colorFor(i, s.color);
				return {
					type: 'line',
					label: s.label,
					data: standardizeSession(s),
					borderColor: color,
					backgroundColor: color,
					borderWidth: 2,
					pointRadius: 3,
					fill: false,
				};
			});
		}

		// raw or raw + estimates
		const out: any[] = [];
		sessions.forEach((s, i) => {
			const color = colorFor(i, s.color);
			out.push({
				type: 'line',
				label: s.label,
				data: s.records.map(([x, y]) => ({ x, y })),
				borderColor: color,
				backgroundColor: color,
				pointRadius: 2.5,
				pointHoverRadius: 4,
				borderWidth: 2,
				tension: 0,
				fill: false,
			});
			if (viewMode === 'estimates') {
				const p00 = estimateP00(s.records);
				const p100 = estimateP100(s.records);
				if (p00 !== null) {
					out.push({
						type: 'line',
						label: `${s.label} (P00 est.)`,
						data: [
							{ x: p00, y: 0 },
							{ x: s.records[0][0], y: s.records[0][1] },
						],
						borderColor: color,
						borderDash: [6, 4],
						borderWidth: 1.5,
						pointRadius: 0,
						fill: false,
					});
				}
				if (p100 !== null) {
					const last = s.records[s.records.length - 1];
					out.push({
						type: 'line',
						label: `${s.label} (P100 est.)`,
						data: [
							{ x: last[0], y: last[1] },
							{ x: p100, y: 100 },
						],
						borderColor: color,
						borderDash: [6, 4],
						borderWidth: 1.5,
						pointRadius: 0,
						fill: false,
					});
				}
			}
		});
		return out;
	}

	function axisRange(): { x: { min?: number; max?: number }; y: { min: number; max: number } } {
		if (zoomMode === 'iaf') return { x: { min: 0, max: 20 }, y: { min: 0, max: 30 } };
		if (zoomMode === 'max') return { x: {}, y: { min: 95, max: 100 } };
		return { x: { min: 0 }, y: { min: 0, max: 100 } };
	}

	$effect(() => {
		// Re-read reactive deps so $effect picks up changes.
		void sessions;
		void viewMode;
		void zoomMode;
		void envelopeRange;
		if (!canvas) return;
		const datasets = buildDatasets();
		const { x: xRange, y: yRange } = axisRange();
		if (chart) {
			chart.data.datasets = datasets;
			chart.options.scales!.x = {
				type: 'linear',
				title: { display: true, text: 'Physical force (gf)' },
				...xRange,
			};
			chart.options.scales!.y = {
				type: 'linear',
				title: { display: true, text: 'Logical pressure (%)' },
				...yRange,
			};
			chart.update();
			return;
		}
		chart = new Chart(canvas, {
			type: 'line',
			data: { datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				parsing: false,
				scales: {
					x: {
						type: 'linear',
						title: { display: true, text: 'Physical force (gf)' },
						...xRange,
					},
					y: {
						type: 'linear',
						title: { display: true, text: 'Logical pressure (%)' },
						...yRange,
					},
				},
				plugins: {
					title: title ? { display: true, text: title } : undefined,
					legend: {
						position: 'bottom',
						labels: {
							filter: (item) => !(item.text ?? '').includes('est.'),
						},
					},
					tooltip: {
						callbacks: {
							label: (ctx) => {
								const x = ctx.parsed.x ?? 0;
								const y = ctx.parsed.y ?? 0;
								return `${ctx.dataset.label}: ${x.toFixed(1)} gf → ${y.toFixed(1)}%`;
							},
						},
					},
				},
			},
		});
	});

	onDestroy(() => {
		chart?.destroy();
		chart = null;
	});

	function exportFilename() {
		return title.replace(/[^\w-]+/g, '_') || 'pressure-response';
	}

	function chartPngBlob(): Promise<Blob | null> {
		return new Promise((res) => {
			if (!canvas) return res(null);
			canvas.toBlob(res, 'image/png');
		});
	}

	async function copyPng() {
		const blob = await chartPngBlob();
		if (!blob) return;
		try {
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
		} catch (e) {
			console.error('Copy PNG failed:', e);
		}
	}

	async function downloadPng() {
		const blob = await chartPngBlob();
		if (!blob) return;
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${exportFilename()}.png`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function escHtml(s: string) {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function buildTableHtml(): string {
		const headers = ['Session', 'Force (gf)', 'Pressure (%)'];
		const rows = sessions.flatMap((s) =>
			s.records.map(([x, y]) => [s.label, x.toFixed(2), y.toFixed(2)]),
		);
		const head = `<tr>${headers.map((h) => `<th>${escHtml(h)}</th>`).join('')}</tr>`;
		const body = rows
			.map((r) => `<tr>${r.map((c) => `<td>${escHtml(String(c))}</td>`).join('')}</tr>`)
			.join('\n');
		return `<table><thead>${head}</thead><tbody>\n${body}\n</tbody></table>`;
	}

	async function copyData() {
		const html = buildTableHtml();
		try {
			await navigator.clipboard.write([
				new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) }),
			]);
		} catch (e) {
			console.error('Copy data failed:', e);
		}
	}

	function downloadData() {
		const doc = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${escHtml(title || 'Pressure response')}</title>
<style>table{border-collapse:collapse;font-family:sans-serif;font-size:13px}th,td{padding:4px 10px;border-bottom:1px solid #ccc;text-align:left}</style>
</head><body>
<h2>${escHtml(title || 'Pressure response')}</h2>
${buildTableHtml()}
</body></html>`;
		const blob = new Blob([doc], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${exportFilename()}.html`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="chart-toolbar">
	<label>
		View
		<select bind:value={viewMode}>
			<option value="raw">Raw</option>
			<option value="estimates">Raw + estimates</option>
			<option value="standardized">Standardized</option>
			<option value="envelope">Envelope</option>
		</select>
	</label>
	<label>
		Zoom
		<select bind:value={zoomMode}>
			<option value="normal">Normal</option>
			<option value="iaf">IAF detail (0-20 gf)</option>
			<option value="max">Max pressure (95-100%)</option>
		</select>
	</label>
	{#if viewMode === 'envelope'}
		<label>
			Range
			<select bind:value={envelopeRange}>
				<option value="minmax">Min / Max</option>
				<option value="p05p95">P05 / P95</option>
				<option value="p25p75">P25 / P75</option>
			</select>
		</label>
	{/if}
	<span class="spacer"></span>
	<button class="export" type="button" onclick={copyPng} title="Copy chart as PNG to clipboard">
		Copy PNG
	</button>
	<button class="export" type="button" onclick={downloadPng} title="Download chart as PNG">
		↓ PNG
	</button>
	<button class="export" type="button" onclick={copyData} title="Copy data as HTML table">
		Copy data
	</button>
	<button class="export" type="button" onclick={downloadData} title="Download data as HTML">
		↓ HTML
	</button>
</div>

<div class="chart-wrap" style="height: {height}px;">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.chart-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		margin-bottom: 8px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.chart-toolbar label {
		display: inline-flex;
		gap: 6px;
		align-items: center;
	}
	.chart-toolbar select {
		font-size: 12px;
	}
	.spacer {
		flex: 1;
	}
	.export {
		padding: 3px 10px;
		font-size: 12px;
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text);
		border-radius: 4px;
		cursor: pointer;
	}
	.export:hover {
		border-color: #2563eb;
		color: #2563eb;
	}
	.chart-wrap {
		position: relative;
		width: 100%;
	}
</style>
