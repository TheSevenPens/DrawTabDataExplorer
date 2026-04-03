<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadTabletsFromURL, loadPensFromURL, brandName, type Tablet, type Pen } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';

	interface YearEntry {
		year: string;
		tablets: Tablet[];
		pens: Pen[];
	}

	let timeline: YearEntry[] = $state([]);
	let filterBrand = $state('');
	let filterType = $state('');
	let brands: string[] = $state([]);
	let sortOrder: 'newest' | 'oldest' = $state('newest');

	onMount(async () => {
		const [tablets, pens] = await Promise.all([
			loadTabletsFromURL(base),
			loadPensFromURL(base),
		]);

		brands = [...new Set([...tablets.map(t => t.Brand), ...pens.map(p => p.Brand)])].sort();

		const yearMap = new Map<string, { tablets: Tablet[]; pens: Pen[] }>();

		for (const t of tablets) {
			if (!t.ModelLaunchYear) continue;
			if (!yearMap.has(t.ModelLaunchYear)) yearMap.set(t.ModelLaunchYear, { tablets: [], pens: [] });
			yearMap.get(t.ModelLaunchYear)!.tablets.push(t);
		}

		for (const p of pens) {
			if (!p.PenYear) continue;
			if (!yearMap.has(p.PenYear)) yearMap.set(p.PenYear, { tablets: [], pens: [] });
			yearMap.get(p.PenYear)!.pens.push(p);
		}

		timeline = [...yearMap.entries()]
			.map(([year, data]) => ({ year, ...data }))
			.sort((a, b) => b.year.localeCompare(a.year));
	});

	let filteredTimeline = $derived.by(() => {
		let result = timeline;
		if (sortOrder === 'oldest') {
			result = [...result].reverse();
		}
		return result.map(entry => {
			let tablets = entry.tablets;
			let pens = entry.pens;
			if (filterBrand) {
				tablets = tablets.filter(t => t.Brand === filterBrand);
				pens = pens.filter(p => p.Brand === filterBrand);
			}
			if (filterType) {
				tablets = tablets.filter(t => t.ModelType === filterType);
			}
			return { year: entry.year, tablets, pens };
		}).filter(entry => entry.tablets.length > 0 || entry.pens.length > 0);
	});

	let totalTablets = $derived(filteredTimeline.reduce((sum, e) => sum + e.tablets.length, 0));
	let totalPens = $derived(filteredTimeline.reduce((sum, e) => sum + e.pens.length, 0));
</script>

<Nav />

<div class="title-row">
	<h1>Timeline</h1>
	<span class="subtitle">{filteredTimeline.length} years, {totalTablets} tablets, {totalPens} pens</span>
</div>

<div class="filters">
	<select bind:value={filterBrand}>
		<option value="">All Brands</option>
		{#each brands as b}
			<option value={b}>{brandName(b)}</option>
		{/each}
	</select>
	<select bind:value={filterType}>
		<option value="">All Types</option>
		<option value="PENTABLET">Pen Tablet</option>
		<option value="PENDISPLAY">Pen Display</option>
		<option value="STANDALONE">Standalone</option>
	</select>
	<select bind:value={sortOrder}>
		<option value="newest">Newest First</option>
		<option value="oldest">Oldest First</option>
	</select>
</div>

<div class="timeline">
	{#each filteredTimeline as entry}
		<div class="year-block">
			<div class="year-label">{entry.year}</div>
			<div class="year-content">
				{#if entry.tablets.length > 0}
					<div class="category">
						<h3>Tablets ({entry.tablets.length})</h3>
						<div class="items">
							{#each entry.tablets as t}
								<a class="item tablet" href="{base}/tablets/{encodeURIComponent(t.EntityId)}">
									<span class="item-brand">{brandName(t.Brand)}</span>
									<span class="item-name">{t.ModelName}</span>
									<span class="item-type">{t.ModelType}</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}
				{#if entry.pens.length > 0}
					<div class="category">
						<h3>Pens ({entry.pens.length})</h3>
						<div class="items">
							{#each entry.pens as p}
								<a class="item pen" href="{base}/pens/{encodeURIComponent(p.EntityId)}">
									<span class="item-brand">{brandName(p.Brand)}</span>
									<span class="item-name">{p.PenName === p.PenId ? p.PenId : `${p.PenName} (${p.PenId})`}</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	.title-row {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 12px;
	}

	h1 { margin: 0; }

	.subtitle {
		font-size: 14px;
		color: var(--text-dim);
	}

	.filters {
		display: flex;
		gap: 8px;
		margin-bottom: 20px;
	}

	.filters select {
		padding: 5px 10px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
	}

	.timeline {
		position: relative;
		padding-left: 80px;
	}

	.year-block {
		position: relative;
		margin-bottom: 24px;
		padding-bottom: 24px;
		border-bottom: 1px solid var(--border);
	}

	.year-block:last-child {
		border-bottom: none;
	}

	.year-label {
		position: absolute;
		left: -80px;
		top: 0;
		width: 60px;
		font-size: 20px;
		font-weight: 700;
		color: var(--text);
		text-align: right;
	}

	.year-content {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.category h3 {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		margin-bottom: 6px;
	}

	.items {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.item {
		display: inline-flex;
		flex-direction: column;
		padding: 6px 10px;
		border-radius: 6px;
		font-size: 12px;
		text-decoration: none;
		border: 1px solid var(--border-light);
		background: var(--bg-card);
		min-width: 140px;
	}

	.item:hover {
		border-color: var(--link);
	}

	.item-brand {
		font-size: 11px;
		color: var(--text-dim);
	}

	.item-name {
		font-weight: 600;
		color: var(--text);
	}

	.item-type {
		font-size: 10px;
		color: var(--text-dim);
		text-transform: uppercase;
	}
</style>
