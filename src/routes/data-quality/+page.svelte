<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadAllFromURL, type DrawTabDataAll } from '$data/lib/drawtab-all.js';
	import {
		loadInventoryPensFromURL,
		loadInventoryTabletsFromURL,
	} from '$data/lib/drawtab-loader.js';
	import { buildFilterUrl } from '$lib/filter-url.js';
	import {
		findNonMonotonicSessions,
		findMissingLowEnd,
		findSingleSessionPens,
		findStaleMeasurements,
		findRecommendedForRemeasurement,
		type NonMonotonicSession,
		type MissingLowEndPen,
		type SingleSessionPen,
		type StaleMeasurement,
		type RemeasureRecommendation,
	} from '$data/lib/pressure/data-quality.js';
	import { sessionEntityId } from '$data/lib/pressure/session-id.js';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';

	const dataTabs = [
		{ href: '/reference', label: 'Reference' },
		{ href: '/data-dictionary', label: 'Data Dictionary' },
		{ href: '/data-quality', label: 'Data Quality' },
		{ href: '/pen-compat', label: 'Pen Compat' },
		{ href: '/wacom-driver-compat', label: 'Driver Compat' },
	];

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

	interface SectionDef {
		id: string;
		category: string;
		label: string;
		count?: () => number;
	}

	// Source of truth for the navigation tree. Each entry is one node.
	// `count` (optional) is read reactively in the template to display a
	// badge next to the node label.
	const sectionDefs: SectionDef[] = [
		{ id: 'entity-counts', category: 'Summary', label: 'Entity Counts' },
		{ id: 'issues', category: 'Summary', label: 'Issues', count: () => issues.length },
		{
			id: 'orphaned-compat',
			category: 'Compatibility',
			label: 'Orphaned Compat References',
			count: () => orphanedCompat.length,
		},
		{
			id: 'wacom-no-compat',
			category: 'Compatibility',
			label: 'Wacom Tablets Missing Compat',
			count: () => tabletsNoCompat.length,
		},
		{
			id: 'pens-no-compat',
			category: 'Compatibility',
			label: 'Pens Missing Compat',
			count: () => pensNoCompat.length,
		},
		{
			id: 'included-pen-no-compat',
			category: 'Compatibility',
			label: 'Included Pens Missing Compat',
			count: () => includedPenMissingCompat.length,
		},
		{
			id: 'orphaned-families',
			category: 'Compatibility',
			label: 'Orphaned Family References',
			count: () => orphanedFamilies.length,
		},
		{
			id: 'pressure-non-monotonic',
			category: 'Pressure Response',
			label: 'Non-Monotonic Sessions',
			count: () => nonMonotonicSessions.length,
		},
		{
			id: 'pressure-missing-low-end',
			category: 'Pressure Response',
			label: 'Missing Low-End',
			count: () => missingLowEndPens.length,
		},
		{
			id: 'pressure-single-session',
			category: 'Pressure Response',
			label: 'Single-Session Pens',
			count: () => singleSessionPens.length,
		},
		{
			id: 'pressure-stale',
			category: 'Pressure Response',
			label: 'Stale Measurements',
			count: () => staleMeasurements.length,
		},
		{
			id: 'pressure-remeasure',
			category: 'Pressure Response',
			label: 'Recommended for Re-measurement',
			count: () => remeasureRecommendations.length,
		},
		{ id: 'completion-tablet', category: 'Field Completion', label: 'Tablets' },
		{ id: 'completion-display', category: 'Field Completion', label: 'Displays' },
		{ id: 'completion-pen', category: 'Field Completion', label: 'Pens' },
		{ id: 'completion-driver', category: 'Field Completion', label: 'Drivers' },
		{ id: 'completion-pressure', category: 'Field Completion', label: 'Pressure Response' },
		{ id: 'completion-inv-pen', category: 'Field Completion', label: 'Inventory Pens' },
		{ id: 'completion-inv-tablet', category: 'Field Completion', label: 'Inventory Tablets' },
	];

	const sectionIds = new Set(sectionDefs.map((s) => s.id));
	const defaultSection = 'entity-counts';

	const groupedSections: [string, SectionDef[]][] = (() => {
		const map = new Map<string, SectionDef[]>();
		for (const s of sectionDefs) {
			if (!map.has(s.category)) map.set(s.category, []);
			map.get(s.category)!.push(s);
		}
		return [...map.entries()];
	})();

	let activeSection: string = $derived.by(() => {
		const hash = page.url.hash.slice(1);
		return sectionIds.has(hash) ? hash : defaultSection;
	});

	function setSection(id: string) {
		goto(`${page.url.pathname}#${id}`, { replaceState: false, noScroll: true });
	}

	// Single shared ExportDialog instance, opened by per-section trigger
	// buttons. Each trigger sets `exportDialog` to a config object; the
	// dialog mounts when set and closes by setting it back to null.
	let exportDialog: {
		title: string;
		filename: string;
		headers: string[];
		rows: (string | number)[][];
	} | null = $state(null);

	function openExport(
		title: string,
		filename: string,
		headers: string[],
		rows: (string | number)[][],
	): void {
		exportDialog = { title, filename, headers, rows };
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

	function checkRequired(
		records: Record<string, any>[],
		entity: string,
		requiredFields: string[],
	): Issue[] {
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
					found.push({
						entity,
						entityId: eid,
						field: path,
						issue: 'leading/trailing whitespace',
						value,
					});
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
		return fields
			.map((field) => {
				const populated = records.filter((r) => {
					const v = getByPath(r, field);
					return v !== undefined && v !== null && v !== '';
				}).length;
				return {
					field,
					populated,
					total,
					percent: total > 0 ? ((populated / total) * 100).toFixed(1) : '0',
				};
			})
			.sort((a, b) => parseFloat(a.percent) - parseFloat(b.percent));
	}

	function findOrphanedCompat(ds: DrawTabDataAll): { type: string; id: string }[] {
		const tabletIds = new Set(ds.tablets.map((t) => t.Model.Id));
		const penIds = new Set(ds.pens.map((p) => p.PenId));
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

	// Pressure-response data-quality results
	let nonMonotonicSessions: NonMonotonicSession[] = $state([]);
	let missingLowEndPens: MissingLowEndPen[] = $state([]);
	let singleSessionPens: SingleSessionPen[] = $state([]);
	let staleMeasurements: StaleMeasurement[] = $state([]);
	let remeasureRecommendations: RemeasureRecommendation[] = $state([]);

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
		allIssues.push(
			...checkRequired(ds.tablets, 'Tablet', [
				'Meta.EntityId',
				'Model.Brand',
				'Model.Id',
				'Model.Name',
				'Model.Type',
			]),
		);
		allIssues.push(...checkRequired(ds.pens, 'Pen', ['EntityId', 'Brand', 'PenId', 'PenName']));
		allIssues.push(
			...checkRequired(ds.drivers, 'Driver', [
				'EntityId',
				'Brand',
				'DriverVersion',
				'DriverName',
				'OSFamily',
				'ReleaseDate',
			]),
		);
		allIssues.push(
			...checkRequired(ds.penFamilies, 'PenFamily', ['EntityId', 'Brand', 'FamilyName']),
		);
		allIssues.push(
			...checkRequired(ds.tabletFamilies, 'TabletFamily', ['EntityId', 'Brand', 'FamilyName']),
		);
		allIssues.push(...checkRequired(ds.penCompat, 'PenCompat', ['Brand', 'TabletId', 'PenId']));

		// Pressure response checks
		allIssues.push(
			...checkRequired(ds.pressureResponse, 'PressureResponse', [
				'Brand',
				'PenEntityId',
				'InventoryId',
				'Date',
				'TabletEntityId',
			]),
		);

		// Whitespace checks
		allIssues.push(...checkWhitespace(ds.tablets, 'Tablet'));
		allIssues.push(...checkWhitespace(ds.pens, 'Pen'));
		allIssues.push(...checkWhitespace(ds.drivers, 'Driver'));
		allIssues.push(...checkWhitespace(ds.pressureResponse, 'PressureResponse'));

		issues = allIssues;

		// Pressure-response data quality
		nonMonotonicSessions = findNonMonotonicSessions(ds.pressureResponse);
		missingLowEndPens = findMissingLowEnd(ds.pressureResponse);
		singleSessionPens = findSingleSessionPens(ds.pressureResponse);
		staleMeasurements = findStaleMeasurements(ds.pressureResponse);
		remeasureRecommendations = findRecommendedForRemeasurement(ds.pressureResponse);

		// Completion stats
		tabletCompletion = computeCompletion(ds.tablets, [
			'Model.LaunchYear',
			'Model.Audience',
			'Model.Family',
			'Model.Status',
			'Model.IncludedPen',
			'Digitizer.Type',
			'Digitizer.PressureLevels',
			'Digitizer.Dimensions',
			'Digitizer.Density',
			'Digitizer.ReportRate',
			'Digitizer.Tilt',
			'Digitizer.AccuracyCenter',
			'Digitizer.AccuracyCorner',
			'Digitizer.MaxHover',
			'Digitizer.SupportsTouch',
			'Physical.Dimensions',
			'Physical.Weight',
			'Model.ProductLink',
		]);

		const displayTablets = ds.tablets.filter(
			(t) => t.Model.Type === 'PENDISPLAY' || t.Model.Type === 'STANDALONE',
		);
		displayTabletCount = displayTablets.length;
		displayCompletion = computeCompletion(displayTablets, [
			'Display.PixelDimensions',
			'Display.PanelTech',
			'Display.Brightness',
			'Display.Contrast',
			'Display.ColorBitDepth',
			'Display.ColorGamuts',
			'Display.Lamination',
		]);

		penCompletion = computeCompletion(ds.pens, ['PenName', 'PenFamily', 'PenYear']);

		driverCompletion = computeCompletion(ds.drivers, [
			'DriverURLWacom',
			'DriverURLArchiveDotOrg',
			'ReleaseNotesURL',
		]);

		pressureResponseCompletion = computeCompletion(ds.pressureResponse, ['PenFamily', 'Notes']);

		inventoryPenCompletion = computeCompletion(invPens, [
			'PenEntityId',
			'PenTech',
			'WithTabletInventoryId',
		]);

		inventoryTabletCompletion = computeCompletion(invTablets, [
			'TabletEntityId',
			'Vendor',
			'OrderDate',
		]);

		// Orphaned compat references
		orphanedCompat = findOrphanedCompat(ds);

		// Orphaned family references
		const penFamilyIds = new Set(ds.penFamilies.map((f) => f.EntityId));
		const tabletFamilyIds = new Set(ds.tabletFamilies.map((f) => f.EntityId));
		const orphFamilies: typeof orphanedFamilies = [];
		for (const pen of ds.pens) {
			if (pen.PenFamily && !penFamilyIds.has(pen.PenFamily)) {
				orphFamilies.push({ type: 'PenFamily', id: pen.PenFamily, referencedBy: pen.PenId });
			}
		}
		for (const tab of ds.tablets) {
			if (tab.Model.Family && !tabletFamilyIds.has(tab.Model.Family)) {
				orphFamilies.push({
					type: 'TabletFamily',
					id: tab.Model.Family,
					referencedBy: tab.Model.Id,
				});
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
		const wacomTablets = ds.tablets.filter((t) => t.Model.Brand === 'WACOM');
		tabletsNoCompat = wacomTablets
			.filter((t) => !ds!.tabletToPens.has(t.Model.Id))
			.map((t) => ({ id: t.Model.Id, name: t.Model.Name }));

		pensNoCompat = ds.pens
			.filter((p) => !ds!.penToTablets.has(p.PenId))
			.map((p) => ({ id: p.PenId, name: p.PenName }));

		// Included pens missing compatibility info.
		// IncludedPen holds pen EntityIds (e.g. "wacom.pen.kp503e"); pen-compat
		// rows hold bare PenIds (e.g. "KP-503E"). Resolve each IncludedPen
		// EntityId to its pen record, then check that a pen-compat row exists
		// linking the tablet's Model.Id to that pen's PenId.
		const penByEntityId = new Map(ds.pens.map((p) => [p.EntityId, p]));
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
<SubNav tabs={dataTabs} />
<h1>Data Quality</h1>

{#if !ds}
	<p>Loading...</p>
{:else}
	<div class="dq-layout">
		<nav class="dq-tree" aria-label="Data quality sections">
			{#each groupedSections as [category, items]}
				<div class="tree-cat">
					<div class="tree-cat-label">{category}</div>
					<ul>
						{#each items as item}
							{@const c = item.count?.()}
							<li>
								<button
									type="button"
									class:active={activeSection === item.id}
									onclick={() => setSection(item.id)}
								>
									<span class="tree-label">{item.label}</span>
									{#if c != null}<span class="tree-count" class:zero={c === 0}>{c}</span>{/if}
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</nav>

		<main class="dq-content">
			{#if activeSection === 'entity-counts'}
				<section class="section">
					<div class="section-header">
						<h2>Entity Counts</h2>
						<button
							class="export-trigger"
							disabled={entityCounts.length === 0}
							onclick={() =>
								openExport(
									'Entity Counts',
									'data-quality-entity-counts',
									['Entity', 'Count'],
									entityCounts.map((r) => [r.entity, r.count]),
								)}>Export</button
						>
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
			{/if}

			{#if activeSection === 'issues'}
				<section class="section">
					<div class="section-header">
						<h2>Issues ({issues.length})</h2>
						<button
							class="export-trigger"
							disabled={issues.length === 0}
							onclick={() =>
								openExport(
									'Issues',
									'data-quality-issues',
									['Entity', 'Entity ID', 'Field', 'Issue', 'Value'],
									issues.map((i) => [i.entity, i.entityId, i.field, i.issue, i.value ?? '']),
								)}>Export</button
						>
					</div>
					{#if issues.length === 0}
						<p class="good">No issues found.</p>
					{:else}
						<table>
							<thead
								><tr><th>Entity</th><th>Entity ID</th><th>Field</th><th>Issue</th><th>Value</th></tr
								></thead
							>
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
			{/if}

			{#if activeSection === 'orphaned-compat'}
				<section class="section">
					<div class="section-header">
						<h2>Orphaned Compat References ({orphanedCompat.length})</h2>
						<button
							class="export-trigger"
							disabled={orphanedCompat.length === 0}
							onclick={() =>
								openExport(
									'Orphaned Compat References',
									'data-quality-orphaned-compat',
									['Type', 'ID'],
									orphanedCompat.map((o) => [o.type, o.id]),
								)}>Export</button
						>
					</div>
					<p class="description">
						IDs in pen-compat that don't match any record in the referenced entity.
					</p>
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
			{/if}

			{#if activeSection === 'wacom-no-compat'}
				<section class="section">
					<div class="section-header">
						<h2>Wacom Tablets with No Pen Compatibility Data ({tabletsNoCompat.length})</h2>
						<button
							class="export-trigger"
							disabled={tabletsNoCompat.length === 0}
							onclick={() =>
								openExport(
									'Wacom Tablets with No Pen Compatibility Data',
									'data-quality-wacom-no-compat',
									['Model ID', 'Name'],
									tabletsNoCompat.map((t) => [t.id, t.name]),
								)}>Export</button
						>
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
			{/if}

			{#if activeSection === 'pens-no-compat'}
				<section class="section">
					<div class="section-header">
						<h2>Pens with No Tablet Compatibility Data ({pensNoCompat.length})</h2>
						<button
							class="export-trigger"
							disabled={pensNoCompat.length === 0}
							onclick={() =>
								openExport(
									'Pens with No Tablet Compatibility Data',
									'data-quality-pens-no-compat',
									['Pen ID', 'Name'],
									pensNoCompat.map((p) => [p.id, p.name]),
								)}>Export</button
						>
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
			{/if}

			{#if activeSection === 'included-pen-no-compat'}
				<section class="section">
					<div class="section-header">
						<h2>Included Pens Missing Compatibility Info ({includedPenMissingCompat.length})</h2>
						<button
							class="export-trigger"
							disabled={includedPenMissingCompat.length === 0}
							onclick={() =>
								openExport(
									'Included Pens Missing Compatibility Info',
									'data-quality-included-pens-no-compat',
									['Tablet ID', 'Tablet Name', 'Pen EntityId', 'Pen Name'],
									includedPenMissingCompat.map((r) => [
										r.tabletId,
										r.tabletName,
										r.penEntityId,
										r.penName,
									]),
								)}>Export</button
						>
					</div>
					<p class="description">
						Tablets whose <code>Model.IncludedPen</code> references a pen, but no pen-compat row links
						the tablet and pen. These should always be present — an included pen is by definition compatible
						with its tablet.
					</p>
					{#if includedPenMissingCompat.length === 0}
						<p class="good">All included pens have a matching pen-compat row.</p>
					{:else}
						<table class="compact">
							<thead
								><tr
									><th>Tablet ID</th><th>Tablet Name</th><th>Pen EntityId</th><th>Pen Name</th></tr
								></thead
							>
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
			{/if}

			{#if activeSection === 'orphaned-families'}
				<section class="section">
					<div class="section-header">
						<h2>Orphaned Family References ({orphanedFamilies.length})</h2>
						<button
							class="export-trigger"
							disabled={orphanedFamilies.length === 0}
							onclick={() =>
								openExport(
									'Orphaned Family References',
									'data-quality-orphaned-families',
									['Type', 'Family ID', 'Referenced By'],
									orphanedFamilies.map((o) => [o.type, o.id, o.referencedBy]),
								)}>Export</button
						>
					</div>
					<p class="description">
						Family IDs referenced by pens or tablets that don't exist in the family entities.
					</p>
					{#if orphanedFamilies.length === 0}
						<p class="good">No orphaned family references.</p>
					{:else}
						<table class="compact">
							<thead><tr><th>Type</th><th>Family ID</th><th>Referenced By</th></tr></thead>
							<tbody>
								{#each orphanedFamilies as o}
									<tr
										><td>{o.type}</td><td class="mono">{o.id}</td><td class="mono"
											>{o.referencedBy}</td
										></tr
									>
								{/each}
							</tbody>
						</table>
					{/if}
				</section>
			{/if}

			{#if activeSection === 'pressure-non-monotonic'}
				<section class="section">
					<div class="section-header">
						<h2>Non-Monotonic Sessions ({nonMonotonicSessions.length})</h2>
						<button
							class="export-trigger"
							disabled={nonMonotonicSessions.length === 0}
							onclick={() =>
								openExport(
									'Non-Monotonic Pressure Sessions',
									'data-quality-pressure-non-monotonic',
									['Brand', 'Pen', 'Inventory ID', 'Date', 'Drop Index', 'From %', 'To %'],
									nonMonotonicSessions.map((n) => [
										n.session.Brand,
										n.session.PenEntityId,
										n.session.InventoryId,
										n.session.Date,
										n.firstDrop.index,
										n.firstDrop.from.toFixed(2),
										n.firstDrop.to.toFixed(2),
									]),
								)}>Export</button
						>
					</div>
					<p class="description">
						Sessions where logical pressure drops at some point as physical force increases. A valid
						session should be monotonically non-decreasing on the logical axis.
					</p>
					{#if nonMonotonicSessions.length === 0}
						<p class="good">All sessions are monotonically non-decreasing.</p>
					{:else}
						<table class="compact">
							<thead>
								<tr>
									<th>Brand</th>
									<th>Pen</th>
									<th>Inventory ID</th>
									<th>Date</th>
									<th>Drop @</th>
									<th>From → To</th>
								</tr>
							</thead>
							<tbody>
								{#each nonMonotonicSessions as n (n.session._id)}
									<tr>
										<td>{n.session.Brand}</td>
										<td class="mono">
											<a href="{base}/entity/{encodeURIComponent(n.session.PenEntityId)}">
												{n.session.PenEntityId}
											</a>
										</td>
										<td class="mono">
											<a href="{base}/entity/{encodeURIComponent(sessionEntityId(n.session))}">
												{n.session.InventoryId}
											</a>
										</td>
										<td class="mono">{n.session.Date}</td>
										<td class="num">{n.firstDrop.index}</td>
										<td class="num mono">
											{n.firstDrop.from.toFixed(2)} → {n.firstDrop.to.toFixed(2)}%
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</section>
			{/if}

			{#if activeSection === 'pressure-missing-low-end'}
				<section class="section">
					<div class="section-header">
						<h2>Missing Low-End ({missingLowEndPens.length})</h2>
						<button
							class="export-trigger"
							disabled={missingLowEndPens.length === 0}
							onclick={() =>
								openExport(
									'Pens Missing Low-End Measurements',
									'data-quality-pressure-missing-low-end',
									['Brand', 'Pen', 'Inventory ID', 'Lowest %', 'Sessions'],
									missingLowEndPens.map((p) => [
										p.brand,
										p.penEntityId,
										p.inventoryId,
										p.lowestLogical.toFixed(2),
										p.sessionCount,
									]),
								)}>Export</button
						>
					</div>
					<p class="description">
						Pens whose lowest measured logical pressure across all sessions is still above 0.5%. The
						IAF (P00) estimate may be unreliable for these.
					</p>
					{#if missingLowEndPens.length === 0}
						<p class="good">All pens have low-end measurements covering the activation point.</p>
					{:else}
						<table class="compact">
							<thead>
								<tr>
									<th>Brand</th>
									<th>Pen</th>
									<th>Inventory ID</th>
									<th>Lowest %</th>
									<th>Sessions</th>
								</tr>
							</thead>
							<tbody>
								{#each missingLowEndPens as p (p.inventoryId)}
									<tr>
										<td>{p.brand}</td>
										<td class="mono">
											<a href="{base}/entity/{encodeURIComponent(p.penEntityId)}">
												{p.penEntityId}
											</a>
										</td>
										<td class="mono">{p.inventoryId}</td>
										<td class="num mono">{p.lowestLogical.toFixed(2)}</td>
										<td class="num">{p.sessionCount}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</section>
			{/if}

			{#if activeSection === 'pressure-single-session'}
				<section class="section">
					<div class="section-header">
						<h2>Single-Session Pens ({singleSessionPens.length})</h2>
						<button
							class="export-trigger"
							disabled={singleSessionPens.length === 0}
							onclick={() =>
								openExport(
									'Pens with Only One Pressure-Response Session',
									'data-quality-pressure-single-session',
									['Brand', 'Pen', 'Inventory ID', 'Date'],
									singleSessionPens.map((p) => [p.brand, p.penEntityId, p.inventoryId, p.date]),
								)}>Export</button
						>
					</div>
					<p class="description">
						Pens with only one recorded session. A second session would confirm consistency.
					</p>
					{#if singleSessionPens.length === 0}
						<p class="good">Every pen has at least two sessions on record.</p>
					{:else}
						<table class="compact">
							<thead>
								<tr>
									<th>Brand</th>
									<th>Pen</th>
									<th>Inventory ID</th>
									<th>Date</th>
								</tr>
							</thead>
							<tbody>
								{#each singleSessionPens as p (p.inventoryId)}
									<tr>
										<td>{p.brand}</td>
										<td class="mono">
											<a href="{base}/entity/{encodeURIComponent(p.penEntityId)}">
												{p.penEntityId}
											</a>
										</td>
										<td class="mono">
											<a href="{base}/entity/{encodeURIComponent(p.sessionEntityId)}">
												{p.inventoryId}
											</a>
										</td>
										<td class="mono">{p.date}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</section>
			{/if}

			{#if activeSection === 'pressure-stale'}
				<section class="section">
					<div class="section-header">
						<h2>Stale Measurements ({staleMeasurements.length})</h2>
						<button
							class="export-trigger"
							disabled={staleMeasurements.length === 0}
							onclick={() =>
								openExport(
									'Pens with Stale Measurements',
									'data-quality-pressure-stale',
									['Brand', 'Pen', 'Inventory ID', 'Last Measured', 'Days Ago'],
									staleMeasurements.map((p) => [
										p.brand,
										p.penEntityId,
										p.inventoryId,
										p.lastDate,
										p.daysAgo,
									]),
								)}>Export</button
						>
					</div>
					<p class="description">
						Pens whose most recent session was more than a year ago. Drift over time may invalidate
						older curves.
					</p>
					{#if staleMeasurements.length === 0}
						<p class="good">Every pen has a session in the last year.</p>
					{:else}
						<table class="compact">
							<thead>
								<tr>
									<th>Brand</th>
									<th>Pen</th>
									<th>Inventory ID</th>
									<th>Last Measured</th>
									<th>Days Ago</th>
								</tr>
							</thead>
							<tbody>
								{#each staleMeasurements as p (p.inventoryId)}
									<tr>
										<td>{p.brand}</td>
										<td class="mono">
											<a href="{base}/entity/{encodeURIComponent(p.penEntityId)}">
												{p.penEntityId}
											</a>
										</td>
										<td class="mono">{p.inventoryId}</td>
										<td class="mono">{p.lastDate}</td>
										<td class="num">{p.daysAgo}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</section>
			{/if}

			{#if activeSection === 'pressure-remeasure'}
				<section class="section">
					<div class="section-header">
						<h2>Recommended for Re-measurement ({remeasureRecommendations.length})</h2>
						<button
							class="export-trigger"
							disabled={remeasureRecommendations.length === 0}
							onclick={() =>
								openExport(
									'Pens Recommended for Re-measurement',
									'data-quality-pressure-remeasure',
									['Brand', 'Pen', 'Inventory ID', 'Reasons'],
									remeasureRecommendations.map((p) => [
										p.brand,
										p.penEntityId,
										p.inventoryId,
										p.reasons.join(', '),
									]),
								)}>Export</button
						>
					</div>
					<p class="description">
						Union of the missing-low-end, single-session, and stale checks. Pens with the most
						reasons appear first.
					</p>
					{#if remeasureRecommendations.length === 0}
						<p class="good">No pens need re-measurement.</p>
					{:else}
						<table class="compact">
							<thead>
								<tr>
									<th>Brand</th>
									<th>Pen</th>
									<th>Inventory ID</th>
									<th>Reasons</th>
								</tr>
							</thead>
							<tbody>
								{#each remeasureRecommendations as p (p.inventoryId)}
									<tr>
										<td>{p.brand}</td>
										<td class="mono">
											<a href="{base}/entity/{encodeURIComponent(p.penEntityId)}">
												{p.penEntityId}
											</a>
										</td>
										<td class="mono">{p.inventoryId}</td>
										<td>{p.reasons.join(', ')}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</section>
			{/if}

			{#if activeSection === 'completion-tablet'}
				<section class="section">
					<div class="section-header">
						<h2>Tablet Field Completion</h2>
						<button
							class="export-trigger"
							disabled={tabletCompletion.length === 0}
							onclick={() =>
								openExport(
									'Tablet Field Completion',
									'data-quality-tablet-completion',
									['Field', 'Populated', '%'],
									tabletCompletion.map((s) => [
										s.field,
										`${s.populated}/${s.total}`,
										`${s.percent}%`,
									]),
								)}>Export</button
						>
					</div>
					<p class="description">
						How many of the {ds.tablets.length} tablets have each field populated.
					</p>
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
									<td
										>{#if stat.populated < stat.total}<a
												class="view-link"
												href={buildFilterUrl('/', [
													{ field: stat.field, operator: 'empty', value: '' },
												])}>show</a
											>{/if}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>
			{/if}

			{#if activeSection === 'completion-display'}
				<section class="section">
					<div class="section-header">
						<h2>Display Field Completion</h2>
						<button
							class="export-trigger"
							disabled={displayCompletion.length === 0}
							onclick={() =>
								openExport(
									'Display Field Completion',
									'data-quality-display-completion',
									['Field', 'Populated', '%'],
									displayCompletion.map((s) => [
										s.field,
										`${s.populated}/${s.total}`,
										`${s.percent}%`,
									]),
								)}>Export</button
						>
					</div>
					<p class="description">
						How many of the {displayTabletCount} pen displays and standalone tablets have each display
						field populated.
					</p>
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
									<td
										>{#if stat.populated < stat.total}<a
												class="view-link"
												href={buildFilterUrl('/', [
													{ field: stat.field, operator: 'empty', value: '' },
												])}>show</a
											>{/if}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>
			{/if}

			{#if activeSection === 'completion-pen'}
				<section class="section">
					<div class="section-header">
						<h2>Pen Field Completion</h2>
						<button
							class="export-trigger"
							disabled={penCompletion.length === 0}
							onclick={() =>
								openExport(
									'Pen Field Completion',
									'data-quality-pen-completion',
									['Field', 'Populated', '%'],
									penCompletion.map((s) => [s.field, `${s.populated}/${s.total}`, `${s.percent}%`]),
								)}>Export</button
						>
					</div>
					<p class="description">
						How many of the {ds.pens.length} pens have each optional field populated.
					</p>
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
									<td
										>{#if stat.populated < stat.total}<a
												class="view-link"
												href={buildFilterUrl('/pens', [
													{ field: stat.field, operator: 'empty', value: '' },
												])}>show</a
											>{/if}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>
			{/if}

			{#if activeSection === 'completion-driver'}
				<section class="section">
					<div class="section-header">
						<h2>Driver Field Completion</h2>
						<button
							class="export-trigger"
							disabled={driverCompletion.length === 0}
							onclick={() =>
								openExport(
									'Driver Field Completion',
									'data-quality-driver-completion',
									['Field', 'Populated', '%'],
									driverCompletion.map((s) => [
										s.field,
										`${s.populated}/${s.total}`,
										`${s.percent}%`,
									]),
								)}>Export</button
						>
					</div>
					<p class="description">
						How many of the {ds.drivers.length} drivers have each optional field populated.
					</p>
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
									<td
										>{#if stat.populated < stat.total}<a
												class="view-link"
												href={buildFilterUrl('/drivers', [
													{ field: stat.field, operator: 'empty', value: '' },
												])}>show</a
											>{/if}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>
			{/if}

			{#if activeSection === 'completion-pressure'}
				<section class="section">
					<div class="section-header">
						<h2>Pressure Response Field Completion</h2>
						<button
							class="export-trigger"
							disabled={pressureResponseCompletion.length === 0}
							onclick={() =>
								openExport(
									'Pressure Response Field Completion',
									'data-quality-pressure-response-completion',
									['Field', 'Populated', '%'],
									pressureResponseCompletion.map((s) => [
										s.field,
										`${s.populated}/${s.total}`,
										`${s.percent}%`,
									]),
								)}>Export</button
						>
					</div>
					<p class="description">
						How many of the {ds.pressureResponse.length} sessions have each optional field populated.
					</p>
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
									<td
										>{#if stat.populated < stat.total}<a
												class="view-link"
												href={buildFilterUrl('/pressure-response', [
													{ field: stat.field, operator: 'empty', value: '' },
												])}>show</a
											>{/if}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>
			{/if}

			{#if activeSection === 'completion-inv-pen'}
				<section class="section">
					<div class="section-header">
						<h2>Inventory Pen Field Completion</h2>
						<button
							class="export-trigger"
							disabled={inventoryPenCompletion.length === 0}
							onclick={() =>
								openExport(
									'Inventory Pen Field Completion',
									'data-quality-inventory-pen-completion',
									['Field', 'Populated', '%'],
									inventoryPenCompletion.map((s) => [
										s.field,
										`${s.populated}/${s.total}`,
										`${s.percent}%`,
									]),
								)}>Export</button
						>
					</div>
					<p class="description">
						How many of the {inventoryPenCount} inventory pens have each optional field populated.
					</p>
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
			{/if}

			{#if activeSection === 'completion-inv-tablet'}
				<section class="section">
					<div class="section-header">
						<h2>Inventory Tablet Field Completion</h2>
						<button
							class="export-trigger"
							disabled={inventoryTabletCompletion.length === 0}
							onclick={() =>
								openExport(
									'Inventory Tablet Field Completion',
									'data-quality-inventory-tablet-completion',
									['Field', 'Populated', '%'],
									inventoryTabletCompletion.map((s) => [
										s.field,
										`${s.populated}/${s.total}`,
										`${s.percent}%`,
									]),
								)}>Export</button
						>
					</div>
					<p class="description">
						How many of the {inventoryTabletCount} inventory tablets have each optional field populated.
					</p>
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
		</main>
	</div>

	{#if exportDialog}
		<ExportDialog
			entityType="data-quality"
			title={exportDialog.title}
			filename={exportDialog.filename}
			headers={exportDialog.headers}
			rows={exportDialog.rows}
			onclose={() => (exportDialog = null)}
		/>
	{/if}
{/if}

<style>
	h1 {
		margin-bottom: 16px;
	}

	.dq-layout {
		display: flex;
		gap: 24px;
		align-items: flex-start;
	}

	.dq-tree {
		flex: 0 0 240px;
		position: sticky;
		top: 16px;
		max-height: calc(100vh - 32px);
		overflow-y: auto;
		border-right: 1px solid var(--border, #e0e0e0);
		padding: 4px 12px 4px 0;
		font-size: 13px;
	}

	.dq-content {
		flex: 1;
		min-width: 0;
	}

	.tree-cat {
		margin-bottom: 14px;
	}

	.tree-cat-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted, #888);
		padding: 0 8px;
		margin-bottom: 4px;
	}

	.tree-cat ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tree-cat li {
		margin: 0;
	}

	.tree-cat button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		padding: 5px 10px;
		font-size: 13px;
		text-align: left;
		border: 1px solid transparent;
		border-radius: 4px;
		background: transparent;
		color: var(--text, #333);
		cursor: pointer;
		line-height: 1.3;
	}

	.tree-cat button:hover {
		background: #eff6ff;
		color: #2563eb;
	}

	.tree-cat button.active {
		background: #dbeafe;
		color: #1e40af;
		font-weight: 600;
	}

	.tree-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tree-count {
		flex: 0 0 auto;
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		padding: 1px 6px;
		border-radius: 9px;
		background: #fee2e2;
		color: #991b1b;
	}

	.tree-count.zero {
		background: #dcfce7;
		color: #166534;
	}

	.tree-cat button.active .tree-count {
		background: #1e40af;
		color: #fff;
	}

	.tree-cat button.active .tree-count.zero {
		background: #166534;
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

	.export-trigger {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		font-size: 12px;
		border: 1px solid var(--border, #ccc);
		border-radius: 4px;
		background: var(--bg-card, #fff);
		color: var(--text-muted, #666);
		cursor: pointer;
	}
	.export-trigger:hover {
		border-color: var(--text-dim, #999);
		color: var(--text, #333);
	}
	.export-trigger:disabled {
		opacity: 0.4;
		cursor: not-allowed;
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

	table.compact {
		width: auto;
	}

	th,
	td {
		text-align: left;
		padding: 5px 10px;
		border-bottom: 1px solid #e0e0e0;
	}

	th {
		background: #333;
		color: #fff;
	}

	tr:hover td {
		background: #f0f7ff;
	}

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

	.view-link:hover {
		text-decoration: underline;
	}
</style>
