<script lang="ts">
	import { createExportDialogHost } from '$lib/export-dialog-host.svelte.js';
	import { resolve } from '$app/paths';
	import { sessionEntityId } from '$data/lib/pressure/session-id.js';
	import ChromeLayout from '$lib/components/ChromeLayout.svelte';
	import { dataSubNavTabs } from '$lib/nav/subnav-tabs.js';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import SectionedPage, { type Section } from '$lib/components/SectionedPage.svelte';
	import { analyzeData } from '$lib/data-quality/analysis.js';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import SortableTable from '$lib/components/SortableTable.svelte';
	import type { SortableColumn } from '$lib/components/sortable-table.js';
	import CompletionSection from '$lib/data-quality/CompletionSection.svelte';
	import StatusMessage from '$lib/components/StatusMessage.svelte';
	import LoadingState from '$lib/components/LoadingState.svelte';

	const dataTabs = dataSubNavTabs();

	let { data } = $props();

	// Single shared ExportDialog, opened by per-section trigger buttons via the
	// shared export host (#236). `openExport` is kept as a local alias so the
	// section triggers read unchanged.
	const exportHost = createExportDialogHost();
	const openExport = exportHost.open;

	const analysis = $derived(analyzeData(data));

	let ds = $derived(analysis.ds);
	let issues = $derived(analysis.issues);
	let tabletCompletion = $derived(analysis.tabletCompletion);
	let displayCompletion = $derived(analysis.displayCompletion);
	let displayTabletCount = $derived(analysis.displayTabletCount);
	let penCompletion = $derived(analysis.penCompletion);
	let driverCompletion = $derived(analysis.driverCompletion);
	let pressureResponseCompletion = $derived(analysis.pressureResponseCompletion);
	let inventoryPenCompletion = $derived(analysis.inventoryPenCompletion);
	let inventoryTabletCompletion = $derived(analysis.inventoryTabletCompletion);
	let orphanedCompat = $derived(analysis.orphanedCompat);
	let orphanedFamilies = $derived(analysis.orphanedFamilies);
	let entityCounts = $derived(analysis.entityCounts);
	let inventoryPenCount = $derived(analysis.inventoryPenCount);
	let inventoryTabletCount = $derived(analysis.inventoryTabletCount);
	let tabletsNoCompat = $derived(analysis.tabletsNoCompat);
	let pensNoCompat = $derived(analysis.pensNoCompat);
	let includedPenMissingCompat = $derived(analysis.includedPenMissingCompat);
	let nonMonotonicSessions = $derived(analysis.nonMonotonicSessions);
	let missingLowEndPens = $derived(analysis.missingLowEndPens);
	let singleSessionPens = $derived(analysis.singleSessionPens);
	let staleMeasurements = $derived(analysis.staleMeasurements);
	let remeasureRecommendations = $derived(analysis.remeasureRecommendations);
	let iafEstimatedNoMeasurement = $derived(analysis.iafEstimatedNoMeasurement);
	let tabletsMissingExactReleaseDate = $derived(analysis.tabletsMissingExactReleaseDate);

	// Brand + Missing filters for the "Tablets — No Exact Release Date" section.
	let releaseDateBrand = $state('');
	let releaseDateMissing = $state('');
	let releaseDateBrands = $derived(
		[...new Set(tabletsMissingExactReleaseDate.map((t) => t.brand))].sort(),
	);
	let releaseDateMissingKinds = $derived(
		[...new Set(tabletsMissingExactReleaseDate.map((t) => t.missing))].sort(),
	);
	let filteredReleaseDateTablets = $derived(
		tabletsMissingExactReleaseDate.filter(
			(t) =>
				(!releaseDateBrand || t.brand === releaseDateBrand) &&
				(!releaseDateMissing || t.missing === releaseDateMissing),
		),
	);

	// Column configs for the SortableTable instances below. Each cell's `get`
	// returns the display value; `sortValue` supplies a numeric/raw sort key
	// where it differs; `href` makes a cell a link.
	const entityCountsCols: SortableColumn[] = [
		{ key: 'entity', label: 'Entity', get: (r) => r.entity },
		{ key: 'count', label: 'Count', get: (r) => r.count, num: true },
	];
	const issuesCols: SortableColumn[] = [
		{ key: 'entity', label: 'Entity', get: (i) => i.entity },
		{ key: 'entityId', label: 'Entity ID', get: (i) => i.entityId, mono: true },
		{ key: 'field', label: 'Field', get: (i) => i.field },
		{ key: 'issue', label: 'Issue', get: (i) => i.issue },
		{ key: 'value', label: 'Value', get: (i) => i.value ?? '', mono: true },
	];
	const orphanedCompatCols: SortableColumn[] = [
		{ key: 'type', label: 'Type', get: (o) => o.type },
		{ key: 'id', label: 'ID', get: (o) => o.id, mono: true },
	];
	const wacomNoCompatCols: SortableColumn[] = [
		{ key: 'id', label: 'Model ID', get: (t) => t.id, mono: true },
		{ key: 'name', label: 'Name', get: (t) => t.name },
	];
	const pensNoCompatCols: SortableColumn[] = [
		{ key: 'id', label: 'Pen ID', get: (p) => p.id, mono: true },
		{ key: 'name', label: 'Name', get: (p) => p.name },
	];
	const includedPenNoCompatCols: SortableColumn[] = [
		{ key: 'tabletId', label: 'Tablet ID', get: (r) => r.tabletId, mono: true },
		{ key: 'tabletName', label: 'Tablet Name', get: (r) => r.tabletName },
		{ key: 'penEntityId', label: 'Pen EntityId', get: (r) => r.penEntityId, mono: true },
		{ key: 'penName', label: 'Pen Name', get: (r) => r.penName },
	];
	const orphanedFamiliesCols: SortableColumn[] = [
		{ key: 'type', label: 'Type', get: (o) => o.type },
		{ key: 'id', label: 'Family ID', get: (o) => o.id, mono: true },
		{ key: 'referencedBy', label: 'Referenced By', get: (o) => o.referencedBy, mono: true },
	];
	const nonMonotonicCols: SortableColumn[] = [
		{ key: 'brand', label: 'Brand', get: (n) => n.session.Brand },
		{
			key: 'pen',
			label: 'Pen',
			get: (n) => n.session.PenEntityId,
			mono: true,
			href: (n) => resolve('/entity/[entityId]', { entityId: n.session.PenEntityId }),
		},
		{
			key: 'inventoryId',
			label: 'Inventory ID',
			get: (n) => n.session.InventoryId,
			mono: true,
			href: (n) => resolve('/entity/[entityId]', { entityId: sessionEntityId(n.session) }),
		},
		{ key: 'date', label: 'Date', get: (n) => n.session.Date, mono: true },
		{ key: 'axis', label: 'Axis', get: (n) => n.firstDrop.axis },
		{ key: 'dropIndex', label: 'Drop @', get: (n) => n.firstDrop.index, num: true },
		{
			key: 'fromTo',
			label: 'From → To',
			num: true,
			mono: true,
			get: (n) =>
				`${n.firstDrop.from.toFixed(2)} → ${n.firstDrop.to.toFixed(2)}${n.firstDrop.axis === 'logical' ? '%' : ' gf'}`,
			sortValue: (n) => n.firstDrop.from,
		},
	];
	const missingLowEndCols: SortableColumn[] = [
		{ key: 'brand', label: 'Brand', get: (p) => p.brand },
		{
			key: 'pen',
			label: 'Pen',
			get: (p) => p.penEntityId,
			mono: true,
			href: (p) => resolve('/entity/[entityId]', { entityId: p.penEntityId }),
		},
		{ key: 'inventoryId', label: 'Inventory ID', get: (p) => p.inventoryId, mono: true },
		{
			key: 'lowest',
			label: 'Lowest %',
			get: (p) => p.lowestLogical.toFixed(2),
			sortValue: (p) => p.lowestLogical,
			num: true,
			mono: true,
		},
		{ key: 'sessions', label: 'Sessions', get: (p) => p.sessionCount, num: true },
	];
	const singleSessionCols: SortableColumn[] = [
		{ key: 'brand', label: 'Brand', get: (p) => p.brand },
		{
			key: 'pen',
			label: 'Pen',
			get: (p) => p.penEntityId,
			mono: true,
			href: (p) => resolve('/entity/[entityId]', { entityId: p.penEntityId }),
		},
		{
			key: 'inventoryId',
			label: 'Inventory ID',
			get: (p) => p.inventoryId,
			mono: true,
			href: (p) => resolve('/entity/[entityId]', { entityId: p.sessionEntityId }),
		},
		{ key: 'date', label: 'Date', get: (p) => p.date, mono: true },
	];
	const iafNotMeasuredCols: SortableColumn[] = [
		{ key: 'brand', label: 'Brand', get: (p) => p.brand },
		{
			key: 'pen',
			label: 'Pen',
			get: (p) => p.penName,
			href: (p) => resolve('/entity/[entityId]', { entityId: p.penEntityId }),
		},
		{ key: 'inventoryId', label: 'Inventory ID', get: (p) => p.inventoryId, mono: true },
		{
			key: 'estimate',
			label: 'Estimated IAF (gf)',
			get: (p) => p.estimate.toFixed(1),
			sortValue: (p) => p.estimate,
			num: true,
			mono: true,
		},
	];
	const releaseDateCols: SortableColumn[] = [
		{ key: 'brand', label: 'Brand', get: (t) => t.brand },
		{
			key: 'tablet',
			label: 'Tablet',
			get: (t) => `${t.name} (${t.id})`,
			sortValue: (t) => t.name,
			href: (t) => resolve('/entity/[entityId]', { entityId: t.entityId }),
		},
		{
			key: 'releaseDate',
			label: 'Current',
			get: (t) => t.releaseDate || '—',
			sortValue: (t) => t.releaseDate,
			mono: true,
		},
		{ key: 'missing', label: 'Missing', get: (t) => t.missing },
	];
	const staleCols: SortableColumn[] = [
		{ key: 'brand', label: 'Brand', get: (p) => p.brand },
		{
			key: 'pen',
			label: 'Pen',
			get: (p) => p.penEntityId,
			mono: true,
			href: (p) => resolve('/entity/[entityId]', { entityId: p.penEntityId }),
		},
		{ key: 'inventoryId', label: 'Inventory ID', get: (p) => p.inventoryId, mono: true },
		{ key: 'lastDate', label: 'Last Measured', get: (p) => p.lastDate, mono: true },
		{ key: 'daysAgo', label: 'Days Ago', get: (p) => p.daysAgo, num: true },
	];
	const remeasureCols: SortableColumn[] = [
		{ key: 'brand', label: 'Brand', get: (p) => p.brand },
		{
			key: 'pen',
			label: 'Pen',
			get: (p) => p.penEntityId,
			mono: true,
			href: (p) => resolve('/entity/[entityId]', { entityId: p.penEntityId }),
		},
		{ key: 'inventoryId', label: 'Inventory ID', get: (p) => p.inventoryId, mono: true },
		{ key: 'reasons', label: 'Reasons', get: (p) => p.reasons.join(', ') },
	];

	// Source of truth for the navigation tree. `count` (optional) is
	// re-read every render so the badge stays in sync with the derived
	// state above.
	let sectionDefs: Section[] = $derived([
		{ id: 'entity-counts', category: 'Summary', label: 'Entity Counts' },
		{ id: 'issues', category: 'Summary', label: 'Issues', count: issues.length },
		{
			id: 'orphaned-compat',
			category: 'Compatibility',
			label: 'Orphaned Compat',
			count: orphanedCompat.length,
		},
		{
			id: 'wacom-no-compat',
			category: 'Compatibility',
			label: 'Wacom — No Compat',
			count: tabletsNoCompat.length,
		},
		{
			id: 'pens-no-compat',
			category: 'Compatibility',
			label: 'Pens — No Compat',
			count: pensNoCompat.length,
		},
		{
			id: 'included-pen-no-compat',
			category: 'Compatibility',
			label: 'Included Pen — No Compat',
			count: includedPenMissingCompat.length,
		},
		{
			id: 'orphaned-families',
			category: 'Compatibility',
			label: 'Orphaned Families',
			count: orphanedFamilies.length,
		},
		{
			id: 'pressure-non-monotonic',
			category: 'Pressure Response',
			label: 'Non-Monotonic',
			count: nonMonotonicSessions.length,
		},
		{
			id: 'pressure-missing-low-end',
			category: 'Pressure Response',
			label: 'Missing Low-End',
			count: missingLowEndPens.length,
		},
		{
			id: 'pressure-single-session',
			category: 'Pressure Response',
			label: 'Single Session',
			count: singleSessionPens.length,
		},
		{
			id: 'pressure-stale',
			category: 'Pressure Response',
			label: 'Stale',
			count: staleMeasurements.length,
		},
		{
			id: 'pressure-remeasure',
			category: 'Pressure Response',
			label: 'Remeasure',
			count: remeasureRecommendations.length,
		},
		{
			id: 'iaf-not-measured',
			category: 'Pressure Response',
			label: 'IAF — Not Measured',
			count: iafEstimatedNoMeasurement.length,
		},
		{
			id: 'tablet-release-dates',
			category: 'Field Completion',
			label: 'Tablet Release Dates',
			count: tabletsMissingExactReleaseDate.length,
		},
		{ id: 'completion-tablet', category: 'Field Completion', label: 'Tablets' },
		{ id: 'completion-display', category: 'Field Completion', label: 'Displays' },
		{ id: 'completion-pen', category: 'Field Completion', label: 'Pens' },
		{ id: 'completion-driver', category: 'Field Completion', label: 'Drivers' },
		{ id: 'completion-pressure', category: 'Field Completion', label: 'Pressure Response' },
		{ id: 'completion-inv-pen', category: 'Field Completion', label: 'Inventory Pens' },
		{ id: 'completion-inv-tablet', category: 'Field Completion', label: 'Inventory Tablets' },
	]);
