<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		penTabletRangesCm,
		penTabletRangesIn,
		displayRangesCm,
		displayRangesIn,
		MM_TO_IN,
	} from '$lib/tablet-size-ranges.js';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import BandsChart from '$lib/components/BandsChart.svelte';
	import { IAF_BANDS, MAX_PRESSURE_BANDS } from '$lib/pressure-bands.js';

	const dataTabs = [
		{ href: '/reference', label: 'Reference' },
		{ href: '/data-dictionary', label: 'Data Dictionary' },
		{ href: '/api-explorer', label: 'API Explorer' },
		{ href: '/data-quality', label: 'Data Quality' },
		{ href: '/pen-compat', label: 'Pen Compat' },
		{ href: '/wacom-driver-compat', label: 'Driver Compat' },
	];

	interface SectionDef {
		id: string;
		category: string;
		label: string;
	}

	const sectionDefs: SectionDef[] = [
		{ id: 'tablet-sizes', category: 'Tablets', label: 'Tablet Sizes' },
		{ id: 'display-resolutions', category: 'Tablets', label: 'Display Resolutions' },
		{ id: 'iso-paper-a', category: 'Paper Sizes', label: 'ISO A Paper Sizes' },
		{ id: 'iso-paper-b', category: 'Paper Sizes', label: 'ISO B Paper Sizes' },
		{ id: 'us-paper', category: 'Paper Sizes', label: 'US Paper Sizes' },
		{ id: 'iaf-ranking', category: 'Pen Pressure', label: 'IAF Ranking' },
		{ id: 'max-pressure', category: 'Pen Pressure', label: 'Max Physical Pressure' },
	];

	const sectionIds = new Set(sectionDefs.map((s) => s.id));
	const defaultSection = 'tablet-sizes';

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
		// page.url.pathname is already resolved (includes base path).
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${page.url.pathname}#${id}`, {
			replaceState: false,
			noScroll: true,
		});
	}

	let { data } = $props();

	const iafBands = IAF_BANDS;
	const maxPressureBands = MAX_PRESSURE_BANDS;
	let paperSizes = $derived(data.paperSizes);
	let usPaperSizes = $derived(data.usPaperSizes);
	let allTablets = $derived(data.allTablets);

	let aSeries = $derived(paperSizes.filter((p) => p.Series === 'A'));
	let bSeries = $derived(paperSizes.filter((p) => p.Series === 'B'));

	function gcd(a: number, b: number): number {
		return b === 0 ? a : gcd(b, a % b);
	}

	function closestISOA(midpointCm: number): { name: string; diagCm: string; diagIn: string } {
		if (aSeries.length === 0) return { name: '', diagCm: '', diagIn: '' };
		let best = aSeries[0];
		let bestDist = Infinity;
		for (const p of aSeries) {
			const diagCm = Math.sqrt(p.Width_mm ** 2 + p.Height_mm ** 2) / 10;
			const dist = Math.abs(diagCm - midpointCm);
			if (dist < bestDist) {
				bestDist = dist;
				best = p;
			}
		}
		const diagMm = Math.sqrt(best.Width_mm ** 2 + best.Height_mm ** 2);
		return {
			name: best.Name,
			diagCm: (diagMm / 10).toFixed(1),
			diagIn: (diagMm * MM_TO_IN).toFixed(1),
		};
	}

	// --- Display resolution categories ---

	const resolutionCategories = [
		{ name: 'Full HD', resolutions: [{ w: 1920, h: 1080 }] },
		{
			name: '2.5K',
			resolutions: [
				{ w: 2560, h: 1440 },
				{ w: 2560, h: 1600 },
			],
		},
		{ name: '3K', resolutions: [{ w: 2880, h: 1800 }] },
		{ name: '4K', resolutions: [{ w: 3840, h: 2160 }] },
	];

	function getResolutionCategory(w: number, h: number): string {
		if (w === 1920 && h === 1080) return 'Full HD';
		if ((w === 2560 && h === 1440) || (w === 2560 && h === 1600)) return '2.5K';
		if (w === 2880 && h === 1800) return '3K';
		if (w === 3840 && h === 2160) return '4K';
		return 'Other';
	}

	let displayTablets = $derived(
		allTablets.filter((t) => t.Model.Type === 'PENDISPLAY' || t.Model.Type === 'STANDALONE'),
	);

	let resolutionCounts = $derived(
		displayTablets.reduce<Record<string, number>>((acc, t) => {
			const d = t.Display?.PixelDimensions;
			if (!d?.Width || !d?.Height) return acc;
			const cat = getResolutionCategory(d.Width, d.Height);
			acc[cat] = (acc[cat] ?? 0) + 1;
			return acc;
		}, {}),
	);

	// Single shared ExportDialog. Each section's Export trigger sets
	// `exportDialog` to a config object; the dialog mounts when set.
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
</script>

