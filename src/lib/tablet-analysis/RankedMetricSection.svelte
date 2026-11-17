<script lang="ts" module>
	import type { MetricRankRow } from '$lib/tablet-analysis/helpers.js';

	/**
	 * Config for one numeric attribute's Lowest / Highest rankings. Adding an
	 * attribute to the ranked-metric pattern means writing one of these.
	 */
	export interface RankedMetric {
		/** Section id; also the export filename stem (`analysis-<id>-lowest`). */
		id: string;
		/** Attribute name, used as "Lowest <title>" / "Highest <title>". */
		title: string;
		/** Rank tab labels; default Lowest / Highest (e.g. Smallest / Largest). */
		lowLabel?: string;
		highLabel?: string;
		/** Export filename stem; default `analysis-<id>`. The tab label is appended. */
		filenameBase?: string;
		description: string;
		emptyText: string;
		/** Every rankable row — the pool before the tab's filters. */
		rows: MetricRankRow[];
		/** Brands present in `rows`, in dropdown order. */
		brands: string[];
		/** Type choices; omit to hide the Type dropdown. */
		types?: { value: string; label: string }[];
		valueLabel: string;
		unit: string;
		format: (v: number) => string;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Tabs from '$lib/components/Tabs.svelte';
	import MetricRankTable from '$lib/tablet-analysis/MetricRankTable.svelte';
	import {
		metricTabs,
		metricTabFromHash,
		metricTabHash,
		type MetricTab,
		type RankFilters,
	} from '$lib/tablet-analysis/metric-tabs.js';

	let {
		heading,
		metric,
		filters = $bindable(),
		distribution,
	}: {
		/** The section's one heading, above the tabs. */
		heading: string;
		metric: RankedMetric;
		filters: RankFilters;
		/** The Distribution tab's body (chart + table). */
		distribution: Snippet;
	} = $props();

	// The tab lives in the URL hash next to the section id, so back/forward
	// and bookmarks restore it (and the old -lowest / -highest section links
	// still work). SectionedPage maps those hashes back to this section.
	let tab = $derived(metricTabFromHash(page.url.hash, metric.id));

	function selectTab(next: MetricTab) {
		// page.url.pathname is already resolved (includes base path).
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${page.url.pathname}${page.url.search}#${metricTabHash(metric.id, next)}`, {
			noScroll: true,
			keepFocus: true,
		});
	}
</script>

<h2>{heading}</h2>
<Tabs
	tabs={metricTabs(metric.lowLabel, metric.highLabel)}
	bind:active={() => tab, (v) => selectTab(v as MetricTab)}
	hashed={false}
/>
{#if tab === 'distribution'}
	{@render distribution()}
{:else if tab === 'lowest'}
	<MetricRankTable {metric} direction="lowest" bind:filter={filters.lowest} />
{:else}
	<MetricRankTable {metric} direction="highest" bind:filter={filters.highest} />
{/if}
