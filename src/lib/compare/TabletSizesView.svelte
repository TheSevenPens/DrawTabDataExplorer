<script lang="ts">
	// The Compare "sizes" view for tablets (#373): the compared tablets'
	// digitizer outlines, then their diagonals on the size-category scale,
	// one marker per member in its column's colour. The population of all
	// tablets is a context layer (on by default, #380) with its own year
	// filter — the text always says which marks are the comparison.
	import { getDiagonal, type Tablet } from '$data/lib/drawtab-loader.js';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import TabletDimensionComparison from '$lib/components/TabletDimensionComparison.svelte';
	import ValueHistogram from '$lib/components/ValueHistogram.svelte';
	import { unitPreference } from '$lib/unit-store.js';
	import { tabletBrandAndName } from '$lib/tablet-helpers.js';
	import {
		penTabletRangesCm,
		penTabletRangesIn,
		displayRangesCm,
		displayRangesIn,
		mixedRangesCm,
		mixedRangesIn,
		MM_TO_IN,
		MM_TO_CM,
	} from '$lib/tablet-size-ranges.js';
	import type { ResolvedColumn } from './resolve';
	import {
		populationNoun,
		sizeMarkers,
		sizeSubtitle,
		sizeTypeFilter,
		type SizeTypeFilter,
	} from './tablet-sizes';

	let {
		columns,
		colors,
		allTablets,
	}: { columns: ResolvedColumn<Tablet>[]; colors: string[]; allTablets: Tablet[] } = $props();

	// Each tablet once, for the outlines.
	let tablets = $derived([
		...new Map(columns.flatMap((c) => c.models).map((t) => [t.Meta.EntityId, t])).values(),
	]);

	let isMetric = $derived($unitPreference === 'metric');
	const currentYear = new Date().getFullYear();
	let compareYears = $state<number | null>(15);
	let showContext = $state(true);
	let layout: 'stacked' | 'side' = $state('stacked');

	let typeFilter: SizeTypeFilter = $derived(sizeTypeFilter(tablets.map((t) => t.Model.Type)));
	let noun = $derived(populationNoun(typeFilter));

	let dimItems = $derived(
		tablets
			.filter(
				(t) => t.Digitizer?.Dimensions?.Width != null && t.Digitizer?.Dimensions?.Height != null,
			)
			.map((t) => ({ dims: t.Digitizer!.Dimensions!, label: tabletBrandAndName(t) })),
	);

	const ofType = (t: Tablet, f: SizeTypeFilter) =>
		f === 'ALL' ||
		(f === 'PENTABLET' ? t.Model.Type === 'PENTABLET' : t.Model.Type !== 'PENTABLET');
	const diag = (t: Tablet) => {
		const d = getDiagonal(t.Digitizer?.Dimensions);
		return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null;
	};

	let histValues = $derived(
		allTablets
			.filter((t) => {
				if (!ofType(t, typeFilter)) return false;
				if (compareYears === null) return true;
				const y = parseInt(t.Model.ReleaseYear, 10);
				return isNaN(y) || y >= currentYear - compareYears;
			})
			.map(diag)
			.filter((d): d is number => d !== null),
	);
	let markers = $derived(sizeMarkers(columns, colors, diag, (t) => t.Model.Name));

	let ranges = $derived(
		typeFilter === 'ALL'
			? isMetric
				? mixedRangesCm
				: mixedRangesIn
			: typeFilter === 'PENTABLET'
				? isMetric
					? penTabletRangesCm
					: penTabletRangesIn
				: isMetric
					? displayRangesCm
					: displayRangesIn,
	);
	let subtitle = $derived(
		sizeSubtitle({
			markerCount: markers.length,
			columnCount: columns.length,
			context: showContext ? { noun, years: compareYears, count: histValues.length } : null,
		}),
	);
</script>

{#if dimItems.length === 0}
	<EmptyState>None of the compared tablets has digitizer dimensions recorded.</EmptyState>
{:else}
	<section>
		<div class="head">
			<h2>digitizer dimensions</h2>
			<SegmentedControl
				ariaLabel="Outline layout"
				options={[
					{ value: 'stacked', label: 'stacked' },
					{ value: 'side', label: 'side by side' },
				]}
				bind:value={layout}
			/>
		</div>
		<TabletDimensionComparison items={dimItems} showISO={false} stacked={layout === 'stacked'} />
	</section>
{/if}

{#if markers.length > 0}
	<section>
		<h2>diagonal size</h2>
		<ValueHistogram
			title="Diagonal size of the compared tablets"
			{subtitle}
			values={histValues}
			distribution={showContext}
			currentValue={null}
			{ranges}
			unit={isMetric ? ' cm' : '"'}
			binSize={isMetric ? 1 : 0.5}
			bandwidthMultiplier={0.2}
			{markers}
			bind:compareYears
		>
			{#snippet extraControls()}
				<label class="context">
					<input type="checkbox" bind:checked={showContext} />
					show all {noun} for context
				</label>
			{/snippet}
		</ValueHistogram>
		<!-- The markers' colours are identities: this names each one. -->
		<ul class="legend" aria-label="Columns">
			{#each columns as col, i (col.id)}
				<li>
					<span class="swatch" style:background={colors[i]} aria-hidden="true"></span>{col.name}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	section {
		margin-top: 20px;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 6px;
	}

	h2 {
		font-size: var(--type-subhead);
		font-weight: 400;
		letter-spacing: var(--track-tight);
		color: var(--text);
		margin: 0 0 6px 0;
	}

	.head h2 {
		margin: 0;
	}

	.context {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}

	.legend {
		list-style: none;
		margin: 8px 0 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		font-size: var(--type-caption);
		color: var(--text);
	}

	.swatch {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin-right: 6px;
	}
</style>