<Nav />
<SubNav tabs={dataTabs} />
<h1>Reference</h1>

<div class="ref-layout">
	<nav class="ref-tree" aria-label="Reference sections">
		{#each groupedSections as [category, items] (category)}
			<div class="tree-cat">
				<div class="tree-cat-label">{category}</div>
				<ul>
					{#each items as item (item.id)}
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

	<main class="ref-content">
		{#if activeSection === 'tablet-sizes'}
			<section>
				<div class="section-header">
					<h2>Pen Tablet Size Categories</h2>
					<button
						class="copy-btn"
						onclick={() =>
							openExport(
								'Pen Tablet Size Categories',
								'pen-tablet-sizes',
								[
									'Category',
									'Range (cm)',
									'Range (in)',
									'Similar ISO A',
									'Diagonal (cm)',
									'Diagonal (in)',
								],
								penTabletRangesCm.map((range, i) => {
									const inRange = penTabletRangesIn[i];
									const iso = closestISOA((range.min + range.max) / 2);
									return [
										range.label,
										`${range.min} cm – ${range.max} cm`,
										`${inRange.min}″ – ${inRange.max}″`,
										iso.name,
										`${iso.diagCm} cm`,
										`${iso.diagIn}″`,
									];
								}),
							)}>Export</button
					>
				</div>
				<table id="pen-tablet-table" class="ref-table">
					<thead
						><tr
							><th>Category</th><th>Range (cm)</th><th>Range (in)</th><th>Similar ISO A</th><th
								>Diagonal (cm)</th
							><th>Diagonal (in)</th></tr
						></thead
					>
					<tbody>
						{#each penTabletRangesCm as range, i (range.label)}
							{@const inRange = penTabletRangesIn[i]}
							{@const midCm = (range.min + range.max) / 2}
							{@const iso = closestISOA(midCm)}
							<tr>
								<td>{range.label}</td>
								<td>{range.min} cm – {range.max} cm</td>
								<td>{inRange.min}″ – {inRange.max}″</td>
								<td>{iso.name}</td>
								<td>{iso.diagCm} cm</td>
								<td>{iso.diagIn}″</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>

			<section>
				<div class="section-header">
					<h2>Pen Display Size Categories</h2>
					<button
						class="copy-btn"
						onclick={() =>
							openExport(
								'Pen Display Size Categories',
								'pen-display-sizes',
								[
									'Category',
									'Range (cm)',
									'Range (in)',
									'Similar ISO A',
									'Diagonal (cm)',
									'Diagonal (in)',
								],
								displayRangesCm.map((range, i) => {
									const inRange = displayRangesIn[i];
									const iso = closestISOA((range.min + range.max) / 2);
									return [
										range.label,
										`${range.min} cm – ${range.max} cm`,
										`${inRange.min}″ – ${inRange.max}″`,
										iso.name,
										`${iso.diagCm} cm`,
										`${iso.diagIn}″`,
									];
								}),
							)}>Export</button
					>
				</div>
				<table id="pen-display-table" class="ref-table">
					<thead
						><tr
							><th>Category</th><th>Range (cm)</th><th>Range (in)</th><th>Similar ISO A</th><th
								>Diagonal (cm)</th
							><th>Diagonal (in)</th></tr
						></thead
					>
					<tbody>
						{#each displayRangesCm as range, i (range.label)}
							{@const inRange = displayRangesIn[i]}
							{@const midCm = (range.min + range.max) / 2}
							{@const iso = closestISOA(midCm)}
							<tr>
								<td>{range.label}</td>
								<td>{range.min} cm – {range.max} cm</td>
								<td>{inRange.min}″ – {inRange.max}″</td>
								<td>{iso.name}</td>
								<td>{iso.diagCm} cm</td>
								<td>{iso.diagIn}″</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{:else if activeSection === 'iso-paper-a'}
			<section>
				<div class="section-header">
					<h2>ISO A Paper Sizes</h2>
					<button
						class="copy-btn"
						disabled={aSeries.length === 0}
						onclick={() =>
							openExport(
								'ISO A Paper Sizes',
								'iso-a-paper-sizes',
								[
									'Name',
									'Width (cm)',
									'Height (cm)',
									'Diagonal (cm)',
									'Width (in)',
									'Height (in)',
									'Diagonal (in)',
								],
								aSeries.map((size) => {
									const diagCm = Math.sqrt(size.Width_mm ** 2 + size.Height_mm ** 2) / 10;
									const diagIn = Math.sqrt(size.Width_in ** 2 + size.Height_in ** 2);
									return [
										size.Name,
										(size.Width_mm / 10).toFixed(1),
										(size.Height_mm / 10).toFixed(1),
										diagCm.toFixed(1),
										size.Width_in,
										size.Height_in,
										diagIn.toFixed(1),
									];
								}),
							)}>Export</button
					>
				</div>
				{#if aSeries.length > 0}
					<table id="iso-a-paper-table" class="ref-table">
						<thead
							><tr
								><th>Name</th><th>Width (cm)</th><th>Height (cm)</th><th>Diagonal (cm)</th><th
									>Width (in)</th
								><th>Height (in)</th><th>Diagonal (in)</th></tr
							></thead
						>
						<tbody>
							{#each aSeries as size (size.Name)}
								{@const diagCm = Math.sqrt(size.Width_mm ** 2 + size.Height_mm ** 2) / 10}
								{@const diagIn = Math.sqrt(size.Width_in ** 2 + size.Height_in ** 2)}
								<tr>
									<td>{size.Name}</td>
									<td>{(size.Width_mm / 10).toFixed(1)}</td>
									<td>{(size.Height_mm / 10).toFixed(1)}</td>
									<td>{diagCm.toFixed(1)}</td>
									<td>{size.Width_in}</td>
									<td>{size.Height_in}</td>
									<td>{diagIn.toFixed(1)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<p class="no-data">Loading...</p>
				{/if}
			</section>
		{:else if activeSection === 'iso-paper-b'}
			<section>
				<div class="section-header">
					<h2>ISO B Paper Sizes</h2>
					<button
						class="copy-btn"
						disabled={bSeries.length === 0}
						onclick={() =>
							openExport(
								'ISO B Paper Sizes',
								'iso-b-paper-sizes',
								[
									'Name',
									'Width (cm)',
									'Height (cm)',
									'Diagonal (cm)',
									'Width (in)',
									'Height (in)',
									'Diagonal (in)',
								],
								bSeries.map((size) => {
									const diagCm = Math.sqrt(size.Width_mm ** 2 + size.Height_mm ** 2) / 10;
									const diagIn = Math.sqrt(size.Width_in ** 2 + size.Height_in ** 2);
									return [
										size.Name,
										(size.Width_mm / 10).toFixed(1),
										(size.Height_mm / 10).toFixed(1),
										diagCm.toFixed(1),
										size.Width_in,
										size.Height_in,
										diagIn.toFixed(1),
									];
								}),
							)}>Export</button
					>
				</div>
				{#if bSeries.length > 0}
					<table id="iso-b-paper-table" class="ref-table">
						<thead
							><tr
								><th>Name</th><th>Width (cm)</th><th>Height (cm)</th><th>Diagonal (cm)</th><th
									>Width (in)</th
								><th>Height (in)</th><th>Diagonal (in)</th></tr
							></thead
						>
						<tbody>
							{#each bSeries as size (size.Name)}
								{@const diagCm = Math.sqrt(size.Width_mm ** 2 + size.Height_mm ** 2) / 10}
								{@const diagIn = Math.sqrt(size.Width_in ** 2 + size.Height_in ** 2)}
								<tr>
									<td>{size.Name}</td>
									<td>{(size.Width_mm / 10).toFixed(1)}</td>
									<td>{(size.Height_mm / 10).toFixed(1)}</td>
									<td>{diagCm.toFixed(1)}</td>
									<td>{size.Width_in}</td>
									<td>{size.Height_in}</td>
									<td>{diagIn.toFixed(1)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<p class="no-data">Loading...</p>
				{/if}
			</section>
		{:else if activeSection === 'us-paper'}
			<section>
				<div class="section-header">
					<h2>US Paper Sizes</h2>
					<button
						class="copy-btn"
						disabled={usPaperSizes.length === 0}
						onclick={() =>
							openExport(
								'US Paper Sizes',
								'us-paper-sizes',
								[
									'Name',
									'Series',
									'Width (cm)',
									'Height (cm)',
									'Diagonal (cm)',
									'Width (in)',
									'Height (in)',
									'Diagonal (in)',
								],
								usPaperSizes.map((size) => {
									const diagCm = Math.sqrt(size.Width_mm ** 2 + size.Height_mm ** 2) / 10;
									const diagIn = Math.sqrt(size.Width_in ** 2 + size.Height_in ** 2);
									return [
										size.Name,
										size.Series,
										(size.Width_mm / 10).toFixed(1),
										(size.Height_mm / 10).toFixed(1),
										diagCm.toFixed(1),
										size.Width_in,
										size.Height_in,
										diagIn.toFixed(1),
									];
								}),
							)}>Export</button
					>
				</div>
				{#if usPaperSizes.length > 0}
					<table id="us-paper-table" class="ref-table">
						<thead
							><tr
								><th>Name</th><th>Series</th><th>Width (cm)</th><th>Height (cm)</th><th
									>Diagonal (cm)</th
								><th>Width (in)</th><th>Height (in)</th><th>Diagonal (in)</th></tr
							></thead
						>
						<tbody>
							{#each usPaperSizes as size (size.Name)}
								{@const diagCm = Math.sqrt(size.Width_mm ** 2 + size.Height_mm ** 2) / 10}
								{@const diagIn = Math.sqrt(size.Width_in ** 2 + size.Height_in ** 2)}
								<tr>
									<td>{size.Name}</td>
									<td>{size.Series}</td>
									<td>{(size.Width_mm / 10).toFixed(1)}</td>
									<td>{(size.Height_mm / 10).toFixed(1)}</td>
									<td>{diagCm.toFixed(1)}</td>
									<td>{size.Width_in}</td>
									<td>{size.Height_in}</td>
									<td>{diagIn.toFixed(1)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<p class="no-data">Loading...</p>
				{/if}
			</section>
		{:else if activeSection === 'display-resolutions'}
			<section>
				<div class="section-header">
					<h2>Display Resolution Categories</h2>
					<button
						class="copy-btn"
						onclick={() => {
							const headers = [
								'Category',
								'Resolution',
								'Megapixels',
								'Aspect Ratio',
								'Displays in dataset',
							];
							const rows: (string | number)[][] = [];
							for (const cat of resolutionCategories) {
								cat.resolutions.forEach((res, i) => {
									const mp = ((res.w * res.h) / 1_000_000).toFixed(2);
									const g = gcd(res.w, res.h);
									const ar = `${res.w / g}:${res.h / g}`;
									const count = i === 0 ? (resolutionCounts[cat.name] ?? 0) : '';
									rows.push([cat.name, `${res.w} × ${res.h}`, `${mp} MP`, ar, count]);
								});
							}
							rows.push(['Other', '—', '—', '—', resolutionCounts['Other'] ?? 0]);
							openExport('Display Resolution Categories', 'display-resolutions', headers, rows);
						}}>Export</button
					>
				</div>
				<table id="res-cat-table" class="ref-table">
					<thead>
						<tr>
							<th>Category</th>
							<th>Resolution(s)</th>
							<th>Megapixels</th>
							<th>Aspect Ratio</th>
							<th>Displays in dataset</th>
						</tr>
					</thead>
					<tbody>
						{#each resolutionCategories as cat (cat.name)}
							{#each cat.resolutions as res, i (i)}
								{@const mp = ((res.w * res.h) / 1_000_000).toFixed(2)}
								{@const g = gcd(res.w, res.h)}
								{@const ar = `${res.w / g}:${res.h / g}`}
								{@const count = i === 0 ? (resolutionCounts[cat.name] ?? 0) : null}
								<tr>
									{#if i === 0}
										<td rowspan={cat.resolutions.length} class="cat-name">{cat.name}</td>
									{/if}
									<td>{res.w} × {res.h}</td>
									<td>{mp} MP</td>
									<td>{ar}</td>
									{#if i === 0}
										<td rowspan={cat.resolutions.length} class="count-cell">
											{count === 0 ? '—' : count}
										</td>
									{/if}
								</tr>
							{/each}
						{/each}
						<tr class="other-row">
							<td>Other</td>
							<td>—</td>
							<td>—</td>
							<td>—</td>
							<td>{resolutionCounts['Other'] ?? 0}</td>
						</tr>
					</tbody>
				</table>
			</section>
		{:else if activeSection === 'iaf-ranking'}
			<section>
				<div class="section-header">
					<h2>IAF Ranking</h2>
				</div>
				<p class="ref-blurb">
					Initial Activation Force is the minimum force required for a pen tip to register pressure.
					Lower is better — a lighter touch means more natural shading and less hand fatigue.
				</p>
				<BandsChart bands={iafBands} axisMax={10} axisStep={1} unit="gf" title="IAF Ranking" />
				<div class="subsection-header">
					<h3>Ranking Bands</h3>
					<button
						class="copy-btn"
						onclick={() =>
							openExport(
								'IAF Ranking',
								'iaf-ranking',
								['Rank', 'Range (gf)'],
								iafBands.map((b) => [
									b.label,
									b.max === null ? `> ${b.min} gf` : `${b.min} gf to ${b.max} gf`,
								]),
							)}>Export</button
					>
				</div>
				<table class="ref-table">
					<thead><tr><th>Rank</th><th>Range</th></tr></thead>
					<tbody>
						{#each iafBands as b (b.label)}
							<tr>
								<td>{b.label}</td>
								<td>{b.max === null ? `> ${b.min} gf` : `${b.min} gf to ${b.max} gf`}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{:else if activeSection === 'max-pressure'}
			<section>
				<div class="section-header">
					<h2>Max Physical Pressure</h2>
				</div>
				<p class="ref-blurb">
					Maximum physical pressure is the force at which the digitizer saturates (reports its
					maximum pressure value). More headroom gives a wider dynamic range; too much forces the
					user to push harder than is comfortable to reach full pressure.
				</p>
				<BandsChart
					bands={maxPressureBands}
					axisMax={1000}
					axisStep={100}
					unit="gf"
					title="Max Physical Pressure"
				/>
				<div class="subsection-header">
					<h3>Ranking Bands</h3>
					<button
						class="copy-btn"
						onclick={() =>
							openExport(
								'Max Physical Pressure',
								'max-physical-pressure',
								['Rank', 'Range (gf)'],
								maxPressureBands.map((b) => [
									b.label,
									b.max === null ? `> ${b.min} gf` : `${b.min} gf to ${b.max} gf`,
								]),
							)}>Export</button
					>
				</div>
				<table class="ref-table">
					<thead><tr><th>Rank</th><th>Range</th></tr></thead>
					<tbody>
						{#each maxPressureBands as b (b.label)}
							<tr>
								<td>{b.label}</td>
								<td>{b.max === null ? `> ${b.min} gf` : `${b.min} gf to ${b.max} gf`}</td>
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
		entityType="reference"
		title={exportDialog.title}
		filename={exportDialog.filename}
		headers={exportDialog.headers}
		rows={exportDialog.rows}
		onclose={() => (exportDialog = null)}
	/>
{/if}

<style>
	h1 {
		margin-bottom: 16px;
	}

	.ref-layout {
		display: flex;
		gap: 24px;
		align-items: flex-start;
	}

	.ref-tree {
		flex: 0 0 240px;
		position: sticky;
		top: 16px;
		max-height: calc(100vh - 32px);
		overflow-y: auto;
		border-right: 1px solid var(--border, #e0e0e0);
		padding: 4px 12px 4px 0;
		font-size: 13px;
	}

	.ref-content {
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

	section {
		margin-bottom: 24px;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
		padding-bottom: 3px;
		border-bottom: 2px solid var(--border);
	}

	h2 {
		font-size: 14px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 0;
	}

	.subsection-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 20px;
		margin-bottom: 6px;
		padding-bottom: 3px;
		border-bottom: 1px solid var(--border);
	}

	.subsection-header h3 {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		margin: 0;
	}

	.copy-btn {
		padding: 2px 8px;
		font-size: 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
	}

	.copy-btn:hover {
		background: var(--hover-bg);
		color: var(--text);
	}

	.ref-table {
		border-collapse: collapse;
		font-size: 13px;
	}

	.ref-table th,
	.ref-table td {
		padding: 4px 12px;
		text-align: left;
		border-bottom: 1px solid var(--border);
	}

	.ref-table th {
		font-weight: 600;
		color: var(--th-text);
		background: var(--th-bg);
	}

	.no-data {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
	}

	.ref-blurb {
		font-size: 13px;
		color: var(--text-muted);
		max-width: 800px;
		margin: 0 0 16px;
		line-height: 1.5;
	}

	.cat-name {
		font-weight: 600;
		vertical-align: middle;
	}

	.count-cell {
		vertical-align: middle;
		text-align: center;
	}

	.other-row td {
		color: var(--text-muted);
		font-style: italic;
	}
</style>
