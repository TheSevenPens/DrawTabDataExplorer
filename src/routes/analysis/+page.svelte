<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Nav from '$lib/components/Nav.svelte';
	import type { Tablet } from '$data/lib/drawtab-loader.js';

	let { data } = $props();
	let allTablets: Tablet[] = $derived(data.allTablets ?? []);

	type TabName = 'aspect-ratio' | 'display-tech';
	const validTabs: TabName[] = ['aspect-ratio', 'display-tech'];

	let activeTab: TabName = $derived.by(() => {
		const hash = page.url.hash.slice(1) as TabName;
		return validTabs.includes(hash) ? hash : 'aspect-ratio';
	});

	function setTab(tab: TabName) {
		goto(`${page.url.pathname}#${tab}`, { replaceState: false, noScroll: true });
	}

	// --- Helpers ---

	function gcd(a: number, b: number): number {
		return b === 0 ? a : gcd(b, a % b);
	}

	function aspectRatioLabel(w: number, h: number): string {
		const lw = Math.max(w, h);
		const lh = Math.min(w, h);
		const scale = gcd(Math.round(lw), Math.round(lh));
		const rw = Math.round(lw / scale);
		const rh = Math.round(lh / scale);
		// Snap to nearest known ratio
		const ratio = lw / lh;
		if (Math.abs(ratio - 16 / 9) < 0.02) return '16:9';
		if (Math.abs(ratio - 16 / 10) < 0.02) return '16:10';
		if (Math.abs(ratio - 4 / 3) < 0.02) return '4:3';
		if (Math.abs(ratio - 3 / 2) < 0.02) return '3:2';
		if (Math.abs(ratio - 5 / 4) < 0.02) return '5:4';
		return `${rw}:${rh}`;
	}

	function ratio16(label: string): string {
		const [w, h] = label.split(':').map(Number);
		if (!w || !h) return '';
		const x = (h / w) * 16;
		const rounded = Math.round(x * 100) / 100;
		const display = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2).replace(/\.?0+$/, '');
		return `16:${display}`;
	}

	function countBy<T>(items: T[], key: (item: T) => string): { label: string; count: number }[] {
		const map = new Map<string, number>();
		for (const item of items) {
			const k = key(item);
			map.set(k, (map.get(k) ?? 0) + 1);
		}
		return [...map.entries()]
			.map(([label, count]) => ({ label, count }))
			.sort((a, b) => b.count - a.count);
	}

	// --- Aspect Ratio tab ---

	let penTablets = $derived(allTablets.filter(t => t.Model.Type === 'PENTABLET'));
	let penDisplays = $derived(allTablets.filter(
		t => t.Model.Type === 'PENDISPLAY' || t.Model.Type === 'STANDALONE'
	));

	function ratioDecimal(label: string): string {
		const [w, h] = label.split(':').map(Number);
		if (!w || !h) return '';
		return (w / h).toFixed(2);
	}

	function arRows(tablets: Tablet[]) {
		return countBy(
			tablets.filter(t => t.Digitizer?.Dimensions?.Width != null && t.Digitizer?.Dimensions?.Height != null),
			t => aspectRatioLabel(t.Digitizer!.Dimensions!.Width!, t.Digitizer!.Dimensions!.Height!)
		).map(r => ({ ...r, ratio16: ratio16(r.label), decimal: ratioDecimal(r.label) }));
	}

	let ptAR = $derived(arRows(penTablets));
	let pdAR = $derived(arRows(penDisplays));

	// --- Display Tech tab ---

	let displaysWithTech = $derived(
		penDisplays.filter(t => t.Display?.PanelTech != null)
	);

	let panelTechRows = $derived(
		countBy(displaysWithTech, t => t.Display!.PanelTech!)
	);

	let panelTechTotal = $derived(displaysWithTech.length);
	let panelTechCovered = $derived(penDisplays.length);
</script>

<Nav />
<h1>Analysis</h1>

<div class="tabs">
	<button class:active={activeTab === 'aspect-ratio'} onclick={() => setTab('aspect-ratio')}>Aspect Ratio</button>
	<button class:active={activeTab === 'display-tech'} onclick={() => setTab('display-tech')}>Display Tech</button>
</div>

