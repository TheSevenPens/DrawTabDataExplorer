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
	import { paletteColor } from '$lib/chart-palette.js';
	import ChartExportButton from '$lib/components/ChartExportButton.svelte';

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
		/** Stable per-session id used by the parent's hidden-set filter. */
		id?: string;
		label: string;
		records: readonly PressureRecord[];
		color?: string;
		defective?: boolean;
		defectInfo?: string;
	}

	type ViewMode = 'raw' | 'estimates' | 'standardized' | 'envelope';
	type ZoomMode = 'normal' | 'iaf' | 'max';
	type EnvelopeRange = 'minmax' | 'p05p95' | 'p25p75';

	let {
		sessions,
		height = 360,
		title = '',
		hiddenIds,
		lockedZoom,
	}: {
		sessions: ChartSession[];
		height?: number;
		title?: string;
		/** When provided, sessions whose id is in the set are not drawn.
		 * Lets a parent component synchronise visibility with a legend
		 * table or other UI. */
		hiddenIds?: ReadonlySet<string>;
		/** When set, the Zoom dropdown is hidden and zoom is forced to
		 * this value. Use for context-specific embeds (e.g. the Max
		 * Pressure tab) that should always show a particular zoom. */
		lockedZoom?: ZoomMode;
	} = $props();

	let viewMode = $state<ViewMode>('estimates');
	// When lockedZoom is set the parent controls zoom and the dropdown is hidden.
	// Otherwise the user toggles via userZoom; the effective zoomMode is the
	// override (when present) or the user choice.
	let userZoom = $state<ZoomMode>('normal');
	let zoomMode = $derived<ZoomMode>(lockedZoom ?? userZoom);
	let envelopeRange = $state<EnvelopeRange>('minmax');
	// Defective sessions are hidden by default; the toggle appears in the
	// toolbar only when at least one session is flagged.
	let showDefective = $state(false);
	let defectiveCount = $derived(sessions.filter((s) => s.defective).length);
	let visibleSessions = $derived(
		sessions
			.filter((s) => showDefective || !s.defective)
			.filter((s) => !hiddenIds || !s.id || !hiddenIds.has(s.id)),
	);

	// Logical pressure percentiles used for standardized + envelope modes.
	const STANDARD_PCTS = [0, 1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 99, 100];

	let canvas: HTMLCanvasElement | undefined = $state();
	let chart: Chart | null = null;

	function colorFor(i: number, override?: string) {
		return override ?? paletteColor(i);
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
		const sessionsToPlot = visibleSessions;
		if (sessionsToPlot.length === 0) return [];

		if (viewMode === 'envelope') {
			const { low, mid, high } = buildEnvelope(sessionsToPlot);
			const color = '#2563eb';
			// Chart.js between-datasets fills are x-axis-parametric, so when the
			// high line extends past the low line's max x (common at p=99→100),
			// the fill terminates at the low line's right edge and leaves a
			// triangular gap. Trace the envelope as a single closed-polygon
			// dataset and use fill:'shape' to fill the interior instead.
			const polygon = [...low, ...[...high].reverse()];
			return [
				{
					type: 'line',
					label: `Envelope (${envelopeRange})`,
					data: polygon,
					borderColor: 'transparent',
					backgroundColor: color + '33',
					borderWidth: 0,
					pointRadius: 0,
					fill: 'shape',
				},
				{
					type: 'line',
					label: 'Median',
					data: mid,
					borderColor: color,
					backgroundColor: color,
					borderWidth: 2,
					pointRadius: 0,
					fill: false,
				},
			];
		}

		if (viewMode === 'standardized') {
			return sessionsToPlot.map((s, i) => {
				const color = colorFor(i, s.color);
				return {
					type: 'line',
					label: s.defective ? `⚠ ${s.label}` : s.label,
					data: standardizeSession(s),
					borderColor: color,
					backgroundColor: color,
					borderWidth: 2,
					pointRadius: 0,
					fill: false,
				};
			});
		}

		// raw or raw + estimates
		const out: any[] = [];
		sessionsToPlot.forEach((s, i) => {
			const color = colorFor(i, s.color);
			out.push({
				type: 'line',
				label: s.defective ? `⚠ ${s.label}` : s.label,
				data: s.records.map(([x, y]) => ({ x, y })),
				borderColor: color,
				backgroundColor: color,
				borderDash: s.defective ? [3, 3] : undefined,
				pointRadius: 0,
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

	// Largest estimated P100 across the currently-visible sessions.
	// Drives the x-axis right edge in 'max' zoom so the envelope's full
	// extent at y=100 stays in view, regardless of how strong the pen is.
	let maxP100 = $derived.by(() => {
		let m = -Infinity;
		for (const s of visibleSessions) {
			const v = estimateP100(s.records);
			if (v !== null && isFinite(v) && v > m) m = v;
		}
		return m === -Infinity ? null : m;
	});

	function axisRange(): { x: { min?: number; max?: number }; y: { min: number; max: number } } {
		if (zoomMode === 'iaf') return { x: { min: 0, max: 20 }, y: { min: 0, max: 30 } };
		if (zoomMode === 'max') {
			// At least 50 gf of headroom past the largest P100 so the
			// upper-right corner of the envelope isn't clipped. Falls back
			// to 1000 gf when no session has a finite P100.
			const maxX = maxP100 !== null ? maxP100 + 50 : 1000;
			return { x: { max: maxX }, y: { min: 95, max: 100 } };
		}
		return { x: { min: 0, max: 1000 }, y: { min: 0, max: 100 } };
	}

	$effect(() => {
		// Re-read reactive deps so $effect picks up changes.
		void sessions;
		void viewMode;
		void zoomMode;
		void envelopeRange;
		void showDefective;
		void hiddenIds;
		void maxP100;
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
					// Chart.js's native legend is suppressed because the
					// companion <PressureResponseChartLegendTable> below the chart already
					// shows colors, labels, and per-series toggles.
					legend: { display: false },
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
	{#if !lockedZoom}
		<label>
			Zoom
			<select bind:value={userZoom}>
				<option value="normal">Normal</option>
				<option value="iaf">IAF detail (0-20 gf)</option>
				<option value="max">Max pressure (95-100%)</option>
			</select>
		</label>
	{/if}
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
	{#if defectiveCount > 0}
		<label class="defective-toggle" title="Defective sessions are hidden by default">
			<input type="checkbox" bind:checked={showDefective} />
			Show {defectiveCount} defective
		</label>
	{/if}
	<span class="spacer"></span>
	<ChartExportButton
		title={title || 'pressure-response'}
		getCanvas={() => canvas}
		getDataHtml={buildTableHtml}
	/>
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
	.defective-toggle {
		color: #b45309;
		font-weight: 600;
	}
	.chart-wrap {
		position: relative;
		width: 100%;
	}
</style>
