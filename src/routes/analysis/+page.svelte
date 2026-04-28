<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Nav from '$lib/components/Nav.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import type { Tablet } from '$data/lib/drawtab-loader.js';
	import {
		aspectRatioCategory,
		ASPECT_RATIO_CATEGORIES,
	} from '$data/lib/aspect-ratio.js';

	let { data } = $props();
	let allTablets: Tablet[] = $derived(data.allTablets ?? []);

	interface SectionDef {
		id: string;
		category: string;
		label: string;
	}

	// Source of truth for the navigation tree. Same pattern as the
	// Data Quality page (src/routes/data-quality/+page.svelte) — each
	// entry is one tree leaf, grouped under a category heading.
	const sectionDefs: SectionDef[] = [
		{ id: 'aspect-pen-tablet', category: 'Aspect Ratio', label: 'Pen Tablets' },
		{ id: 'aspect-pen-tablet-by-category', category: 'Aspect Ratio', label: 'Pen Tablets — by Category' },
		{ id: 'aspect-pen-display', category: 'Aspect Ratio', label: 'Pen Displays' },
		{ id: 'aspect-pen-display-by-category', category: 'Aspect Ratio', label: 'Pen Displays — by Category' },
		{ id: 'panel-tech', category: 'Display Tech', label: 'Panel Technology' },
		{ id: 'pressure-levels', category: 'Pressure', label: 'Pressure Levels' },
	];

	const sectionIds = new Set(sectionDefs.map((s) => s.id));
	const defaultSection = 'aspect-pen-tablet';

	const groupedSections: [string, SectionDef[]][] = (() => {
		const map = new Map<string, SectionDef[]>();
		for (const s of sectionDefs) {
			if (!map.has(s.category)) map.set(s.category, []);
			map.get(s.category)!.push(s);
		}
		return [...map.entries()];
	})();

	let activeSection: string = $derived.by(() => {
		const hash = page.url.hash.slice(1);
		return sectionIds.has(hash) ? hash : defaultSection;
	});

	function setSection(id: string) {
		goto(`${page.url.pathname}#${id}`, { replaceState: false, noScroll: true });
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

	function labelToCategory(label: string): string {
		const [w, h] = label.split(':').map(Number);
		if (!w || !h) return '';
		return aspectRatioCategory(w, h) ?? '';
	}

	function arRows(tablets: Tablet[]) {
		return countBy(
			tablets.filter(t => t.Digitizer?.Dimensions?.Width != null && t.Digitizer?.Dimensions?.Height != null),
			t => aspectRatioLabel(t.Digitizer!.Dimensions!.Width!, t.Digitizer!.Dimensions!.Height!)
		).map(r => ({
			...r,
			ratio16: ratio16(r.label),
			decimal: ratioDecimal(r.label),
			category: labelToCategory(r.label),
		}));
	}

	let ptAR = $derived(arRows(penTablets));
	let pdAR = $derived(arRows(penDisplays));

	// Categorized aspect-ratio buckets (16X9_EXACT, 16X10_VERYCLOSE, …,
	// OTHER). Tablets with missing dimensions are skipped, not bucketed
	// as OTHER. Sorted by ASPECT_RATIO_CATEGORIES order so 16X9_* group
	// together visually, and rows with zero count are dropped.
	function arCategoryRows(tablets: Tablet[]) {
		const counts = new Map<string, number>();
		for (const t of tablets) {
			const d = t.Digitizer?.Dimensions;
			const cat = aspectRatioCategory(d?.Width, d?.Height);
			if (cat == null) continue;
			counts.set(cat, (counts.get(cat) ?? 0) + 1);
		}
		return ASPECT_RATIO_CATEGORIES
			.filter((c) => counts.has(c))
			.map((c) => ({ label: c, count: counts.get(c)! }));
	}

	let ptARCat = $derived(arCategoryRows(penTablets));
	let pdARCat = $derived(arCategoryRows(penDisplays));

	// --- Display Tech tab ---

	let displaysWithTech = $derived(
		penDisplays.filter(t => t.Display?.PanelTech != null)
	);

	let panelTechRows = $derived(
		countBy(displaysWithTech, t => t.Display!.PanelTech!)
	);

	let panelTechTotal = $derived(displaysWithTech.length);
	let panelTechCovered = $derived(penDisplays.length);

	// --- Pressure Levels tab ---

	let tabletsWithPressure = $derived(
		allTablets.filter(t => t.Digitizer?.PressureLevels != null)
	);

	let pressureRows = $derived(
		countBy(tabletsWithPressure, t => t.Digitizer!.PressureLevels!)
			.sort((a, b) => Number(a.label) - Number(b.label))
	);

	let pressureTotal = $derived(tabletsWithPressure.length);

	// Single shared ExportDialog instance, opened by per-section trigger buttons.
	let exportDialog: {
		title: string;
		filename: string;
		headers: string[];
		rows: (string | number)[][];
	} | null = $state(null);

	function openExport(
		title: string,
		filename: string,
		headers: string[],
		rows: (string | number)[][],
	): void {
		exportDialog = { title, filename, headers, rows };
	}

	function pct(n: number, total: number): string {
		return total === 0 ? '0.0%' : `${((n / total) * 100).toFixed(1)}%`;
	}
</script>

<Nav />
<h1>Analysis</h1>

<div class="tree-layout">
	<nav class="tree-pane" aria-label="Analysis sections">
		{#each groupedSections as [category, items]}
			<div class="tree-cat">
				<div class="tree-cat-label">{category}</div>
				<ul>
					{#each items as item}
						<li>
							<button
								type="button"
								class:active={activeSection === item.id}
								onclick={() => setSection(item.id)}
							>
								<span class="tree-label">{item.label}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</nav>

	<main class="tree-content">

{#if activeSection === 'aspect-pen-tablet'}

		<section class="section">
			<div class="section-header">
				<h2>Pen Tablets ({penTablets.length})</h2>
				<button class="export-trigger" disabled={ptAR.length === 0} onclick={() => {
					const total = ptAR.reduce((s, r) => s + r.count, 0);
					openExport(
						'Aspect Ratio: Pen Tablets',
						'analysis-aspect-ratio-pen-tablets',
						['Ratio', 'Decimal', 'Category', 'Count', '%'],
						ptAR.map(r => [r.ratio16, r.decimal, r.category, r.count, pct(r.count, total)]),
					);
				}}>Export</button>
			</div>
			<table class="stat-table">
				<thead><tr><th>Ratio</th><th>Decimal</th><th>Category</th><th>Count</th><th></th></tr></thead>
				<tbody>
					{#each ptAR as row}
						{@const pct = (row.count / ptAR.reduce((s, r) => s + r.count, 0) * 100).toFixed(1)}
						<tr>
							<td class="decimal">{row.ratio16}</td>
							<td class="decimal">{row.decimal}</td>
							<td class="mono">{row.category}</td>
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

{#if activeSection === 'aspect-pen-tablet-by-category'}

		<section class="section">
			<div class="section-header">
				<h2>Pen Tablets — by Category ({penTablets.length})</h2>
				<button class="export-trigger" disabled={ptARCat.length === 0} onclick={() => {
					const total = ptARCat.reduce((s, r) => s + r.count, 0);
					openExport(
						'Aspect Ratio Category: Pen Tablets',
						'analysis-aspect-ratio-category-pen-tablets',
						['Category', 'Count', '%'],
						ptARCat.map(r => [r.label, r.count, pct(r.count, total)]),
					);
				}}>Export</button>
			</div>
			<p class="description">
				Buckets each tablet's digitizer aspect ratio into a popular ratio
				(16:9, 16:10, 3:2, 4:3, 5:4, 1:1) at one of three closeness tiers
				(EXACT ≤ 0.005, VERYCLOSE ≤ 0.02, CLOSE ≤ 0.05), or OTHER.
			</p>
			<table class="stat-table">
				<thead><tr><th>Category</th><th>Count</th><th></th></tr></thead>
				<tbody>
					{#each ptARCat as row}
						{@const total = ptARCat.reduce((s, r) => s + r.count, 0)}
						{@const pctVal = (row.count / total * 100).toFixed(1)}
						<tr>
							<td class="label mono">{row.label}</td>
							<td class="count">{row.count}</td>
							<td class="bar-cell">
								<div class="bar-bg"><div class="bar-fill" style="width:{pctVal}%"></div></div>
								<span class="pct">{pctVal}%</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

{/if}

{#if activeSection === 'aspect-pen-display'}

		<section class="section">
			<div class="section-header">
				<h2>Pen Displays &amp; Standalones ({penDisplays.length})</h2>
				<button class="export-trigger" disabled={pdAR.length === 0} onclick={() => {
					const total = pdAR.reduce((s, r) => s + r.count, 0);
					openExport(
						'Aspect Ratio: Pen Displays & Standalones',
						'analysis-aspect-ratio-pen-displays',
						['Ratio', 'Decimal', 'Category', 'Count', '%'],
						pdAR.map(r => [r.ratio16, r.decimal, r.category, r.count, pct(r.count, total)]),
					);
				}}>Export</button>
			</div>
			<table class="stat-table">
				<thead><tr><th>Ratio</th><th>Decimal</th><th>Category</th><th>Count</th><th></th></tr></thead>
				<tbody>
					{#each pdAR as row}
						{@const pct = (row.count / pdAR.reduce((s, r) => s + r.count, 0) * 100).toFixed(1)}
						<tr>
							<td class="decimal">{row.ratio16}</td>
							<td class="decimal">{row.decimal}</td>
							<td class="mono">{row.category}</td>
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

{#if activeSection === 'aspect-pen-display-by-category'}

		<section class="section">
			<div class="section-header">
				<h2>Pen Displays &amp; Standalones — by Category ({penDisplays.length})</h2>
				<button class="export-trigger" disabled={pdARCat.length === 0} onclick={() => {
					const total = pdARCat.reduce((s, r) => s + r.count, 0);
					openExport(
						'Aspect Ratio Category: Pen Displays & Standalones',
						'analysis-aspect-ratio-category-pen-displays',
						['Category', 'Count', '%'],
						pdARCat.map(r => [r.label, r.count, pct(r.count, total)]),
					);
				}}>Export</button>
			</div>
			<p class="description">
				Buckets each pen display's (or standalone's) aspect ratio into a
				popular ratio at one of three closeness tiers, or OTHER.
			</p>
			<table class="stat-table">
				<thead><tr><th>Category</th><th>Count</th><th></th></tr></thead>
				<tbody>
					{#each pdARCat as row}
						{@const total = pdARCat.reduce((s, r) => s + r.count, 0)}
						{@const pctVal = (row.count / total * 100).toFixed(1)}
						<tr>
							<td class="label mono">{row.label}</td>
							<td class="count">{row.count}</td>
							<td class="bar-cell">
								<div class="bar-bg"><div class="bar-fill" style="width:{pctVal}%"></div></div>
								<span class="pct">{pctVal}%</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

{/if}

{#if activeSection === 'panel-tech'}

	<section class="section">
		<div class="section-header">
			<h2>Panel Technology</h2>
			<button class="export-trigger" disabled={panelTechRows.length === 0} onclick={() => openExport(
				'Panel Technology',
				'analysis-panel-tech',
				['Panel Tech', 'Count', '%'],
				panelTechRows.map(r => [r.label, r.count, pct(r.count, panelTechTotal)]),
			)}>Export</button>
		</div>
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

{#if activeSection === 'pressure-levels'}

	<section class="section">
		<div class="section-header">
			<h2>Pressure Levels</h2>
			<button class="export-trigger" disabled={pressureRows.length === 0} onclick={() => openExport(
				'Pressure Levels',
				'analysis-pressure-levels',
				['Pressure Levels', 'Count', '%'],
				pressureRows.map(r => [Number(r.label), r.count, pct(r.count, pressureTotal)]),
			)}>Export</button>
		</div>
		<p class="description">
			{pressureTotal} of {allTablets.length} tablets have pressure level data.
		</p>
		<table class="stat-table">
			<thead><tr><th>Pressure Levels</th><th>Count</th><th></th></tr></thead>
			<tbody>
				{#each pressureRows as row}
					{@const pct = (row.count / pressureTotal * 100).toFixed(1)}
					<tr>
						<td class="label">{Number(row.label).toLocaleString()}</td>
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

	</main>
</div>

{#if exportDialog}
	<ExportDialog
		entityType="analysis"
		title={exportDialog.title}
		filename={exportDialog.filename}
		headers={exportDialog.headers}
		rows={exportDialog.rows}
		onclose={() => (exportDialog = null)}
	/>
{/if}

<style>
	h1 { margin-bottom: 16px; }

	.tree-layout {
		display: flex;
		gap: 24px;
		align-items: flex-start;
	}

	.tree-pane {
		flex: 0 0 240px;
		position: sticky;
		top: 16px;
		max-height: calc(100vh - 32px);
		overflow-y: auto;
		border-right: 1px solid var(--border, #e0e0e0);
		padding: 4px 12px 4px 0;
		font-size: 13px;
	}

	.tree-content {
		flex: 1;
		min-width: 0;
	}

	.tree-cat {
		margin-bottom: 14px;
	}

	.tree-cat-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted, #888);
		padding: 0 8px;
		margin-bottom: 4px;
	}

	.tree-cat ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tree-cat li {
		margin: 0;
	}

	.tree-cat button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		padding: 5px 10px;
		font-size: 13px;
		text-align: left;
		border: 1px solid transparent;
		border-radius: 4px;
		background: transparent;
		color: var(--text, #333);
		cursor: pointer;
		line-height: 1.3;
	}

	.tree-cat button:hover {
		background: #eff6ff;
		color: #2563eb;
	}

	.tree-cat button.active {
		background: #dbeafe;
		color: #1e40af;
		font-weight: 600;
	}

	.tree-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 8px;
	}
	.section-header h2 { margin: 0; }

	.export-trigger {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		font-size: 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
	}
	.export-trigger:hover { border-color: var(--text-dim); color: var(--text); }
	.export-trigger:disabled { opacity: 0.4; cursor: not-allowed; }

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
