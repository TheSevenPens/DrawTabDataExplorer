<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadAllFromURL, type DrawTabDataAll } from '$data/lib/drawtab-all.js';
	import { loadInventoryPensFromURL, loadInventoryTabletsFromURL } from '$data/lib/drawtab-loader.js';
	import { buildFilterUrl } from '$lib/filter-url.js';
	import Nav from '$lib/components/Nav.svelte';
	import ExportButton from '$lib/components/ExportButton.svelte';

	interface Issue {
		entity: string;
		entityId: string;
		field: string;
		issue: string;
		value?: string;
	}

	interface CompletionStat {
		field: string;
		populated: number;
		total: number;
		percent: string;
	}

	let ds: DrawTabDataAll | null = $state(null);
	let issues: Issue[] = $state([]);
	let tabletCompletion: CompletionStat[] = $state([]);
	let displayCompletion: CompletionStat[] = $state([]);
	let displayTabletCount = $state(0);
	let penCompletion: CompletionStat[] = $state([]);
	let driverCompletion: CompletionStat[] = $state([]);
	let pressureResponseCompletion: CompletionStat[] = $state([]);
	let inventoryPenCompletion: CompletionStat[] = $state([]);
	let inventoryTabletCompletion: CompletionStat[] = $state([]);
	let orphanedCompat: { type: string; id: string }[] = $state([]);
	let orphanedFamilies: { type: string; id: string; referencedBy: string }[] = $state([]);
	let entityCounts: { entity: string; count: number }[] = $state([]);
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	type TabName = 'summary' | 'compatibility' | 'completion';
	const validTabs: TabName[] = ['summary', 'compatibility', 'completion'];

	let activeTab: TabName = $derived.by(() => {
		const hash = page.url.hash.slice(1);
		return validTabs.includes(hash as TabName) ? hash as TabName : 'summary';
	});

	function setTab(tab: TabName) {
		goto(`${page.url.pathname}#${tab}`, { replaceState: false, noScroll: true });
	}
	let inventoryPenCount = $state(0);
	let inventoryTabletCount = $state(0);

	function getByPath(obj: Record<string, any>, path: string): unknown {
		const parts = path.split('.');
		let cur: unknown = obj;
		for (const part of parts) {
			if (cur == null || typeof cur !== 'object') return undefined;
			cur = (cur as Record<string, unknown>)[part];
		}
		return cur;
	}

	function getEntityId(rec: Record<string, any>): string {
		return (getByPath(rec, 'Meta.EntityId') as string) ?? rec.EntityId ?? rec._id ?? 'UNKNOWN';
	}

	function checkRequired(records: Record<string, any>[], entity: string, requiredFields: string[]): Issue[] {
		const found: Issue[] = [];
		for (const rec of records) {
			const eid = getEntityId(rec);
			for (const field of requiredFields) {
				const val = getByPath(rec, field);
				if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
					found.push({ entity, entityId: eid, field, issue: 'missing or empty' });
				}
			}
		}
		return found;
	}

	function checkWhitespace(records: Record<string, any>[], entity: string): Issue[] {
		const found: Issue[] = [];
		function traverse(obj: Record<string, any>, eid: string, prefix: string) {
			for (const [field, value] of Object.entries(obj)) {
				const path = prefix ? `${prefix}.${field}` : field;
				if (typeof value === 'string' && value !== value.trim()) {
					found.push({ entity, entityId: eid, field: path, issue: 'leading/trailing whitespace', value });
				} else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
					traverse(value as Record<string, any>, eid, path);
				}
			}
		}
		for (const rec of records) {
			traverse(rec, getEntityId(rec), '');
		}
		return found;
	}

	function computeCompletion(records: Record<string, any>[], fields: string[]): CompletionStat[] {
		const total = records.length;
		return fields.map(field => {
			const populated = records.filter(r => {
				const v = getByPath(r, field);
				return v !== undefined && v !== null && v !== '';
			}).length;
			return { field, populated, total, percent: total > 0 ? ((populated / total) * 100).toFixed(1) : '0' };
		}).sort((a, b) => parseFloat(a.percent) - parseFloat(b.percent));
	}

	function findOrphanedCompat(ds: DrawTabDataAll): { type: string; id: string }[] {
		const tabletIds = new Set(ds.tablets.map(t => t.Model.Id));
		const penIds = new Set(ds.pens.map(p => p.PenId));
		const orphans: { type: string; id: string }[] = [];
		const seenTablets = new Set<string>();
		const seenPens = new Set<string>();

		for (const row of ds.penCompat) {
			if (!tabletIds.has(row.TabletId) && !seenTablets.has(row.TabletId)) {
				orphans.push({ type: 'Tablet', id: row.TabletId });
				seenTablets.add(row.TabletId);
			}
			if (!penIds.has(row.PenId) && !seenPens.has(row.PenId)) {
				orphans.push({ type: 'Pen', id: row.PenId });
				seenPens.add(row.PenId);
			}
		}
		return orphans;
	}

	// Tablets with no compatible pens and pens with no compatible tablets
	let tabletsNoCompat: { id: string; name: string }[] = $state([]);
	let pensNoCompat: { id: string; name: string }[] = $state([]);

	// Tablets whose IncludedPen has no matching pen-compat row.
	let includedPenMissingCompat: {
		tabletId: string;
		tabletName: string;
		penEntityId: string;
		penName: string;
	}[] = $state([]);

	onMount(async () => {
		const [dsResult, invPens, invTablets] = await Promise.all([
			loadAllFromURL(base),
			loadInventoryPensFromURL(base, 'sevenpens'),
			loadInventoryTabletsFromURL(base, 'sevenpens'),
		]);
		ds = dsResult;
		inventoryPenCount = invPens.length;
		inventoryTabletCount = invTablets.length;
		const allIssues: Issue[] = [];

		// Required field checks
		allIssues.push(...checkRequired(ds.tablets, 'Tablet', ['Meta.EntityId', 'Model.Brand', 'Model.Id', 'Model.Name', 'Model.Type']));
		allIssues.push(...checkRequired(ds.pens, 'Pen', ['EntityId', 'Brand', 'PenId', 'PenName']));
		allIssues.push(...checkRequired(ds.drivers, 'Driver', ['EntityId', 'Brand', 'DriverVersion', 'DriverName', 'OSFamily', 'ReleaseDate']));
		allIssues.push(...checkRequired(ds.penFamilies, 'PenFamily', ['EntityId', 'Brand', 'FamilyName']));
		allIssues.push(...checkRequired(ds.tabletFamilies, 'TabletFamily', ['EntityId', 'Brand', 'FamilyName']));
		allIssues.push(...checkRequired(ds.penCompat, 'PenCompat', ['Brand', 'TabletId', 'PenId']));

		// Pressure response checks
		allIssues.push(...checkRequired(ds.pressureResponse, 'PressureResponse', ['Brand', 'PenEntityId', 'InventoryId', 'Date', 'TabletEntityId']));

		// Whitespace checks
		allIssues.push(...checkWhitespace(ds.tablets, 'Tablet'));
		allIssues.push(...checkWhitespace(ds.pens, 'Pen'));
		allIssues.push(...checkWhitespace(ds.drivers, 'Driver'));
		allIssues.push(...checkWhitespace(ds.pressureResponse, 'PressureResponse'));

		issues = allIssues;

		// Completion stats
		tabletCompletion = computeCompletion(ds.tablets, [
			'Model.LaunchYear', 'Model.Audience', 'Model.Family', 'Model.Status', 'Model.IncludedPen',
			'Digitizer.Type', 'Digitizer.PressureLevels', 'Digitizer.Dimensions', 'Digitizer.Density',
			'Digitizer.ReportRate', 'Digitizer.Tilt', 'Digitizer.AccuracyCenter', 'Digitizer.AccuracyCorner',
			'Digitizer.MaxHover', 'Digitizer.SupportsTouch',
			'Physical.Dimensions', 'Physical.Weight', 'Model.ProductLink',
		]);

		const displayTablets = ds.tablets.filter(t => t.Model.Type === 'PENDISPLAY' || t.Model.Type === 'STANDALONE');
		displayTabletCount = displayTablets.length;
		displayCompletion = computeCompletion(displayTablets, [
			'Display.PixelDimensions', 'Display.PanelTech', 'Display.Brightness', 'Display.Contrast',
			'Display.ColorBitDepth', 'Display.ColorGamuts', 'Display.Lamination',
		]);

		penCompletion = computeCompletion(ds.pens, ['PenName', 'PenFamily', 'PenYear']);

		driverCompletion = computeCompletion(ds.drivers, [
			'DriverURLWacom', 'DriverURLArchiveDotOrg', 'ReleaseNotesURL',
		]);

		pressureResponseCompletion = computeCompletion(ds.pressureResponse, [
			'PenFamily', 'Notes',
		]);

		inventoryPenCompletion = computeCompletion(invPens, [
			'PenEntityId', 'PenTech', 'WithTabletInventoryId',
		]);

		inventoryTabletCompletion = computeCompletion(invTablets, [
			'TabletEntityId', 'Vendor', 'OrderDate',
		]);

		// Orphaned compat references
		orphanedCompat = findOrphanedCompat(ds);

		// Orphaned family references
		const penFamilyIds = new Set(ds.penFamilies.map(f => f.EntityId));
		const tabletFamilyIds = new Set(ds.tabletFamilies.map(f => f.EntityId));
		const orphFamilies: typeof orphanedFamilies = [];
		for (const pen of ds.pens) {
			if (pen.PenFamily && !penFamilyIds.has(pen.PenFamily)) {
				orphFamilies.push({ type: 'PenFamily', id: pen.PenFamily, referencedBy: pen.PenId });
			}
		}
		for (const tab of ds.tablets) {
			if (tab.Model.Family && !tabletFamilyIds.has(tab.Model.Family)) {
				orphFamilies.push({ type: 'TabletFamily', id: tab.Model.Family, referencedBy: tab.Model.Id });
			}
		}
		orphanedFamilies = orphFamilies;

		// Entity counts
		entityCounts = [
			{ entity: 'Tablets', count: ds.tablets.length },
			{ entity: 'Pens', count: ds.pens.length },
			{ entity: 'Pen Compat Rows', count: ds.penCompat.length },
			{ entity: 'Pen Families', count: ds.penFamilies.length },
			{ entity: 'Tablet Families', count: ds.tabletFamilies.length },
			{ entity: 'Drivers', count: ds.drivers.length },
			{ entity: 'Pressure Response Sessions', count: ds.pressureResponse.length },
			{ entity: 'Inventory Pens', count: inventoryPenCount },
			{ entity: 'Inventory Tablets', count: inventoryTabletCount },
		];

		// Compat coverage
		const wacomTablets = ds.tablets.filter(t => t.Model.Brand === 'WACOM');
		tabletsNoCompat = wacomTablets
			.filter(t => !ds!.tabletToPens.has(t.Model.Id))
			.map(t => ({ id: t.Model.Id, name: t.Model.Name }));

		pensNoCompat = ds.pens
			.filter(p => !ds!.penToTablets.has(p.PenId))
			.map(p => ({ id: p.PenId, name: p.PenName }));

		// Included pens missing compatibility info.
		// IncludedPen holds pen EntityIds (e.g. "wacom.pen.kp503e"); pen-compat
		// rows hold bare PenIds (e.g. "KP-503E"). Resolve each IncludedPen
		// EntityId to its pen record, then check that a pen-compat row exists
		// linking the tablet's Model.Id to that pen's PenId.
		const penByEntityId = new Map(ds.pens.map(p => [p.EntityId, p]));
		const compatPairs = new Set<string>();
		for (const row of ds.penCompat) {
			compatPairs.add(`${row.TabletId}::${row.PenId}`);
		}
		const missing: typeof includedPenMissingCompat = [];
		for (const tablet of ds.tablets) {
			const included = tablet.Model.IncludedPen ?? [];
			for (const penEntityId of included) {
				const pen = penByEntityId.get(penEntityId);
				const penIdForCompat = pen?.PenId;
				const penName = pen?.PenName ?? '(missing pen record)';
				const linked = penIdForCompat
					? compatPairs.has(`${tablet.Model.Id}::${penIdForCompat}`)
					: false;
				if (!linked) {
					missing.push({
						tabletId: tablet.Model.Id,
						tabletName: tablet.Model.Name,
						penEntityId,
						penName,
					});
				}
			}
		}
		includedPenMissingCompat = missing;
	});
