<script lang="ts">
	// Flagged tablets and tablet families — the inbox the Compare workspace
	// offers (#373). This list used to be the first tab of /tablet-compare.
	import { resolve } from '$app/paths';
	import type { Tablet, TabletFamily } from '$data/lib/drawtab-loader.js';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Button from '$lib/components/Button.svelte';
	import FlagButton from '$lib/components/FlagButton.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import TabletPicker from '$lib/components/TabletPicker.svelte';
	import {
		flaggedTablets,
		flaggedTabletFamilies,
		flaggedCount,
		toggleFlag,
		toggleFlaggedTabletFamily,
		clearFlags,
		clearFlaggedTabletFamilies,
	} from '$lib/flagged-store.js';
	import { tabletFullName } from '$lib/tablet-helpers.js';
	import { tabletSubNavTabs } from '$lib/nav/subnav-tabs.js';

	let { data } = $props();

	let tabletTabs = $derived(tabletSubNavTabs({ flaggedCount: $flaggedCount }));
	let tablets: Tablet[] = $derived(data.tablets as Tablet[]);
	let families: TabletFamily[] = $derived(data.families as TabletFamily[]);
	let showPicker = $state(false);

	let tabletById = $derived(new Map(tablets.map((t) => [t.Meta.EntityId.toLowerCase(), t])));
	let familyById = $derived(new Map(families.map((f) => [f.EntityId.toLowerCase(), f])));

	let flaggedTabletEntries = $derived(
		$flaggedTablets
			.map((id) => ({ id, tablet: tabletById.get(id.toLowerCase()) }))
			.filter((e): e is { id: string; tablet: Tablet } => !!e.tablet),
	);
	let flaggedFamilyEntries = $derived(
		$flaggedTabletFamilies
			.map((id) => ({ id, family: familyById.get(id) }))
			.filter((e): e is { id: string; family: TabletFamily } => !!e.family),
	);

	function clearAll() {
		clearFlags();
		clearFlaggedTabletFamilies();
	}
</script>

<Nav />
<SubNav tabs={tabletTabs} />
<h1 class="sr-only">Flagged Tablets</h1>

<div class="header">
	<p class="meta">
		{$flaggedCount} item{$flaggedCount === 1 ? '' : 's'} flagged. Flags are an inbox for
		<a href={resolve('/compare/tablets')}>compare</a>, where they can be added to a comparison.
	</p>
	<div class="actions">
		<Button variant="secondary" onclick={() => (showPicker = true)}>+ flag a tablet</Button>
		{#if $flaggedCount > 0}
			<Button variant="danger" onclick={clearAll}>Clear all flags</Button>
		{/if}
	</div>
</div>

{#if $flaggedCount === 0}
	<EmptyState>
		Nothing flagged yet. Flag tablets from the <a href={resolve('/')}>tablets list</a>, a tablet
		page, or a tablet family page.
	</EmptyState>
{:else}
	{#if flaggedTabletEntries.length > 0}
		<section>
			<h2>Tablets ({flaggedTabletEntries.length})</h2>
			<ul class="entries">
				{#each flaggedTabletEntries as e (e.id)}
					<li>
						<FlagButton flagged={true} onclick={() => toggleFlag(e.id)} label="Unflag" />
						<a href={resolve('/entity/[entityId]', { entityId: e.tablet.Meta.EntityId })}
							>{tabletFullName(e.tablet)}</a
						>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
	{#if flaggedFamilyEntries.length > 0}
		<section>
			<h2>Tablet Families ({flaggedFamilyEntries.length})</h2>
			<ul class="entries">
				{#each flaggedFamilyEntries as e (e.id)}
					<li>
						<FlagButton
							flagged={true}
							onclick={() => toggleFlaggedTabletFamily(e.id)}
							label="Unflag"
						/>
						<a href={resolve('/entity/[entityId]', { entityId: e.family.EntityId })}
							>{e.family.FamilyName}</a
						>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}

{#if showPicker && tablets.length > 0}
	<TabletPicker
		allTablets={tablets}
		flaggedIds={$flaggedTablets}
		onclose={() => (showPicker = false)}
	/>
{/if}

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	.meta {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--type-body);
	}

	section h2 {
		font-size: var(--type-subhead);
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
		font-size: var(--type-body);
	}
</style>
