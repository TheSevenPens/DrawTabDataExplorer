<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';
	import ValueHistogram, {
		type HistogramRange,
		type HistogramMarker,
	} from '$lib/components/ValueHistogram.svelte';

	// Shared x-axis ranges (pen display scale, inches)
	const ranges: HistogramRange[] = [
		{ label: 'Small', min: 10, max: 13 },
		{ label: 'Medium', min: 13, max: 16 },
		{ label: 'Large', min: 16, max: 22 },
		{ label: 'XL', min: 22, max: 27 },
	];

	// Synthetic background population — uniform-ish spread across 10–27"
	function syntheticValues(count = 120): number[] {
		const vals: number[] = [];
		for (let i = 0; i < count; i++) {
			vals.push(10 + (i / (count - 1)) * 17);
		}
		return vals;
	}
	const bgValues = syntheticValues();

	// ── Test cases ────────────────────────────────────────────────────────────

	interface TestCase {
		title: string;
		description: string;
		markers: HistogramMarker[];
		currentValue?: number;
		ranges?: HistogramRange[];
	}

	const testCases: TestCase[] = [
		{
			title: 'Single marker',
			description: 'Baseline — one marker should sit on tier 0 with no issues.',
			markers: [{ value: 15.6, label: 'CTL-6100' }],
		},
		{
			title: 'Two well-separated markers',
			description: 'Both should fit on tier 0.',
			markers: [
				{ value: 12.1, label: 'CTL-4100' },
				{ value: 21.5, label: 'CTL-8100' },
			],
		},
		{
			title: 'Two close markers — slight gap',
			description: 'Second should drop to tier 1 because labels would overlap on tier 0.',
			markers: [
				{ value: 15.4, label: 'KAM13' },
				{ value: 15.6, label: 'KAM13P' },
			],
		},
		{
			title: 'Three ascending, evenly spaced',
			description: 'All three should fit on tier 0 (enough horizontal gap).',
			markers: [
				{ value: 11.0, label: 'SMALL' },
				{ value: 15.6, label: 'MEDIUM' },
				{ value: 21.5, label: 'LARGE' },
			],
		},
		{
			title: 'Dense cluster — 5 markers in a narrow band',
			description:
				'Kamvas-style: 12", 13", 15.6", 16", 19". Should spread cleanly across tiers without piling up.',
			markers: [
				{ value: 11.9, label: 'KAM12' },
				{ value: 13.3, label: 'KAM13' },
				{ value: 15.6, label: 'KAM16' },
				{ value: 15.8, label: 'KAM16P' },
				{ value: 19.0, label: 'KAM19' },
			],
		},
		{
			title: 'Extreme cluster — all at same value',
			description:
				'All five markers at 15.6". Every label should fall on its own tier (or gracefully overlap on deepest tier).',
			markers: [
				{ value: 15.6, label: 'AAAA' },
				{ value: 15.6, label: 'BBBB' },
				{ value: 15.6, label: 'CCCC' },
				{ value: 15.6, label: 'DDDD' },
				{ value: 15.6, label: 'EEEE' },
			],
		},
		{
			title: 'Two clusters separated by a gap',
			description:
				'Left cluster (10–13") and right cluster (20–23") should each lay out independently.',
			markers: [
				{ value: 10.1, label: 'S1' },
				{ value: 11.0, label: 'S2' },
				{ value: 12.4, label: 'S3' },
				{ value: 20.0, label: 'L1' },
				{ value: 21.5, label: 'L2' },
				{ value: 22.8, label: 'L3' },
			],
		},
		{
			title: 'Staircase — each marker slightly to the right of the last',
			description: 'Labels should prefer tier 0 as soon as there is enough clearance.',
			markers: [
				{ value: 10.5, label: 'A' },
				{ value: 12.0, label: 'BB' },
				{ value: 13.8, label: 'CCC' },
				{ value: 15.9, label: 'DDDD' },
				{ value: 18.2, label: 'EEEEE' },
				{ value: 21.0, label: 'FFFFFF' },
			],
		},
		{
			title: 'Long labels in a dense cluster',
			description: 'Labels are wide strings, so they need more horizontal clearance between tiers.',
			markers: [
				{ value: 13.5, label: 'Artist12-2nd' },
				{ value: 15.6, label: 'Artist16-2nd' },
				{ value: 15.8, label: 'Artist16-3rd' },
				{ value: 19.0, label: 'Artist19-2nd' },
				{ value: 21.5, label: 'Artist22Plus' },
			],
		},
		{
			title: 'Marker at far left edge',
			description: 'A marker near x=10 — label should not clip outside the SVG.',
			markers: [
				{ value: 10.05, label: 'EDGE' },
				{ value: 15.6, label: 'MID' },
				{ value: 26.9, label: 'FAR' },
			],
		},
		{
			title: 'With currentValue indicator',
			description:
				'The red current-value line should not conflict visually with nearby marker lines.',
			markers: [
				{ value: 15.4, label: 'KAM15' },
				{ value: 16.0, label: 'KAM16' },
			],
			currentValue: 15.6,
		},
		{
			title: 'Maximum stress — 10 markers across the range',
			description: 'Tests all 6 tiers. No label should be invisible or completely unreadable.',
			markers: [
				{ value: 10.1, label: 'T1' },
				{ value: 11.6, label: 'T2' },
				{ value: 12.4, label: 'T3' },
				{ value: 13.3, label: 'T4' },
				{ value: 14.1, label: 'T5' },
				{ value: 15.6, label: 'T6' },
				{ value: 17.3, label: 'T7' },
				{ value: 19.0, label: 'T8' },
				{ value: 21.5, label: 'T9' },
				{ value: 24.0, label: 'T10' },
			],
		},
		{
			title: 'Compare page — 6 flagged pen displays (max allowed)',
			description:
				'Simulates the worst case on the compare page: all 6 flagged slots used, all pen displays. With MARKER_TIERS < 6 the 5th and 6th items pile up on the last tier. All 6 should be readable with MARKER_TIERS = 6.',
			markers: [
				{ value: 12.6, label: 'Kamvas 12' },
				{ value: 13.6, label: 'Wacom One 13' },
				{ value: 15.6, label: 'Kamvas 16 GEN3' },
				{ value: 15.8, label: 'Artist 16 3rd' },
				{ value: 16.0, label: 'Intuos Pro 16' },
				{ value: 21.5, label: 'Kamvas 22 Plus' },
			],
		},
		{
			title: 'Real data — Huion Kamvas family (flagged tablets)',
			description:
				'Actual diagonals + model names from HUION-tablets.json. Two pairs nearly coincide: Kamvas 13 / Kamvas 13 GEN3 both at 13.27", and Kamvas 16 (2021) / Kamvas 16 GEN3 at 15.55" / 15.81". Long labels like "Kamvas 16 (2021)" (16 chars) make this a realistic stress test.',
			markers: [
				{ value: 11.56, label: 'Kamvas 12' },
				{ value: 13.27, label: 'Kamvas 13' },
				{ value: 13.27, label: 'Kamvas 13 GEN3' },
				{ value: 15.55, label: 'Kamvas 16 (2021)' },
				{ value: 15.81, label: 'Kamvas 16 GEN3' },
				{ value: 16.03, label: 'Inspiroy Giano G930L' },
			],
		},
		{
			title: 'Real data — 6 Huion tablets as shown on compare page',
			description:
				'These 6 tablets flagged together as they appear on the compare page histogram (label = Model.Name). Two coincident pairs at 13.27" and close together at 15.55"/15.81"/16.03" make this the primary real-world stress test.',
			ranges: [
				{ label: 'Small', min: 8, max: 13 },
				{ label: 'Medium', min: 13, max: 16 },
				{ label: 'Large', min: 16, max: 22 },
				{ label: 'XL', min: 22, max: 34 },
			],
			markers: [
				{ value: 11.56, label: 'Kamvas 12' },
				{ value: 13.27, label: 'Kamvas 13' },
				{ value: 13.27, label: 'Kamvas 13 GEN3' },
				{ value: 15.55, label: 'Kamvas 16 (2021)' },
				{ value: 15.81, label: 'Kamvas 16 GEN3' },
				{ value: 16.03, label: 'Inspiroy Giano G930L' },
			],
		},
	];