</script>

<Nav />
<h1>Data Quality</h1>

{#if !ds}
	<p>Loading...</p>
{:else}

	<!-- Sub-tabs -->
	<div class="tabs">
		<button class:active={activeTab === 'summary'} onclick={() => setTab('summary')}>Summary</button>
		<button class:active={activeTab === 'compatibility'} onclick={() => setTab('compatibility')}>Compatibility</button>
		<button class:active={activeTab === 'completion'} onclick={() => setTab('completion')}>Field Completion</button>
	</div>

	<!-- SUMMARY TAB -->
	{#if activeTab === 'summary'}

		<section class="section">
			<div class="section-header">
				<h2>Entity Counts</h2>
				<ExportButton headers={['Entity', 'Count']} rows={entityCounts.map(r => [r.entity, r.count])} />
			</div>
			<table class="compact">
				<thead><tr><th>Entity</th><th>Count</th></tr></thead>
				<tbody>
					{#each entityCounts as row}
						<tr><td>{row.entity}</td><td>{row.count}</td></tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="section">
			<div class="section-header">
				<h2>Issues ({issues.length})</h2>
				<ExportButton headers={['Entity', 'Entity ID', 'Field', 'Issue', 'Value']} rows={issues.map(i => [i.entity, i.entityId, i.field, i.issue, i.value ?? ''])} />
			</div>
			{#if issues.length === 0}
				<p class="good">No issues found.</p>
			{:else}
				<table>
					<thead><tr><th>Entity</th><th>Entity ID</th><th>Field</th><th>Issue</th><th>Value</th></tr></thead>
					<tbody>
						{#each issues as issue}
							<tr>
								<td>{issue.entity}</td>
								<td class="mono">{issue.entityId}</td>
								<td>{issue.field}</td>
								<td>{issue.issue}</td>
								<td class="mono">{issue.value ?? ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>

	<!-- COMPATIBILITY TAB -->
	{:else if activeTab === 'compatibility'}

		<section class="section">
			<div class="section-header">
				<h2>Orphaned Compat References ({orphanedCompat.length})</h2>
				<ExportButton headers={['Type', 'ID']} rows={orphanedCompat.map(o => [o.type, o.id])} />
			</div>
			<p class="description">IDs in pen-compat that don't match any record in the referenced entity.</p>
			{#if orphanedCompat.length === 0}
				<p class="good">No orphaned references.</p>
			{:else}
				<table class="compact">
					<thead><tr><th>Type</th><th>ID</th></tr></thead>
					<tbody>
						{#each orphanedCompat as orphan}
							<tr><td>{orphan.type}</td><td class="mono">{orphan.id}</td></tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>

		<section class="section">
			<div class="section-header">
				<h2>Wacom Tablets with No Pen Compatibility Data ({tabletsNoCompat.length})</h2>
				<ExportButton headers={['Model ID', 'Name']} rows={tabletsNoCompat.map(t => [t.id, t.name])} />
			</div>
			<p class="description">Wacom tablets that have no entries in pen-compat.</p>
			{#if tabletsNoCompat.length === 0}
				<p class="good">All Wacom tablets have compatibility data.</p>
			{:else}
				<table class="compact">
					<thead><tr><th>Model ID</th><th>Name</th></tr></thead>
					<tbody>
						{#each tabletsNoCompat as t}
							<tr><td class="mono">{t.id}</td><td>{t.name}</td></tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>

		<section class="section">
			<div class="section-header">
				<h2>Pens with No Tablet Compatibility Data ({pensNoCompat.length})</h2>
				<ExportButton headers={['Pen ID', 'Name']} rows={pensNoCompat.map(p => [p.id, p.name])} />
			</div>
			<p class="description">Pens that have no entries in pen-compat.</p>
			{#if pensNoCompat.length === 0}
				<p class="good">All pens have compatibility data.</p>
			{:else}
				<table class="compact">
					<thead><tr><th>Pen ID</th><th>Name</th></tr></thead>
					<tbody>
						{#each pensNoCompat as p}
							<tr><td class="mono">{p.id}</td><td>{p.name}</td></tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>

		<section class="section">
			<div class="section-header">
				<h2>Included Pens Missing Compatibility Info ({includedPenMissingCompat.length})</h2>
				<ExportButton headers={['Tablet ID', 'Tablet Name', 'Pen EntityId', 'Pen Name']} rows={includedPenMissingCompat.map(r => [r.tabletId, r.tabletName, r.penEntityId, r.penName])} />
			</div>
			<p class="description">Tablets whose <code>Model.IncludedPen</code> references a pen, but no pen-compat row links the tablet and pen. These should always be present — an included pen is by definition compatible with its tablet.</p>
			{#if includedPenMissingCompat.length === 0}
				<p class="good">All included pens have a matching pen-compat row.</p>
			{:else}
				<table class="compact">
					<thead><tr><th>Tablet ID</th><th>Tablet Name</th><th>Pen EntityId</th><th>Pen Name</th></tr></thead>
					<tbody>
						{#each includedPenMissingCompat as r}
							<tr>
								<td class="mono">{r.tabletId}</td>
								<td>{r.tabletName}</td>
								<td class="mono">{r.penEntityId}</td>
								<td>{r.penName}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>

		<section class="section">
			<div class="section-header">
				<h2>Orphaned Family References ({orphanedFamilies.length})</h2>
				<ExportButton headers={['Type', 'Family ID', 'Referenced By']} rows={orphanedFamilies.map(o => [o.type, o.id, o.referencedBy])} />
			</div>
			<p class="description">Family IDs referenced by pens or tablets that don't exist in the family entities.</p>
			{#if orphanedFamilies.length === 0}
				<p class="good">No orphaned family references.</p>
			{:else}
				<table class="compact">
					<thead><tr><th>Type</th><th>Family ID</th><th>Referenced By</th></tr></thead>
					<tbody>
						{#each orphanedFamilies as o}
							<tr><td>{o.type}</td><td class="mono">{o.id}</td><td class="mono">{o.referencedBy}</td></tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>

	<!-- FIELD COMPLETION TAB -->
	{:else if activeTab === 'completion'}

		<section class="section">
			<div class="section-header">
				<h2>Tablet Field Completion</h2>
				<ExportButton headers={['Field', 'Populated', '%']} rows={tabletCompletion.map(s => [s.field, `${s.populated}/${s.total}`, `${s.percent}%`])} />
			</div>
			<p class="description">How many of the {ds.tablets.length} tablets have each field populated.</p>
			<table class="compact">
				<thead><tr><th>Field</th><th>Populated</th><th>%</th><th></th><th></th></tr></thead>
				<tbody>
					{#each tabletCompletion as stat}
						<tr>
							<td>{stat.field}</td>
							<td>{stat.populated} / {stat.total}</td>
							<td>{stat.percent}%</td>
							<td>
								<div class="bar-bg">
									<div class="bar-fill" style="width: {stat.percent}%"></div>
								</div>
							</td>
							<td>{#if stat.populated < stat.total}<a class="view-link" href={buildFilterUrl('/', [{field: stat.field, operator: 'empty', value: ''}])}>show</a>{/if}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="section">
			<div class="section-header">
				<h2>Display Field Completion</h2>
				<ExportButton headers={['Field', 'Populated', '%']} rows={displayCompletion.map(s => [s.field, `${s.populated}/${s.total}`, `${s.percent}%`])} />
			</div>
			<p class="description">How many of the {displayTabletCount} pen displays and standalone tablets have each display field populated.</p>
			<table class="compact">
				<thead><tr><th>Field</th><th>Populated</th><th>%</th><th></th><th></th></tr></thead>
				<tbody>
					{#each displayCompletion as stat}
						<tr>
							<td>{stat.field}</td>
							<td>{stat.populated} / {stat.total}</td>
							<td>{stat.percent}%</td>
							<td>
								<div class="bar-bg">
									<div class="bar-fill" style="width: {stat.percent}%"></div>
								</div>
							</td>
							<td>{#if stat.populated < stat.total}<a class="view-link" href={buildFilterUrl('/', [{field: stat.field, operator: 'empty', value: ''}])}>show</a>{/if}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="section">
			<div class="section-header">
				<h2>Pen Field Completion</h2>
				<ExportButton headers={['Field', 'Populated', '%']} rows={penCompletion.map(s => [s.field, `${s.populated}/${s.total}`, `${s.percent}%`])} />
			</div>
			<p class="description">How many of the {ds.pens.length} pens have each optional field populated.</p>
			<table class="compact">
				<thead><tr><th>Field</th><th>Populated</th><th>%</th><th></th><th></th></tr></thead>
				<tbody>
					{#each penCompletion as stat}
						<tr>
							<td>{stat.field}</td>
							<td>{stat.populated} / {stat.total}</td>
							<td>{stat.percent}%</td>
							<td>
								<div class="bar-bg">
									<div class="bar-fill" style="width: {stat.percent}%"></div>
								</div>
							</td>
							<td>{#if stat.populated < stat.total}<a class="view-link" href={buildFilterUrl('/pens', [{field: stat.field, operator: 'empty', value: ''}])}>show</a>{/if}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="section">
			<div class="section-header">
				<h2>Driver Field Completion</h2>
				<ExportButton headers={['Field', 'Populated', '%']} rows={driverCompletion.map(s => [s.field, `${s.populated}/${s.total}`, `${s.percent}%`])} />
			</div>
			<p class="description">How many of the {ds.drivers.length} drivers have each optional field populated.</p>
			<table class="compact">
				<thead><tr><th>Field</th><th>Populated</th><th>%</th><th></th><th></th></tr></thead>
				<tbody>
					{#each driverCompletion as stat}
						<tr>
							<td>{stat.field}</td>
							<td>{stat.populated} / {stat.total}</td>
							<td>{stat.percent}%</td>
							<td>
								<div class="bar-bg">
									<div class="bar-fill" style="width: {stat.percent}%"></div>
								</div>
							</td>
							<td>{#if stat.populated < stat.total}<a class="view-link" href={buildFilterUrl('/drivers', [{field: stat.field, operator: 'empty', value: ''}])}>show</a>{/if}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="section">
			<div class="section-header">
				<h2>Pressure Response Field Completion</h2>
				<ExportButton headers={['Field', 'Populated', '%']} rows={pressureResponseCompletion.map(s => [s.field, `${s.populated}/${s.total}`, `${s.percent}%`])} />
			</div>
			<p class="description">How many of the {ds.pressureResponse.length} sessions have each optional field populated.</p>
			<table class="compact">
				<thead><tr><th>Field</th><th>Populated</th><th>%</th><th></th><th></th></tr></thead>
				<tbody>
					{#each pressureResponseCompletion as stat}
						<tr>
							<td>{stat.field}</td>
							<td>{stat.populated} / {stat.total}</td>
							<td>{stat.percent}%</td>
							<td>
								<div class="bar-bg">
									<div class="bar-fill" style="width: {stat.percent}%"></div>
								</div>
							</td>
							<td>{#if stat.populated < stat.total}<a class="view-link" href={buildFilterUrl('/pressure-response', [{field: stat.field, operator: 'empty', value: ''}])}>show</a>{/if}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="section">
			<div class="section-header">
				<h2>Inventory Pen Field Completion</h2>
				<ExportButton headers={['Field', 'Populated', '%']} rows={inventoryPenCompletion.map(s => [s.field, `${s.populated}/${s.total}`, `${s.percent}%`])} />
			</div>
			<p class="description">How many of the {inventoryPenCount} inventory pens have each optional field populated.</p>
			<table class="compact">
				<thead><tr><th>Field</th><th>Populated</th><th>%</th><th></th></tr></thead>
				<tbody>
					{#each inventoryPenCompletion as stat}
						<tr>
							<td>{stat.field}</td>
							<td>{stat.populated} / {stat.total}</td>
							<td>{stat.percent}%</td>
							<td>
								<div class="bar-bg">
									<div class="bar-fill" style="width: {stat.percent}%"></div>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="section">
			<div class="section-header">
				<h2>Inventory Tablet Field Completion</h2>
				<ExportButton headers={['Field', 'Populated', '%']} rows={inventoryTabletCompletion.map(s => [s.field, `${s.populated}/${s.total}`, `${s.percent}%`])} />
			</div>
			<p class="description">How many of the {inventoryTabletCount} inventory tablets have each optional field populated.</p>
			<table class="compact">
				<thead><tr><th>Field</th><th>Populated</th><th>%</th><th></th></tr></thead>
				<tbody>
					{#each inventoryTabletCompletion as stat}
						<tr>
							<td>{stat.field}</td>
							<td>{stat.populated} / {stat.total}</td>
							<td>{stat.percent}%</td>
							<td>
								<div class="bar-bg">
									<div class="bar-fill" style="width: {stat.percent}%"></div>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

	{/if}

{/if}

<style>
	h1 { margin-bottom: 16px; }

	.tabs {
		display: flex;
		gap: 0;
		border-bottom: 2px solid var(--border);
		margin-bottom: 20px;
	}

	.tabs button {
		padding: 7px 18px;
		font-size: 13px;
		border: 1px solid transparent;
		border-bottom: none;
		border-radius: 4px 4px 0 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		position: relative;
		bottom: -2px;
	}

	.tabs button:hover {
		color: #2563eb;
		background: var(--hover-bg);
	}

	.tabs button.active {
		background: var(--bg-card);
		color: var(--text);
		font-weight: 600;
		border-color: var(--border);
		border-bottom-color: var(--bg-card);
	}

	.section {
		margin-bottom: 32px;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		border-bottom: 2px solid #e0e0e0;
		padding-bottom: 4px;
		margin-bottom: 8px;
	}

	.section-header h2 {
		border-bottom: none;
		padding-bottom: 0;
		margin-bottom: 0;
	}

	h2 {
		font-size: 15px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 8px;
		padding-bottom: 4px;
		border-bottom: 2px solid #e0e0e0;
	}

	.description {
		font-size: 13px;
		color: #888;
		margin-bottom: 8px;
	}

	.good {
		font-size: 14px;
		color: #16a34a;
		font-weight: 600;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		background: #fff;
		font-size: 13px;
		margin-bottom: 8px;
	}

	table.compact { width: auto; }

	th, td {
		text-align: left;
		padding: 5px 10px;
		border-bottom: 1px solid #e0e0e0;
	}

	th {
		background: #333;
		color: #fff;
	}

	tr:hover td { background: #f0f7ff; }

	.mono {
		font-family: monospace;
		font-size: 12px;
	}

	.bar-bg {
		width: 120px;
		height: 14px;
		background: #eee;
		border-radius: 3px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		background: #2563eb;
		border-radius: 3px;
		transition: width 0.3s;
	}

	.view-link {
		font-size: 12px;
		color: var(--link);
		text-decoration: none;
		white-space: nowrap;
	}

	.view-link:hover { text-decoration: underline; }
</style>
