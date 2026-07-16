<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { resolve } from '$app/paths';
	import { brandName, type Pen, type PenFamily } from '$data/lib/drawtab-loader.js';
	import { penIdRedundantInName } from '$data/lib/entities/pen-fields.js';
	import Button from '$lib/components/Button.svelte';
	import { penBrandAndName } from '$lib/pen-helpers.js';
	import {
		flaggedPenUnits,
		flaggedPenModels,
		flaggedPenFamilies,
		flaggedPenTotalCount,
		toggleFlaggedPenUnit,
		toggleFlaggedPenModel,
		toggleFlaggedPenFamily,
		clearAllPenFlags,
	} from '$lib/flagged-store.js';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import FlagButton from '$lib/components/FlagButton.svelte';
	import { penSubNavTabs } from '$lib/nav/subnav-tabs.js';

	let { data } = $props();

	let penTabs = $derived(penSubNavTabs({ flaggedPenCount: $flaggedPenTotalCount }));

	// Cast to the bare entity types: the DataSet returns *WithRels-augmented
	// records, but this page doesn't use any relationship methods, and
	// downstream predicates are typed against the bare shapes.
	let pens: Pen[] = $derived(data.pens as Pen[]);
	let families: PenFamily[] = $derived(data.families as PenFamily[]);
	// `sessions` is still needed to look up pen/brand metadata for the
	// Flagged Pen Units list (inventory IDs alone don't carry pen info).
	let sessions = $derived(data.sessions);

	let pensByEntityId = $derived(new Map(pens.map((p) => [p.EntityId.toLowerCase(), p])));
	let familiesByEntityId = $derived(new Map(families.map((f) => [f.EntityId.toLowerCase(), f])));

	let flaggedModelEntries = $derived(
		$flaggedPenModels
			.map((id) => ({ id, pen: pensByEntityId.get(id) }))
			.filter((e): e is { id: string; pen: Pen } => !!e.pen),
	);

	let flaggedFamilyEntries = $derived(
		$flaggedPenFamilies
			.map((id) => ({ id, family: familiesByEntityId.get(id) }))
			.filter((e): e is { id: string; family: PenFamily } => !!e.family),
	);

	// Resolve flagged pen units (inventory IDs) by looking at sessions —
	// each unit's pen entity ID + a sample inventory display from sessions.
	let unitInfo = $derived(
		(() => {
			const out = new Map<
				string,
				{ penEntityId: string; brand: string; inventoryDisplay: string }
			>();
			for (const s of sessions) {
				const id = s.InventoryId.toLowerCase();
				if (!out.has(id)) {
					out.set(id, {
						penEntityId: s.PenEntityId,
						brand: s.Brand,
						inventoryDisplay: s.InventoryId,
					});
				}
			}
			return out;
		})(),
	);

	let flaggedUnitEntries = $derived($flaggedPenUnits.map((id) => ({ id, info: unitInfo.get(id) })));
</script>

<Nav />
<SubNav tabs={penTabs} />

<div class="header">
	<h1 class="sr-only">Flagged Pens</h1>
	<p class="meta">
		{$flaggedPenTotalCount} item{$flaggedPenTotalCount === 1 ? '' : 's'} flagged across pen units, models,
		and families. See the pressure-response overlay on
		<a href={resolve('/pen-compare')}>Pens ▸ Compare ▸ Pressure Response</a>.
	</p>
	{#if $flaggedPenTotalCount > 0}
		<Button variant="danger" onclick={clearAllPenFlags}>Clear all flags</Button>
	{/if}
</div>

{#if $flaggedPenTotalCount === 0}
	<EmptyState>
		Nothing flagged yet. Open a pen, pen family, or inventory pen and click the ⚐ button to flag it.
	</EmptyState>
{:else}
	{#if flaggedModelEntries.length > 0}
		<section>
			<h2>Pen Models ({flaggedModelEntries.length})</h2>
			<ul class="entries">
				{#each flaggedModelEntries as e (e.id)}
					<li>
						<FlagButton flagged={true} onclick={() => toggleFlaggedPenModel(e.id)} label="Unflag" />
						<a href={resolve('/entity/[entityId]', { entityId: e.id })}>
							{penBrandAndName(e.pen)}
							{#if !penIdRedundantInName(e.pen)}<span class="dim">({e.pen.PenId})</span>{/if}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if flaggedFamilyEntries.length > 0}
		<section>
			<h2>Pen Families ({flaggedFamilyEntries.length})</h2>
			<ul class="entries">
				{#each flaggedFamilyEntries as e (e.id)}
					<li>
						<FlagButton
							flagged={true}
							onclick={() => toggleFlaggedPenFamily(e.id)}
							label="Unflag"
						/>
						<a href={resolve('/entity/[entityId]', { entityId: e.id })}>
							{e.family.FamilyName}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if flaggedUnitEntries.length > 0}
		<section>
			<h2>Pen Units ({flaggedUnitEntries.length})</h2>
			<ul class="entries">
				{#each flaggedUnitEntries as e (e.id)}
					<li>
						<FlagButton flagged={true} onclick={() => toggleFlaggedPenUnit(e.id)} label="Unflag" />
						<span class="mono">{e.info?.inventoryDisplay ?? e.id}</span>
						{#if e.info}
							<span class="dim">·</span>
							<a href={resolve('/entity/[entityId]', { entityId: e.info.penEntityId })}>
								{e.info.penEntityId}
							</a>
							<span class="dim">·</span>
							<span class="dim">{brandName(e.info.brand)}</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<p class="meta">
		See the per-session detail at
		<a href={resolve('/pressure-response')}>Pens ▸ Pressure Response</a>.
	</p>
{/if}

<style>
	.header {
		margin-bottom: 16px;
	}
	.meta {
		margin: 0;
		color: var(--text-muted);
		font-size: 13px;
	}
	section h2 {
		font-size: 16px;
		margin: 24px 0 8px;
	}
	.entries {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.entries li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 0;
		font-size: 14px;
	}
	.entries a {
		color: var(--link);
		text-decoration: none;
	}
	.entries a:hover {
		text-decoration: underline;
	}
	.dim {
		color: var(--text-muted);
		font-size: 12px;
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
</style>