</script>

<Nav />

<div class="debug-page">
	<h1>Marker Layout Debug</h1>
	<p class="intro">
		Each section below is a standalone test case for the <code>ValueHistogram</code> marker tier placement
		algorithm. When changing the algorithm, work through all cases and verify they look correct before
		merging.
	</p>

	{#each testCases as tc, i}
		<section class="test-case">
			<div class="case-header">
				<span class="case-num">#{i + 1}</span>
				<h2>{tc.title}</h2>
			</div>
			<p class="case-desc">{tc.description}</p>
			<div class="marker-list">
				Markers:
				{#each tc.markers as m}
					<span class="marker-chip">{m.label} @ {m.value}"</span>
				{/each}
				{#if tc.currentValue !== undefined}
					<span class="current-chip">currentValue = {tc.currentValue}"</span>
				{/if}
			</div>
			<ValueHistogram
				values={bgValues}
				currentValue={tc.currentValue ?? null}
				ranges={tc.ranges ?? ranges}
				unit={'"'}
				binSize={0.5}
				bandwidthMultiplier={0.3}
				markers={tc.markers}
			/>
		</section>
	{/each}
</div>

<style>
	.debug-page {
		padding: 16px;
	}

	h1 {
		font-size: 20px;
		font-weight: 700;
		margin-bottom: 4px;
		color: var(--text);
	}

	.intro {
		font-size: 13px;
		color: var(--text-muted);
		margin-bottom: 24px;
	}

	.intro code {
		font-family: monospace;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 3px;
		padding: 1px 4px;
	}

	.test-case {
		margin-bottom: 40px;
		padding: 16px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-card);
	}

	.case-header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 4px;
	}

	.case-num {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-dim);
		min-width: 24px;
	}

	h2 {
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
		margin: 0;
	}

	.case-desc {
		font-size: 12px;
		color: var(--text-muted);
		margin: 0 0 8px 32px;
	}

	.marker-list {
		font-size: 11px;
		color: var(--text-dim);
		margin: 0 0 4px 32px;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
	}

	.marker-chip {
		background: #fff1f2;
		border: 1px solid #fecdd3;
		color: #be123c;
		border-radius: 4px;
		padding: 1px 6px;
		font-family: monospace;
		font-size: 11px;
	}

	.current-chip {
		background: #fef3c7;
		border: 1px solid #fcd34d;
		color: #92400e;
		border-radius: 4px;
		padding: 1px 6px;
		font-family: monospace;
		font-size: 11px;
	}
</style>
