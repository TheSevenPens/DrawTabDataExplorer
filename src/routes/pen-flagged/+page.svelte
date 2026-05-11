<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import {
		brandName,
		type Pen,
		type PenFamily,
		type PressureResponse,
	} from '$data/lib/drawtab-loader.js';
	import { DrawTabDataSet } from '$data/lib/dataset.js';
	import type { InventoryPen } from '$data/lib/entities/inventory-pen-fields.js';
	import { sessionEntityId } from '$data/lib/pressure/session-id.js';
	import { buildInventoryDefects } from '$data/lib/pressure/defects.js';
	import { penIdRedundantInName } from '$data/lib/entities/pen-fields.js';
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
	import PressureChart from '$lib/components/PressureChart.svelte';
	import SessionStats from '$lib/components/SessionStats.svelte';
	import PressureResponseChartLegendTable from '$lib/components/PressureResponseChartLegendTable.svelte';
	import FlagButton from '$lib/components/FlagButton.svelte';
	import { paletteColor } from '$lib/chart-palette.js';

	let penTabs = $derived([
		{ href: '/pens', label: 'Pen models' },
		{ href: '/pen-families', label: 'Pen families' },
		{ href: '/pen-inventory', label: 'Inventory' },
		{ href: '/pen-flagged', label: 'Flagged', badge: $flaggedPenTotalCount },
		{ href: '/pressure-response', label: 'Pressure Response' },
	]);

	let pens: Pen[] = $state([]);
	let families: PenFamily[] = $state([]);
	let sessions: PressureResponse[] = $state([]);
	let inventoryPens: InventoryPen[] = $state([]);

	onMount(async () => {
		const ds = new DrawTabDataSet({ kind: 'url', baseUrl: base, userId: 'sevenpens' });
		const [p, f, s, inv] = await Promise.all([
			ds.Pens.toArray(),
			ds.PenFamilies.toArray(),
			ds.PressureResponse.toArray(),
			ds.InventoryPens.toArray(),
		]);
		pens = p;
		families = f;
		sessions = s;
		inventoryPens = inv;
	});

	let defectsByInventoryId = $derived(buildInventoryDefects(inventoryPens));

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

	// Sessions matching any current flag (pen unit / model / family).
	let matchedSessions = $derived(
		(() => {
			const flaggedFamilyPenIds = new Set(
				pens
					.filter((p) => $flaggedPenFamilies.includes(p.PenFamily.toLowerCase()))
					.map((p) => p.EntityId.toLowerCase()),
			);
			return sessions.filter((s) => {
				const inv = s.InventoryId.toLowerCase();
				const model = s.PenEntityId.toLowerCase();
				if ($flaggedPenUnits.includes(inv)) return true;
				if ($flaggedPenModels.includes(model)) return true;
				if (flaggedFamilyPenIds.has(model)) return true;
				return false;
			});
		})(),
	);

	let sessionColors = $derived(new Map(matchedSessions.map((s, i) => [s._id, paletteColor(i)])));

	let penNameById = $derived(
		new Map(
			pens.map((p) => [
				p.EntityId,
				penIdRedundantInName(p) ? p.PenName : `${p.PenName} (${p.PenId})`,
			]),
		),
	);

	let chartSessions = $derived(
		matchedSessions.map((s) => {
			const penLabel = penNameById.get(s.PenEntityId) ?? s.PenEntityId;
			const info = defectsByInventoryId.get(s.InventoryId);
			return {
				id: s._id,
				label: `${penLabel} · ${s.InventoryId} ${s.Date}`,
				records: s.Records,
				color: sessionColors.get(s._id),
				defective: !!info,
				defectInfo: info?.detailsLabel,
			};
		}),
	);

	let hiddenSessionIds = $state(new Set<string>());

	function toggleSessionVisibility(id: string) {
		const next = new Set(hiddenSessionIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		hiddenSessionIds = next;
	}
</script>

<Nav />
<SubNav tabs={penTabs} />

<div class="header">
	<h1>Flagged Pens</h1>
	<p class="meta">
		{$flaggedPenTotalCount} item{$flaggedPenTotalCount === 1 ? '' : 's'} flagged across pen units, models,
		and families. Flagged sessions overlay together on the chart below for cross-pen comparison.
	</p>
	{#if $flaggedPenTotalCount > 0}
		<button class="clear-btn" onclick={clearAllPenFlags}>Clear all flags</button>
	{/if}
</div>

{#if $flaggedPenTotalCount === 0}
	<p class="empty">
		Nothing flagged yet. Open a pen, pen family, or inventory pen and click the ⚐ button to flag it.
	</p>
{:else}
	{#if chartSessions.length > 0}
		<section class="chart-section">
			<h2>Pressure Response Overlay ({chartSessions.length} sessions)</h2>
			<PressureChart
				sessions={chartSessions}
				title="Flagged sessions"
				hiddenIds={hiddenSessionIds}
			/>
			<PressureResponseChartLegendTable
				sessions={matchedSessions}
				colors={sessionColors}
				hiddenIds={hiddenSessionIds}
				onToggle={toggleSessionVisibility}
				{penNameById}
				{defectsByInventoryId}
				showBrand
				showModel
			/>
			<SessionStats
				sessions={matchedSessions}
				title="Aggregated across flagged sessions"
				{defectsByInventoryId}
			/>
		</section>
	{:else}
		<p class="empty">No pressure-response sessions match the current flags.</p>
	{/if}

	{#if flaggedModelEntries.length > 0}
		<section>
			<h2>Pen Models ({flaggedModelEntries.length})</h2>
			<ul class="entries">
				{#each flaggedModelEntries as e (e.id)}
					<li>
						<FlagButton flagged={true} onclick={() => toggleFlaggedPenModel(e.id)} label="Unflag" />
						<a href="{base}/entity/{encodeURIComponent(e.id)}">
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
						<a href="{base}/entity/{encodeURIComponent(e.id)}">
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
							<a href="{base}/entity/{encodeURIComponent(e.info.penEntityId)}">
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
		<a href="{base}/pressure-response">Pens ▸ Pressure Response</a>.
	</p>
{/if}

<style>
	.header {
		margin-bottom: 16px;
	}
	h1 {
		margin: 0 0 8px;
	}
	.meta {
		margin: 0;
		color: var(--text-muted);
		font-size: 13px;
	}
	.clear-btn {
		margin-top: 8px;
		padding: 4px 12px;
		font-size: 13px;
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text-muted);
		border-radius: 4px;
		cursor: pointer;
	}
	.clear-btn:hover {
		border-color: #b91c1c;
		color: #b91c1c;
	}
	.empty {
		margin: 24px 0;
		font-size: 14px;
		color: var(--text-muted);
		font-style: italic;
	}
	.chart-section {
		margin-bottom: 24px;
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
