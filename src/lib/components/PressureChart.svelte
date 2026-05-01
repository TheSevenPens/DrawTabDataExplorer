<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
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
	import { estimateP00, estimateP100 } from '$data/lib/pressure/interpolate.js';

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

	let {
		sessions,
		showEstimates = true,
		height = 360,
	}: { sessions: ChartSession[]; showEstimates?: boolean; height?: number } = $props();

	// Default palette — picks one per session in order.
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

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	function buildDatasets() {
		const datasets: any[] = [];
		sessions.forEach((s, i) => {
			const color = s.color ?? PALETTE[i % PALETTE.length];
			datasets.push({
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
			if (showEstimates) {
				const p00 = estimateP00(s.records);
				const p100 = estimateP100(s.records);
				const tail: { x: number; y: number }[] = [];
				if (p00 !== null) tail.push({ x: p00, y: 0 });
				tail.push({ x: s.records[0][0], y: s.records[0][1] });
				const head: { x: number; y: number }[] = [];
				const last = s.records[s.records.length - 1];
				head.push({ x: last[0], y: last[1] });
				if (p100 !== null) head.push({ x: p100, y: 100 });
				if (tail.length > 1) {
					datasets.push({
						type: 'line',
						label: `${s.label} (P00 est.)`,
						data: tail,
						borderColor: color,
						borderDash: [6, 4],
						borderWidth: 1.5,
						pointRadius: 0,
						fill: false,
						showLine: true,
					});
				}
				if (head.length > 1) {
					datasets.push({
						type: 'line',
						label: `${s.label} (P100 est.)`,
						data: head,
						borderColor: color,
						borderDash: [6, 4],
						borderWidth: 1.5,
						pointRadius: 0,
						fill: false,
						showLine: true,
					});
				}
			}
		});
		return datasets;
	}

	$effect(() => {
		if (!canvas) return;
		if (chart) {
			chart.data.datasets = buildDatasets();
			chart.update();
			return;
		}
		chart = new Chart(canvas, {
			type: 'line',
			data: { datasets: buildDatasets() },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				parsing: false,
				scales: {
					x: {
						type: 'linear',
						title: { display: true, text: 'Physical force (gf)' },
						beginAtZero: true,
					},
					y: {
						type: 'linear',
						title: { display: true, text: 'Logical pressure (%)' },
						min: 0,
						max: 100,
					},
				},
				plugins: {
					legend: {
						position: 'bottom',
						labels: {
							filter: (item) => !item.text.includes('est.'),
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
</script>

<div class="chart-wrap" style="height: {height}px;">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.chart-wrap {
		position: relative;
		width: 100%;
	}
</style>
