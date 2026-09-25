<script lang="ts">
	// The Compare "sizes" view for tablets (#373), ported from the old
	// /tablet-compare Compare sizes tab: the compared tablets' digitizer
	// outlines, then where their diagonals sit among all tablets. Every
	// member of every column is drawn once.
	import { getDiagonal, type Tablet } from '$data/lib/drawtab-loader.js';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import TabletDimensionComparison from '$lib/components/TabletDimensionComparison.svelte';
	import ValueHistogram, { type HistogramMarker } from '$lib/components/ValueHistogram.svelte';
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

	let { tablets, allTablets }: { tablets: Tablet[]; allTablets: Tablet[] } = $props();

	type TypeFilter = 'PENTABLET' | 'PENDISPLAY' | 'ALL';

	let isMetric = $derived($unitPreference === 'metric');
	const currentYear = new Date().getFullYear();
	let compareYears = $state<number | null>(15);
	let layout: 'stacked' | 'side' = $state('stacked');

	let hasPenTablets = $derived(tablets.some((t) => t.Model.Type === 'PENTABLET'));
	let hasDisplays = $derived(tablets.some((t) => t.Model.Type !== 'PENTABLET'));
	let typeFilter: TypeFilter = $derived(
		hasPenTablets && hasDisplays ? 'ALL' : hasPenTablets ? 'PENTABLET' : 'PENDISPLAY',
	);

	let dimItems = $derived(
		tablets
			.filter(
				(t) => t.Digitizer?.Dimensions?.Width != null && t.Digitizer?.Dimensions?.Height != null,
			)
			.map((t) => ({ dims: t.Digitizer!.Dimensions!, label: tabletBrandAndName(t) })),
	);

	const ofType = (t: Tablet, f: TypeFilter) =>
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
	let markers: HistogramMarker[] = $derived(
		tablets
			.map((t) => {
				const d = diag(t);
				return d === null ? null : { value: d, label: t.Model.Name };
			})
			.filter((m): m is HistogramMarker => m !== null),
	);

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
	let population = $derived(
		typeFilter === 'ALL'
			? 'all tablets'
			: typeFilter === 'PENTABLET'
				? 'all pen tablets'
				: 'all pen displays',
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

{#if histValues.length > 0 && markers.length > 0}
	<section>
		<h2>size among {population}</h2>
		<ValueHistogram
			title="Compared tablets against {population}"
			values={histValues}
			currentValue={null}
			{ranges}
			unit={isMetric ? ' cm' : '"'}
			binSize={isMetric ? 1 : 0.5}
			bandwidthMultiplier={0.2}
			{markers}
			bind:compareYears
		/>
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
</style>
