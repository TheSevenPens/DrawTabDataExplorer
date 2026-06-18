<script lang="ts">
	import { base, resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { brandName, type Tablet, type Pen, type Driver } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';

	let { data } = $props();

	let tablets: Tablet[] = $derived(data.tablets);
	let pens: Pen[] = $derived(data.pens);
	let drivers: Driver[] = $derived(data.drivers);
	let brands = $derived(data.brands);

	const OS_LABELS: Record<string, string> = { MACOS: 'macOS', WINDOWS: 'Windows' };

	let filterBrand = $state('');
	let filterType = $state('');
	let sortOrder: 'newest' | 'oldest' = $state('newest');
	let groupBy: 'year' | 'year-month' = $state('year');
	// yearFrom/yearTo are user-editable range inputs seeded from the loaded
	// data once. `untrack` tells the compiler the initial read is deliberate.
	let yearFrom = $state(untrack(() => data.yearFrom));
	let yearTo = $state(untrack(() => data.yearTo));

	const MONTHS = [
		'',
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec',
	];

	interface Period {
		sort: string;
		year: string;
		month: number | null; // 1-12 when known
		monthUnknown: boolean; // year-month mode, item has no month
		tablets: Tablet[];
		pens: Pen[];
		drivers: Driver[];
	}

	// Period bucket for an item. In year mode everything keys on the launch
	// year. In year-month mode, tablets with a month-precision ReleaseDate
	// (YYYY-MM…) key on that month; year-only dates and all pens (which have
	// no release date) drop into a per-year "month unknown" bucket.
	function periodKey(year: string, releaseDate: string | undefined) {
		if (groupBy === 'year-month' && releaseDate && /^\d{4}-\d{2}/.test(releaseDate)) {
			const ym = releaseDate.slice(0, 7);
			return { sort: ym, year: ym.slice(0, 4), month: Number(ym.slice(5, 7)), monthUnknown: false };
		}
		if (groupBy === 'year-month') {
			return { sort: `${year}-00`, year, month: null, monthUnknown: true };
		}
		return { sort: year, year, month: null, monthUnknown: false };
	}

	let groupedTimeline = $derived.by(() => {
		const from = Number(yearFrom);
		const to = Number(yearTo);
		const inRange = (y: string) => {
			const n = Number(y);
			if (isNaN(n)) return false;
			if (isNaN(from) || isNaN(to)) return true;
			return n >= from && n <= to;
		};

		// Transient local accumulator rebuilt each computation, not reactive
		// state — a plain Map is correct (no SvelteMap reactivity needed).
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const map = new Map<string, Period>();
		const ensure = (k: Omit<Period, 'tablets' | 'pens' | 'drivers'>) => {
			let p = map.get(k.sort);
			if (!p) {
				p = { ...k, tablets: [], pens: [], drivers: [] };
				map.set(k.sort, p);
			}
			return p;
		};

		for (const t of tablets) {
			if (filterBrand && t.Model.Brand !== filterBrand) continue;
			if (filterType && t.Model.Type !== filterType) continue;
			if (!inRange(t.Model.LaunchYear)) continue;
			ensure(periodKey(t.Model.LaunchYear, t.Model.ReleaseDate)).tablets.push(t);
		}
		// Type is a tablet property, so the type filter doesn't apply to pens
		// (matches prior behavior); pens still honor brand + year-range filters.
		for (const p of pens) {
			if (filterBrand && p.Brand !== filterBrand) continue;
			if (!inRange(p.PenYear)) continue;
			ensure(periodKey(p.PenYear, undefined)).pens.push(p);
		}
		// Drivers carry a full ReleaseDate (no LaunchYear); the year is its first
		// 4 chars. Like pens, drivers ignore the tablet-only type filter.
		for (const d of drivers) {
			if (filterBrand && d.Brand !== filterBrand) continue;
			const year = (d.ReleaseDate ?? '').slice(0, 4);
			if (!inRange(year)) continue;
			ensure(periodKey(year, d.ReleaseDate)).drivers.push(d);
		}

		// Year mode fills empty years across the visible range so gaps read as
		// "No releases". Year-month mode would explode into mostly-empty months,
		// so it only lists periods that actually have releases.
		if (groupBy === 'year' && !isNaN(from) && !isNaN(to)) {
			for (let y = from; y <= to; y++) {
				const k = String(y);
				if (!map.has(k))
					map.set(k, {
						sort: k,
						year: k,
						month: null,
						monthUnknown: false,
						tablets: [],
						pens: [],
						drivers: [],
					});
			}
		}

		const periods = [...map.values()];
		periods.sort((a, b) =>
			sortOrder === 'newest' ? b.sort.localeCompare(a.sort) : a.sort.localeCompare(b.sort),
		);
		return periods;
	});

	let totalTablets = $derived(groupedTimeline.reduce((sum, e) => sum + e.tablets.length, 0));
	let totalPens = $derived(groupedTimeline.reduce((sum, e) => sum + e.pens.length, 0));
	let totalDrivers = $derived(groupedTimeline.reduce((sum, e) => sum + e.drivers.length, 0));
	let periodNoun = $derived(groupBy === 'year' ? 'years' : 'periods');
</script>

<Nav />

<div class="title-row">
	<h1>Timeline</h1>
	<span class="subtitle"
		>{groupedTimeline.length}
		{periodNoun}, {totalTablets} tablets, {totalPens} pens, {totalDrivers}
		drivers</span
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
	<select bind:value={groupBy}>
		<option value="year">Group by Year</option>
		<option value="year-month">Group by Year-Month</option>
	</select>
	<select bind:value={sortOrder}>
		<option value="newest">Newest First</option>
		<option value="oldest">Oldest First</option>
	</select>
	<span class="year-range">
		<label for="year-from">From</label>
		<input id="year-from" type="number" bind:value={yearFrom} min={data.minYear} max={yearTo} />
		<label for="year-to">To</label>
		<input id="year-to" type="number" bind:value={yearTo} min={yearFrom} max={data.maxYear} />
	</span>
</div>

<div class="timeline">
	{#each groupedTimeline as entry (entry.sort)}
		<div class="year-block">
			<div class="year-label">
				<span class="period-year">{entry.year}</span>
				{#if entry.month}
					<span class="period-month">{MONTHS[entry.month]}</span>
				{:else if entry.monthUnknown}
					<span class="period-month dim">no month</span>
				{/if}
			</div>
			<div class="year-content">
				{#if entry.tablets.length === 0 && entry.pens.length === 0 && entry.drivers.length === 0}
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
				{#if entry.drivers.length > 0}
					<div class="category">
						<h3>Drivers ({entry.drivers.length})</h3>
						<div class="items">
							{#each entry.drivers as d (d.EntityId)}
								<a
									class="item driver"
									href={resolve('/entity/[entityId]', { entityId: d.EntityId })}
								>
									<span class="item-brand">{brandName(d.Brand)}</span>
									<span class="item-name">{d.DriverVersion}</span>
									<span class="item-id">{OS_LABELS[d.OSFamily] ?? d.OSFamily}</span>
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
		flex-wrap: wrap;
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
		width: 64px;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		text-align: right;
	}

	.period-year {
		font-size: 20px;
		font-weight: 700;
		color: var(--text);
		line-height: 1.1;
	}

	.period-month {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
	}

	.period-month.dim {
		font-weight: 500;
		color: var(--text-dim);
		font-style: italic;
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

	.item.pen:hover,
	.item.driver:hover {
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
