<script lang="ts">
	import { base } from '$app/paths';
	import { getDiagonal, type Tablet } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';
	import { type TabletFamily, TABLET_FAMILY_FIELDS, TABLET_FAMILY_FIELD_GROUPS } from '$data/lib/entities/tablet-family-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';
	import ValueHistogram, { type HistogramRange, type HistogramMarker } from '$lib/components/ValueHistogram.svelte';
	import { unitPreference } from '$lib/unit-store.js';
	import { penTabletRangesCm, penTabletRangesIn, displayRangesCm, displayRangesIn, MM_TO_IN, MM_TO_CM } from '$lib/tablet-size-ranges.js';

	let { data } = $props();
	const family: TabletFamily = data.family;
	const familyTablets: Tablet[] = data.familyTablets;
	const allTablets: Tablet[] = data.allTablets;

	let isMetric = $derived($unitPreference === 'metric');

	let familyType = $derived(
		familyTablets.find(t => getDiagonal(t.Digitizer?.Dimensions) !== null)?.Model.Type ?? 'PENTABLET'
	);

	let histogramRanges = $derived<HistogramRange[]>(
		familyType === 'PENTABLET'
			? (isMetric ? penTabletRangesCm : penTabletRangesIn)
			: (isMetric ? displayRangesCm : displayRangesIn)
	);

	let histogramValues = $derived(
		allTablets
			.filter(t => t.Model.Type === familyType)
			.map(t => { const d = getDiagonal(t.Digitizer?.Dimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let histogramMarkers = $derived<HistogramMarker[]>(
		familyTablets
			.map(t => {
				const d = getDiagonal(t.Digitizer?.Dimensions);
				if (!d) return null;
				return { value: isMetric ? d * MM_TO_CM : d * MM_TO_IN, label: t.Model.Name };
			})
			.filter((m): m is HistogramMarker => m !== null)
	);
</script>

<Nav />

<h1>{family.FamilyName}</h1>
<DetailView item={family} fields={TABLET_FAMILY_FIELDS} fieldGroups={TABLET_FAMILY_FIELD_GROUPS} />

<section class="family-section">
	<h2>Tablets in this Family</h2>
	{#if familyTablets.length > 0}
		<table>
			<thead>
				<tr>
					<th>Model ID</th>
					<th>Name</th>
					<th>Type</th>
					<th>Year</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{#each familyTablets as tablet}
					<tr>
						<td><a href="{base}/tablets/{encodeURIComponent(tablet.Meta.EntityId)}">{tablet.Model.Id}</a></td>
						<td>{tablet.Model.Name}</td>
						<td>{tablet.Model.Type}</td>
						<td>{tablet.Model.LaunchYear || ''}</td>
						<td>{tablet.Model.Status || ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<p class="no-data">No tablets found in this family.</p>
	{/if}
</section>

{#if histogramMarkers.length > 0}
	<section class="family-section">
		<h2>Size Comparison</h2>
		<ValueHistogram
			title="{family.FamilyName} — active area diagonal"
			values={histogramValues}
			currentValue={null}
			ranges={histogramRanges}
			unit={isMetric ? ' cm' : '"'}
			binSize={isMetric ? 1 : 0.5}
			bandwidthMultiplier={0.2}
			markers={histogramMarkers}
		/>
	</section>
{/if}

<style>
	.family-section { margin-top: 32px; }

	.family-section h2 {
		font-size: 15px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 8px;
		padding-bottom: 4px;
		border-bottom: 2px solid #e0e0e0;
	}

	table { width: 100%; border-collapse: collapse; background: #fff; font-size: 13px; }
	th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
	th { background: #333; color: #fff; }
	tr:hover td { background: #f0f7ff; }
	td a { color: #2563eb; text-decoration: none; }
	td a:hover { text-decoration: underline; }
	.no-data { font-size: 13px; color: #999; font-style: italic; }
</style>
