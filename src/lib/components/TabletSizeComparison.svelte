<script lang="ts">
	import { getDiagonal, brandName, type Tablet, type ISOPaperSize } from '$data/lib/drawtab-loader.js';
	import { unitPreference } from '$lib/unit-store.js';
	import { penTabletRangesCm, penTabletRangesIn, displayRangesCm, displayRangesIn, MM_TO_IN, MM_TO_CM } from '$lib/tablet-size-ranges.js';
	import ValueHistogram, { type HistogramRange } from '$lib/components/ValueHistogram.svelte';

	let { tablet, allTablets, isoSizes }: {
		tablet: Tablet;
		allTablets: Tablet[];
		isoSizes: ISOPaperSize[];
	} = $props();

	const currentYear = new Date().getFullYear();
	let compareYears = $state<number | null>(15);
	let isMetric = $derived($unitPreference === 'metric');

	let histogramRanges = $derived.by((): HistogramRange[] => {
		if (tablet.Model.Type === 'PENTABLET') return isMetric ? penTabletRangesCm : penTabletRangesIn;
		return isMetric ? displayRangesCm : displayRangesIn;
	});

	let histogramValues = $derived(
		allTablets
			.filter(t => {
				if (t.Model.Type !== tablet.Model.Type) return false;
				if (compareYears !== null) {
					const year = parseInt(t.Model.LaunchYear, 10);
					if (!isNaN(year) && year < currentYear - compareYears) return false;
				}
				return true;
			})
			.map(t => { const d = getDiagonal(t.Digitizer?.Dimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let histogramCurrentValue = $derived.by(() => {
		const d = getDiagonal(tablet.Digitizer?.Dimensions);
		return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null;
	});

	let closestISO = $derived.by(() => {
		const diagMm = getDiagonal(tablet.Digitizer?.Dimensions);
		if (!diagMm) return null;
		const aSeries = isoSizes.filter(p => p.Series === 'A');
		if (aSeries.length === 0) return null;
		let best = aSeries[0];
		let bestDist = Infinity;
		for (const p of aSeries) {
			const pDiag = Math.sqrt(p.Width_mm ** 2 + p.Height_mm ** 2);
			const dist = Math.abs(pDiag - diagMm);
			if (dist < bestDist) { bestDist = dist; best = p; }
		}
		const bestDiag = Math.sqrt(best.Width_mm ** 2 + best.Height_mm ** 2);
		const pct = Math.round(Math.abs(diagMm - bestDiag) / bestDiag * 100);
		const qualifier = pct >= 1
			? (diagMm > bestDiag ? `${pct}% larger than ` : `${pct}% smaller than `)
			: '~ ';
		return `${qualifier}${best.Name}`;
	});

	const tabletLabel = `${brandName(tablet.Model.Brand)} ${tablet.Model.Name} (${tablet.Model.Id})`;
	const typeLabel = tablet.Model.Type === 'PENTABLET' ? 'pen tablets'
		: tablet.Model.Type === 'PENDISPLAY' ? 'pen displays'
		: 'standalone tablets';
</script>

<ValueHistogram
	title="{tabletLabel} active area diagonal compared to other {typeLabel}"
	values={histogramValues}
	currentValue={histogramCurrentValue}
	currentLabel={tabletLabel}
	ranges={histogramRanges}
	unit={isMetric ? ' cm' : '"'}
	binSize={isMetric ? 1 : 0.5}
	bandwidthMultiplier={0.2}
	bind:compareYears
/>

{#if closestISO}
	<p class="iso-note">Closest ISO paper size: <strong>{closestISO}</strong></p>
{/if}

<style>
	.iso-note {
		margin-top: 10px;
		font-size: 13px;
		color: var(--text-muted);
	}
</style>
