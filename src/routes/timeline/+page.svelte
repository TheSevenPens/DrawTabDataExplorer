<script lang="ts">
	import { base, resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { brandName } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';

	let { data } = $props();

	let timeline = $derived(data.timeline);
	let brands = $derived(data.brands);
	let allYears = $derived(data.allYears);

	let filterBrand = $state('');
	let filterType = $state('');
	let sortOrder: 'newest' | 'oldest' = $state('newest');
	// yearFrom/yearTo are user-editable range inputs seeded from the
	// loaded data once. `untrack` tells the compiler the initial-value
	// read is deliberate.
	let yearFrom = $state(untrack(() => data.yearFrom));
	let yearTo = $state(untrack(() => data.yearTo));

	let filteredTimeline = $derived.by(() => {
		let result = timeline;
		const from = Number(yearFrom);
		const to = Number(yearTo);
		if (!isNaN(from) && !isNaN(to)) {
			result = result.filter((e) => {
				const y = Number(e.year);
				return !isNaN(y) && y >= from && y <= to;
			});
		}
		if (sortOrder === 'oldest') {
			result = [...result].reverse();
		}
		return result.map((entry) => {
			let tablets = entry.tablets;
			let pens = entry.pens;
			if (filterBrand) {
				tablets = tablets.filter((t) => t.Model.Brand === filterBrand);
				pens = pens.filter((p) => p.Brand === filterBrand);
			}
			if (filterType) {
				tablets = tablets.filter((t) => t.Model.Type === filterType);
			}
			return { year: entry.year, tablets, pens };
		});
	});

	let totalTablets = $derived(filteredTimeline.reduce((sum, e) => sum + e.tablets.length, 0));
	let totalPens = $derived(filteredTimeline.reduce((sum, e) => sum + e.pens.length, 0));
</script>

<Nav />

<div class="title-row">
	<h1>Timeline</h1>
	<span class="subtitle"
		>{filteredTimeline.length} years, {totalTablets} tablets, {totalPens} pens</span
	>
</div>

<div class="filters">
	<select bind:value={filterBrand}>
		<option value="">All Brands</option>
		{#each brands as b (b)}
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
	<span class="year-range">
		<label for="year-from">From</label>
		<input id="year-from" type="number" bind:value={yearFrom} min={allYears[0]} max={yearTo} />
		<label for="year-to">To</label>
		<input
			id="year-to"
			type="number"
			bind:value={yearTo}
			min={yearFrom}
			max={allYears[allYears.length - 1]}
		/>
	</span>
</div>

<div class="timeline">
	{#each filteredTimeline as entry (entry.year)}
		<div class="year-block">
			<div class="year-label">{entry.year}</div>
			<div class="year-content">
				{#if entry.tablets.length === 0 && entry.pens.length === 0}
					<p class="no-releases">No releases</p>
				{/if}
				{#if entry.tablets.length > 0}
					<div class="category">
						<h3>Tablets ({entry.tablets.length})</h3>
						<div class="items">
							{#each entry.tablets as t (t.Meta.EntityId)}
								<div
									class="item tablet"
									role="link"
									tabindex="0"
									ondblclick={() => {
										window.location.href = `${base}/entity/${encodeURIComponent(t.Meta.EntityId)}`;
									}}
									onkeydown={(e) => {
										if (e.key === 'Enter')
											window.location.href = `${base}/entity/${encodeURIComponent(t.Meta.EntityId)}`;
									}}
								>
									<span class="item-brand">{brandName(t.Model.Brand)}</span>
									<span class="item-name">{t.Model.Name}</span>
									<span class="item-id">{t.Model.Id}</span>
									<span class="item-type">{t.Model.Type}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
				{#if entry.pens.length > 0}
					<div class="category">
						<h3>Pens ({entry.pens.length})</h3>
						<div class="items">
							{#each entry.pens as p (p.EntityId)}
								<a class="item pen" href={resolve('/entity/[entityId]', { entityId: p.EntityId })}>
									<span class="item-brand">{brandName(p.Brand)}</span>
									<span class="item-name">{p.PenName}</span>
									<span class="item-id">{p.PenId}</span>
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

	h1 {
		margin: 0;
	}

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

	.year-range {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.year-range label {
		font-size: 13px;
		color: var(--text-muted);
	}

	.year-range input {
		width: 70px;
		padding: 5px 8px;
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

	.no-releases {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
		margin: 0;
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

	.item.tablet {
		cursor: default;
	}

	.item.tablet:hover {
		border-color: var(--border);
		background: var(--hover-bg);
	}

	.item.pen:hover {
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

	.item-id {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-muted);
	}

	.item-type {
		font-size: 10px;
		color: var(--text-dim);
		text-transform: uppercase;
	}
</style>