</script>

<ChromeLayout subNavTabs={dataTabs}>
	<h1>Data Quality</h1>

	{#if !ds}
		<LoadingState />
	{:else}
		<SectionedPage sections={sectionDefs} defaultSection="entity-counts">
			{#snippet content(activeSection: string)}
				{#if activeSection === 'entity-counts'}
					<section class="section">
						<SectionHeader title="Entity Counts" />
						<SortableTable
							columns={entityCountsCols}
							rows={entityCounts}
							rowKey={(r) => r.entity}
							tableClass="compact"
							exportDisabled={entityCounts.length === 0}
							onExport={() =>
								openExport(
									'Entity Counts',
									'data-quality-entity-counts',
									['Entity', 'Count'],
									entityCounts.map((r) => [r.entity, r.count]),
								)}
						/>
					</section>
				{/if}

				{#if activeSection === 'issues'}
					<section class="section">
						<SectionHeader title="Issues" count={issues.length} />
						{#if issues.length === 0}
							<StatusMessage variant="good">No issues found.</StatusMessage>
						{:else}
							<SortableTable
								columns={issuesCols}
								rows={issues}
								rowKey={(_r, i) => i}
								onExport={() =>
									openExport(
										'Issues',
										'data-quality-issues',
										['Entity', 'Entity ID', 'Field', 'Issue', 'Value'],
										issues.map((i) => [i.entity, i.entityId, i.field, i.issue, i.value ?? '']),
									)}
							/>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'orphaned-compat'}
					<section class="section">
						<SectionHeader title="Orphaned Compat References" count={orphanedCompat.length} />
						<p class="description">
							IDs in pen-compat that don't match any record in the referenced entity.
						</p>
						{#if orphanedCompat.length === 0}
							<StatusMessage variant="good">No orphaned references.</StatusMessage>
						{:else}
							<SortableTable
								columns={orphanedCompatCols}
								rows={orphanedCompat}
								rowKey={(o) => o.type + '|' + o.id}
								tableClass="compact"
								onExport={() =>
									openExport(
										'Orphaned Compat References',
										'data-quality-orphaned-compat',
										['Type', 'ID'],
										orphanedCompat.map((o) => [o.type, o.id]),
									)}
							/>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'wacom-no-compat'}
					<section class="section">
						<SectionHeader
							title="Wacom Tablets with No Pen Compatibility Data"
							count={tabletsNoCompat.length}
						/>
						<p class="description">Wacom tablets that have no entries in pen-compat.</p>
						{#if tabletsNoCompat.length === 0}
							<StatusMessage variant="good"
								>All Wacom tablets have compatibility data.</StatusMessage
							>
						{:else}
							<SortableTable
								columns={wacomNoCompatCols}
								rows={tabletsNoCompat}
								rowKey={(t) => t.id}
								tableClass="compact"
								onExport={() =>
									openExport(
										'Wacom Tablets with No Pen Compatibility Data',
										'data-quality-wacom-no-compat',
										['Model ID', 'Name'],
										tabletsNoCompat.map((t) => [t.id, t.name]),
									)}
							/>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'pens-no-compat'}
					<section class="section">
						<SectionHeader
							title="Pens with No Tablet Compatibility Data"
							count={pensNoCompat.length}
						/>
						<p class="description">Pens that have no entries in pen-compat.</p>
						{#if pensNoCompat.length === 0}
							<StatusMessage variant="good">All pens have compatibility data.</StatusMessage>
						{:else}
							<SortableTable
								columns={pensNoCompatCols}
								rows={pensNoCompat}
								rowKey={(p) => p.id}
								tableClass="compact"
								onExport={() =>
									openExport(
										'Pens with No Tablet Compatibility Data',
										'data-quality-pens-no-compat',
										['Pen ID', 'Name'],
										pensNoCompat.map((p) => [p.id, p.name]),
									)}
							/>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'included-pen-no-compat'}
					<section class="section">
						<SectionHeader
							title="Included Pens Missing Compatibility Info"
							count={includedPenMissingCompat.length}
						/>
						<p class="description">
							Tablets whose <code>Model.IncludedPen</code> references a pen, but no pen-compat row links
							the tablet and pen. These should always be present — an included pen is by definition compatible
							with its tablet.
						</p>
						{#if includedPenMissingCompat.length === 0}
							<StatusMessage variant="good"
								>All included pens have a matching pen-compat row.</StatusMessage
							>
						{:else}
							<SortableTable
								columns={includedPenNoCompatCols}
								rows={includedPenMissingCompat}
								rowKey={(r) => r.tabletId + '|' + r.penEntityId}
								tableClass="compact"
								onExport={() =>
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
									)}
							/>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'orphaned-families'}
					<section class="section">
						<SectionHeader title="Orphaned Family References" count={orphanedFamilies.length} />
						<p class="description">
							Family IDs referenced by pens or tablets that don't exist in the family entities.
						</p>
						{#if orphanedFamilies.length === 0}
							<StatusMessage variant="good">No orphaned family references.</StatusMessage>
						{:else}
							<SortableTable
								columns={orphanedFamiliesCols}
								rows={orphanedFamilies}
								rowKey={(o) => o.type + '|' + o.id + '|' + o.referencedBy}
								tableClass="compact"
								onExport={() =>
									openExport(
										'Orphaned Family References',
										'data-quality-orphaned-families',
										['Type', 'Family ID', 'Referenced By'],
										orphanedFamilies.map((o) => [o.type, o.id, o.referencedBy]),
									)}
							/>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'pressure-non-monotonic'}
					<section class="section">
						<SectionHeader title="Non-Monotonic Sessions" count={nonMonotonicSessions.length} />
						<p class="description">
							Sessions whose records go backwards on either axis as the array progresses — logical
							pressure (y) drops below an earlier sample, or physical force (x) drops below an
							earlier sample. Both indicate out-of-order records: the chart draws a backtracking
							line and interpolation can return wrong results.
						</p>
						{#if nonMonotonicSessions.length === 0}
							<StatusMessage variant="good"
								>All sessions are monotonically non-decreasing on both axes.</StatusMessage
							>
						{:else}
							<SortableTable
								columns={nonMonotonicCols}
								rows={nonMonotonicSessions}
								rowKey={(n) => n.session._id}
								tableClass="compact"
								onExport={() =>
									openExport(
										'Non-Monotonic Pressure Sessions',
										'data-quality-pressure-non-monotonic',
										['Brand', 'Pen', 'Inventory ID', 'Date', 'Axis', 'Drop Index', 'From', 'To'],
										nonMonotonicSessions.map((n) => [
											n.session.Brand,
											n.session.PenEntityId,
											n.session.InventoryId,
											n.session.Date,
											n.firstDrop.axis,
											n.firstDrop.index,
											n.firstDrop.from.toFixed(2),
											n.firstDrop.to.toFixed(2),
										]),
									)}
							/>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'pressure-missing-low-end'}
					<section class="section">
						<SectionHeader title="Missing Low-End" count={missingLowEndPens.length} />
						<p class="description">
							Pens whose lowest measured logical pressure across all sessions is still above 0.5%.
							The Piaf estimate may be unreliable for these.
						</p>
						{#if missingLowEndPens.length === 0}
							<StatusMessage variant="good"
								>All pens have low-end measurements covering the activation point.</StatusMessage
							>
						{:else}
							<SortableTable
								columns={missingLowEndCols}
								rows={missingLowEndPens}
								rowKey={(p) => p.inventoryId}
								tableClass="compact"
								onExport={() =>
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
									)}
							/>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'pressure-single-session'}
					<section class="section">
						<SectionHeader title="Single-Session Pens" count={singleSessionPens.length} />
						<p class="description">
							Pens with only one recorded session. A second session would confirm consistency.
						</p>
						{#if singleSessionPens.length === 0}
							<StatusMessage variant="good"
								>Every pen has at least two sessions on record.</StatusMessage
							>
						{:else}
							<SortableTable
								columns={singleSessionCols}
								rows={singleSessionPens}
								rowKey={(p) => p.inventoryId}
								tableClass="compact"
								onExport={() =>
									openExport(
										'Pens with Only One Pressure-Response Session',
										'data-quality-pressure-single-session',
										['Brand', 'Pen', 'Inventory ID', 'Date'],
										singleSessionPens.map((p) => [p.brand, p.penEntityId, p.inventoryId, p.date]),
									)}
							/>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'iaf-not-measured'}
					<section class="section">
						<SectionHeader
							title="IAF — Estimated, Not Measured"
							count={iafEstimatedNoMeasurement.length}
						/>
						<p class="description">
							Pen units with an estimated IAF (from pressure-response sessions) but no direct IAF
							measurement yet — prime candidates for measuring directly.
						</p>
						{#if iafEstimatedNoMeasurement.length === 0}
							<StatusMessage variant="good"
								>Every unit with an IAF estimate also has a direct measurement.</StatusMessage
							>
						{:else}
							<SortableTable
								columns={iafNotMeasuredCols}
								rows={iafEstimatedNoMeasurement}
								rowKey={(p) => p.inventoryId}
								tableClass="compact"
								onExport={() =>
									openExport(
										'Pen Units with an Estimated IAF but No Direct Measurement',
										'data-quality-iaf-not-measured',
										['Brand', 'Pen', 'Inventory ID', 'Estimated IAF (gf)'],
										iafEstimatedNoMeasurement.map((p) => [
											p.brand,
											p.penName,
											p.inventoryId,
											p.estimate.toFixed(1),
										]),
									)}
							/>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'tablet-release-dates'}
					<section class="section">
						<SectionHeader
							title="Tablets — No Exact Release Date"
							count={filteredReleaseDateTablets.length}
						/>
						<p class="description">
							Tablets whose <code>Model.ReleaseDate</code> isn't an exact
							<code>YYYY-MM-DD</code> — broken out by what's missing: no date, year only, or month only.
						</p>
						{#if tabletsMissingExactReleaseDate.length === 0}
							<StatusMessage variant="good"
								>Every tablet has an exact (YYYY-MM-DD) release date.</StatusMessage
							>
						{:else}
							<div class="dq-filters">
								<label class="dq-filter">
									Brand:
									<select bind:value={releaseDateBrand}>
										<option value="">All ({tabletsMissingExactReleaseDate.length})</option>
										{#each releaseDateBrands as b (b)}
											<option value={b}>{b}</option>
										{/each}
									</select>
								</label>
								<label class="dq-filter">
									Missing:
									<select bind:value={releaseDateMissing}>
										<option value="">All</option>
										{#each releaseDateMissingKinds as m (m)}
											<option value={m}>{m}</option>
										{/each}
									</select>
								</label>
							</div>
							<SortableTable
								columns={releaseDateCols}
								rows={filteredReleaseDateTablets}
								rowKey={(t) => t.entityId}
								tableClass="compact"
								onExport={() =>
									openExport(
										'Tablets Without an Exact Release Date',
										'data-quality-tablet-release-dates',
										['Brand', 'Model ID', 'Name', 'Current ReleaseDate', 'Missing'],
										filteredReleaseDateTablets.map((t) => [
											t.brand,
											t.id,
											t.name,
											t.releaseDate,
											t.missing,
										]),
									)}
							/>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'pressure-stale'}
					<section class="section">
						<SectionHeader title="Stale Measurements" count={staleMeasurements.length} />
						<p class="description">
							Pens whose most recent session was more than a year ago. Drift over time may
							invalidate older curves.
						</p>
						{#if staleMeasurements.length === 0}
							<StatusMessage variant="good">Every pen has a session in the last year.</StatusMessage
							>
						{:else}
							<SortableTable
								columns={staleCols}
								rows={staleMeasurements}
								rowKey={(p) => p.inventoryId}
								tableClass="compact"
								onExport={() =>
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
									)}
							/>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'pressure-remeasure'}
					<section class="section">
						<SectionHeader
							title="Recommended for Re-measurement"
							count={remeasureRecommendations.length}
						/>
						<p class="description">
							Union of the missing-low-end, single-session, and stale checks. Pens with the most
							reasons appear first.
						</p>
						{#if remeasureRecommendations.length === 0}
							<StatusMessage variant="good">No pens need re-measurement.</StatusMessage>
						{:else}
							<SortableTable
								columns={remeasureCols}
								rows={remeasureRecommendations}
								rowKey={(p) => p.inventoryId}
								tableClass="compact"
								onExport={() =>
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
									)}
							/>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'completion-tablet'}
					<section class="section">
						<CompletionSection
							title="Tablet Field Completion"
							exportTitle="Tablet Field Completion"
							filename="data-quality-tablet-completion"
							description={`How many of the ${ds.tablets.length} tablets have each field populated.`}
							stats={tabletCompletion}
							filterBase="/"
							{openExport}
						/>
					</section>
				{/if}

				{#if activeSection === 'completion-display'}
					<section class="section">
						<CompletionSection
							title="Display Field Completion"
							exportTitle="Display Field Completion"
							filename="data-quality-display-completion"
							description={`How many of the ${displayTabletCount} pen displays and standalone tablets have each display field populated.`}
							stats={displayCompletion}
							filterBase="/"
							{openExport}
						/>
					</section>
				{/if}

				{#if activeSection === 'completion-pen'}
					<section class="section">
						<CompletionSection
							title="Pen Field Completion"
							exportTitle="Pen Field Completion"
							filename="data-quality-pen-completion"
							description={`How many of the ${ds.pens.length} pens have each optional field populated.`}
							stats={penCompletion}
							filterBase="/pens"
							{openExport}
						/>
					</section>
				{/if}

				{#if activeSection === 'completion-driver'}
					<section class="section">
						<CompletionSection
							title="Driver Field Completion"
							exportTitle="Driver Field Completion"
							filename="data-quality-driver-completion"
							description={`How many of the ${ds.drivers.length} drivers have each optional field populated.`}
							stats={driverCompletion}
							filterBase="/drivers"
							{openExport}
						/>
					</section>
				{/if}

				{#if activeSection === 'completion-pressure'}
					<section class="section">
						<CompletionSection
							title="Pressure Response Field Completion"
							exportTitle="Pressure Response Field Completion"
							filename="data-quality-pressure-response-completion"
							description={`How many of the ${ds.pressureResponse.length} sessions have each optional field populated.`}
							stats={pressureResponseCompletion}
							filterBase="/pressure-response"
							{openExport}
						/>
					</section>
				{/if}

				{#if activeSection === 'completion-inv-pen'}
					<section class="section">
						<CompletionSection
							title="Inventory Pen Field Completion"
							exportTitle="Inventory Pen Field Completion"
							filename="data-quality-inventory-pen-completion"
							description={`How many of the ${inventoryPenCount} inventory pens have each optional field populated.`}
							stats={inventoryPenCompletion}
							{openExport}
						/>
					</section>
				{/if}

				{#if activeSection === 'completion-inv-tablet'}
					<section class="section">
						<CompletionSection
							title="Inventory Tablet Field Completion"
							exportTitle="Inventory Tablet Field Completion"
							filename="data-quality-inventory-tablet-completion"
							description={`How many of the ${inventoryTabletCount} inventory tablets have each optional field populated.`}
							stats={inventoryTabletCompletion}
							{openExport}
						/>
					</section>
				{/if}
			{/snippet}
		</SectionedPage>

		{#if exportHost.config}
			<ExportDialog
				entityType="data-quality"
				title={exportHost.config.title}
				filename={exportHost.config.filename}
				headers={exportHost.config.headers}
				rows={exportHost.config.rows}
				onclose={exportHost.close}
			/>
		{/if}
	{/if}
</ChromeLayout>

<style>
	h1 {
		margin-bottom: 16px;
	}

	.section {
		margin-bottom: 32px;
	}

	.description {
		font-size: 13px;
		color: #888;
		margin-bottom: 8px;
	}

	.dq-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		margin-bottom: 8px;
	}

	.dq-filter {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--text-muted);
	}

	.dq-filter select {
		padding: 4px 8px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
	}
</style>
