<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadPensFromURL, loadPenCompatFromURL, loadTabletsFromURL, loadPressureResponseFromURL, type Tablet, type PressureResponse } from '$data/lib/drawtab-loader.js';
	import { type Pen, PEN_FIELDS, PEN_FIELD_GROUPS } from '$data/lib/entities/pen-fields.js';
	import { type PenCompat } from '$data/lib/entities/pen-compat-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';

	let pen: Pen | null = $state(null);
	let compatibleTablets: Tablet[] = $state([]);
	let includedWithTablets: Tablet[] = $state([]);
	let pressureSessionCount = $state(0);
	let notFound = $state(false);

	onMount(async () => {
		const entityId = decodeURIComponent(page.params.entityId);
		const [allPens, allCompat, allTablets, allPressure] = await Promise.all([
			loadPensFromURL(base) as Promise<Pen[]>,
			loadPenCompatFromURL(base) as Promise<PenCompat[]>,
			loadTabletsFromURL(base),
			loadPressureResponseFromURL(base),
		]);

		const found = allPens.find((p) => p.EntityId === entityId);
		if (!found) {
			notFound = true;
			return;
		}
		pen = found;

		const compatTabletIds = new Set(
			allCompat
				.filter((c) => c.PenId === found.PenId)
				.map((c) => c.TabletId)
		);

		compatibleTablets = allTablets.filter((t) => compatTabletIds.has(t.ModelId));

		// Pressure response data
		pressureSessionCount = allPressure.filter(s => s.PenEntityId === found.EntityId).length;

		// Find tablets that include this pen
		includedWithTablets = allTablets.filter((t) => {
			const included = t.ModelIncludedPen ?? '';
			return included.split(',').some((p) => p.trim() === found.PenId);
		});
	});
</script>

{#if notFound}
	<h1>Pen not found</h1>
	<p><a href="{base}/pens">Back to pens</a></p>
{:else}
	<h1>{pen?.PenName ?? 'Loading...'}</h1>

	<DetailView item={pen} fields={PEN_FIELDS} fieldGroups={PEN_FIELD_GROUPS} backHref="/pens" backLabel="Pens" />

	{#if pen}
		<section class="compat-section">
			<h2>Compatible Tablets</h2>
			{#if compatibleTablets.length > 0}
				<ul class="entity-list">
					{#each compatibleTablets as tablet}
						<li><a href="{base}/tablets/{encodeURIComponent(tablet.EntityId)}">{tablet.Brand} {tablet.ModelName} ({tablet.ModelId})</a></li>
					{/each}
				</ul>
			{:else}
				<p class="no-data">No tablet compatibility data available for this pen.</p>
			{/if}
		</section>

		<section class="compat-section">
			<h2>Included With Tablets</h2>
			{#if includedWithTablets.length > 0}
				<ul class="entity-list">
					{#each includedWithTablets as tablet}
						<li><a href="{base}/tablets/{encodeURIComponent(tablet.EntityId)}">{tablet.Brand} {tablet.ModelName} ({tablet.ModelId})</a></li>
					{/each}
				</ul>
			{:else}
				<p class="no-data">No tablets list this pen as included.</p>
			{/if}
		</section>

		<section class="compat-section">
			<h2>Pressure Response Data</h2>
			{#if pressureSessionCount > 0}
				<p class="pr-link"><a href="{base}/pressure-response/{encodeURIComponent(pen.EntityId)}">{pressureSessionCount} measurement session{pressureSessionCount === 1 ? '' : 's'} available</a></p>
			{:else}
				<p class="no-data">No pressure response data available for this pen model.</p>
			{/if}
		</section>
	{/if}
{/if}

<style>
	.compat-section {
		margin-top: 32px;
	}

	.compat-section h2 {
		font-size: 15px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 8px;
		padding-bottom: 4px;
		border-bottom: 2px solid #e0e0e0;
	}

	.entity-list {
		list-style: none;
		padding: 0;
	}

	.entity-list li {
		padding: 4px 0;
		font-size: 13px;
	}

	.entity-list a {
		color: #2563eb;
		text-decoration: none;
	}

	.entity-list a:hover { text-decoration: underline; }

	.pr-link {
		font-size: 13px;
	}

	.pr-link a {
		color: #2563eb;
		text-decoration: none;
	}

	.pr-link a:hover { text-decoration: underline; }

	.no-data {
		font-size: 13px;
		color: #999;
		font-style: italic;
	}
</style>