{#if activeTab === 'aspect-ratio'}

	<div class="two-col">
		<section class="section">
			<h2>Pen Tablets ({penTablets.length})</h2>
			<table class="stat-table">
				<thead><tr><th>Ratio</th><th>16-norm</th><th>Decimal</th><th>Count</th><th></th></tr></thead>
				<tbody>
					{#each ptAR as row}
						{@const pct = (row.count / ptAR.reduce((s, r) => s + r.count, 0) * 100).toFixed(1)}
						<tr>
							<td class="label">{row.label}</td>
							<td class="decimal">{row.ratio16}</td>
							<td class="decimal">{row.decimal}</td>
							<td class="count">{row.count}</td>
							<td class="bar-cell">
								<div class="bar-bg"><div class="bar-fill" style="width:{pct}%"></div></div>
								<span class="pct">{pct}%</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="section">
			<h2>Pen Displays &amp; Standalones ({penDisplays.length})</h2>
			<table class="stat-table">
				<thead><tr><th>Ratio</th><th>16-norm</th><th>Decimal</th><th>Count</th><th></th></tr></thead>
				<tbody>
					{#each pdAR as row}
						{@const pct = (row.count / pdAR.reduce((s, r) => s + r.count, 0) * 100).toFixed(1)}
						<tr>
							<td class="label">{row.label}</td>
							<td class="decimal">{row.ratio16}</td>
							<td class="decimal">{row.decimal}</td>
							<td class="count">{row.count}</td>
							<td class="bar-cell">
								<div class="bar-bg"><div class="bar-fill" style="width:{pct}%"></div></div>
								<span class="pct">{pct}%</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	</div>

{:else if activeTab === 'display-tech'}

	<section class="section">
		<h2>Panel Technology</h2>
		<p class="description">
			{displaysWithTech.length} of {panelTechCovered} pen displays and standalones have panel tech data.
		</p>
		<table class="stat-table">
			<thead><tr><th>Panel Tech</th><th>Count</th><th></th></tr></thead>
			<tbody>
				{#each panelTechRows as row}
					{@const pct = (row.count / panelTechTotal * 100).toFixed(1)}
					<tr>
						<td class="label">{row.label}</td>
						<td class="count">{row.count}</td>
						<td class="bar-cell">
							<div class="bar-bg"><div class="bar-fill" style="width:{pct}%"></div></div>
							<span class="pct">{pct}%</span>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

{/if}

<style>
	h1 { margin-bottom: 16px; }

	.tabs {
		display: flex;
		gap: 0;
		border-bottom: 2px solid var(--border);
		margin-bottom: 20px;
	}

	.tabs button {
		padding: 7px 18px;
		font-size: 13px;
		border: 1px solid transparent;
		border-bottom: none;
		border-radius: 4px 4px 0 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		position: relative;
		bottom: -2px;
	}

	.tabs button:hover {
		color: #2563eb;
		background: var(--hover-bg);
	}

	.tabs button.active {
		background: var(--bg-card);
		color: var(--text);
		font-weight: 600;
		border-color: var(--border);
		border-bottom-color: var(--bg-card);
	}

	.two-col {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 32px;
	}

	@media (max-width: 700px) {
		.two-col { grid-template-columns: 1fr; }
	}

	.section { margin-bottom: 32px; }

	h2 {
		font-size: 15px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 8px;
		padding-bottom: 4px;
		border-bottom: 2px solid var(--border);
	}

	.description {
		font-size: 13px;
		color: var(--text-dim);
		margin-bottom: 8px;
	}

	.stat-table {
		border-collapse: collapse;
		font-size: 13px;
		width: 100%;
	}

	.stat-table th {
		text-align: left;
		padding: 5px 10px;
		background: var(--th-bg);
		color: var(--th-text);
		border-bottom: 1px solid var(--border);
	}

	.stat-table td {
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}

	.stat-table tr:hover td { background: var(--hover-bg); }

	.label { font-weight: 600; }
	.decimal { color: var(--text-muted); font-variant-numeric: tabular-nums; width: 60px; }
	.count { color: var(--text-muted); width: 50px; }

	.bar-cell {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.bar-bg {
		width: 120px;
		height: 12px;
		background: var(--border);
		border-radius: 3px;
		overflow: hidden;
		flex-shrink: 0;
	}

	.bar-fill {
		height: 100%;
		background: #2563eb;
		border-radius: 3px;
	}

	.pct {
		font-size: 12px;
		color: var(--text-dim);
		white-space: nowrap;
	}
</style>
