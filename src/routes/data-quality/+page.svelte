<script lang="ts">
	import { resolve } from '$app/paths';
	import { sessionEntityId } from '$data/lib/pressure/session-id.js';
	import ChromeLayout from '$lib/components/ChromeLayout.svelte';
	import { dataSubNavTabs } from '$lib/nav/subnav-tabs.js';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import SectionedPage, { type Section } from '$lib/components/SectionedPage.svelte';
	import { analyzeData } from '$lib/data-quality/analysis.js';
	import SectionHeader from '$lib/data-quality/SectionHeader.svelte';
	import CompletionSection from '$lib/data-quality/CompletionSection.svelte';

	const dataTabs = dataSubNavTabs();

	let { data } = $props();

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
		<p>Loading...</p>
	{:else}
		<SectionedPage sections={sectionDefs} defaultSection="entity-counts">
			{#snippet content(activeSection: string)}
				{#if activeSection === 'entity-counts'}
					<section class="section">
						<SectionHeader
							title="Entity Counts"
							disabled={entityCounts.length === 0}
							onExport={() =>
								openExport(
									'Entity Counts',
									'data-quality-entity-counts',
									['Entity', 'Count'],
									entityCounts.map((r) => [r.entity, r.count]),
								)}
						/>
						<table class="compact">
							<thead><tr><th>Entity</th><th>Count</th></tr></thead>
							<tbody>
								{#each entityCounts as row (row.entity)}
									<tr><td>{row.entity}</td><td>{row.count}</td></tr>
								{/each}
							</tbody>
						</table>
					</section>
				{/if}

				{#if activeSection === 'issues'}
					<section class="section">
						<SectionHeader
							title="Issues"
							count={issues.length}
							disabled={issues.length === 0}
							onExport={() =>
								openExport(
									'Issues',
									'data-quality-issues',
									['Entity', 'Entity ID', 'Field', 'Issue', 'Value'],
									issues.map((i) => [i.entity, i.entityId, i.field, i.issue, i.value ?? '']),
								)}
						/>
						{#if issues.length === 0}
							<p class="good">No issues found.</p>
						{:else}
							<table>
								<thead>
									<tr
										><th>Entity</th><th>Entity ID</th><th>Field</th><th>Issue</th><th>Value</th></tr
									>
								</thead>
								<tbody>
									{#each issues as issue, i (i)}
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
						<SectionHeader
							title="Orphaned Compat References"
							count={orphanedCompat.length}
							disabled={orphanedCompat.length === 0}
							onExport={() =>
								openExport(
									'Orphaned Compat References',
									'data-quality-orphaned-compat',
									['Type', 'ID'],
									orphanedCompat.map((o) => [o.type, o.id]),
								)}
						/>
						<p class="description">
							IDs in pen-compat that don't match any record in the referenced entity.
						</p>
						{#if orphanedCompat.length === 0}
							<p class="good">No orphaned references.</p>
						{:else}
							<table class="compact">
								<thead><tr><th>Type</th><th>ID</th></tr></thead>
								<tbody>
									{#each orphanedCompat as orphan (orphan.type + '|' + orphan.id)}
										<tr><td>{orphan.type}</td><td class="mono">{orphan.id}</td></tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'wacom-no-compat'}
					<section class="section">
						<SectionHeader
							title="Wacom Tablets with No Pen Compatibility Data"
							count={tabletsNoCompat.length}
							disabled={tabletsNoCompat.length === 0}
							onExport={() =>
								openExport(
									'Wacom Tablets with No Pen Compatibility Data',
									'data-quality-wacom-no-compat',
									['Model ID', 'Name'],
									tabletsNoCompat.map((t) => [t.id, t.name]),
								)}
						/>
						<p class="description">Wacom tablets that have no entries in pen-compat.</p>
						{#if tabletsNoCompat.length === 0}
							<p class="good">All Wacom tablets have compatibility data.</p>
						{:else}
							<table class="compact">
								<thead><tr><th>Model ID</th><th>Name</th></tr></thead>
								<tbody>
									{#each tabletsNoCompat as t (t.id)}
										<tr><td class="mono">{t.id}</td><td>{t.name}</td></tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'pens-no-compat'}
					<section class="section">
						<SectionHeader
							title="Pens with No Tablet Compatibility Data"
							count={pensNoCompat.length}
							disabled={pensNoCompat.length === 0}
							onExport={() =>
								openExport(
									'Pens with No Tablet Compatibility Data',
									'data-quality-pens-no-compat',
									['Pen ID', 'Name'],
									pensNoCompat.map((p) => [p.id, p.name]),
								)}
						/>
						<p class="description">Pens that have no entries in pen-compat.</p>
						{#if pensNoCompat.length === 0}
							<p class="good">All pens have compatibility data.</p>
						{:else}
							<table class="compact">
								<thead><tr><th>Pen ID</th><th>Name</th></tr></thead>
								<tbody>
									{#each pensNoCompat as p (p.id)}
										<tr><td class="mono">{p.id}</td><td>{p.name}</td></tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'included-pen-no-compat'}
					<section class="section">
						<SectionHeader
							title="Included Pens Missing Compatibility Info"
							count={includedPenMissingCompat.length}
							disabled={includedPenMissingCompat.length === 0}
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
						<p class="description">
							Tablets whose <code>Model.IncludedPen</code> references a pen, but no pen-compat row links
							the tablet and pen. These should always be present — an included pen is by definition compatible
							with its tablet.
						</p>
						{#if includedPenMissingCompat.length === 0}
							<p class="good">All included pens have a matching pen-compat row.</p>
						{:else}
							<table class="compact">
								<thead>
									<tr>
										<th>Tablet ID</th>
										<th>Tablet Name</th>
										<th>Pen EntityId</th>
										<th>Pen Name</th>
									</tr>
								</thead>
								<tbody>
									{#each includedPenMissingCompat as r (r.tabletId + '|' + r.penEntityId)}
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
						<SectionHeader
							title="Orphaned Family References"
							count={orphanedFamilies.length}
							disabled={orphanedFamilies.length === 0}
							onExport={() =>
								openExport(
									'Orphaned Family References',
									'data-quality-orphaned-families',
									['Type', 'Family ID', 'Referenced By'],
									orphanedFamilies.map((o) => [o.type, o.id, o.referencedBy]),
								)}
						/>
						<p class="description">
							Family IDs referenced by pens or tablets that don't exist in the family entities.
						</p>
						{#if orphanedFamilies.length === 0}
							<p class="good">No orphaned family references.</p>
						{:else}
							<table class="compact">
								<thead><tr><th>Type</th><th>Family ID</th><th>Referenced By</th></tr></thead>
								<tbody>
									{#each orphanedFamilies as o (o.type + '|' + o.id + '|' + o.referencedBy)}
										<tr>
											<td>{o.type}</td>
											<td class="mono">{o.id}</td>
											<td class="mono">{o.referencedBy}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'pressure-non-monotonic'}
					<section class="section">
						<SectionHeader
							title="Non-Monotonic Sessions"
							count={nonMonotonicSessions.length}
							disabled={nonMonotonicSessions.length === 0}
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
						<p class="description">
							Sessions whose records go backwards on either axis as the array progresses — logical
							pressure (y) drops below an earlier sample, or physical force (x) drops below an
							earlier sample. Both indicate out-of-order records: the chart draws a backtracking
							line and interpolation can return wrong results.
						</p>
						{#if nonMonotonicSessions.length === 0}
							<p class="good">All sessions are monotonically non-decreasing on both axes.</p>
						{:else}
							<table class="compact">
								<thead>
									<tr>
										<th>Brand</th>
										<th>Pen</th>
										<th>Inventory ID</th>
										<th>Date</th>
										<th>Axis</th>
										<th>Drop @</th>
										<th>From → To</th>
									</tr>
								</thead>
								<tbody>
									{#each nonMonotonicSessions as n (n.session._id)}
										{@const unit = n.firstDrop.axis === 'logical' ? '%' : ' gf'}
										<tr>
											<td>{n.session.Brand}</td>
											<td class="mono">
												<a
													href={resolve('/entity/[entityId]', { entityId: n.session.PenEntityId })}
												>
													{n.session.PenEntityId}
												</a>
											</td>
											<td class="mono">
												<a
													href={resolve('/entity/[entityId]', {
														entityId: sessionEntityId(n.session),
													})}
												>
													{n.session.InventoryId}
												</a>
											</td>
											<td class="mono">{n.session.Date}</td>
											<td>{n.firstDrop.axis}</td>
											<td class="num">{n.firstDrop.index}</td>
											<td class="num mono">
												{n.firstDrop.from.toFixed(2)} → {n.firstDrop.to.toFixed(2)}{unit}
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
						<SectionHeader
							title="Missing Low-End"
							count={missingLowEndPens.length}
							disabled={missingLowEndPens.length === 0}
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
						<p class="description">
							Pens whose lowest measured logical pressure across all sessions is still above 0.5%.
							The Piaf estimate may be unreliable for these.
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
												<a href={resolve('/entity/[entityId]', { entityId: p.penEntityId })}>
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
						<SectionHeader
							title="Single-Session Pens"
							count={singleSessionPens.length}
							disabled={singleSessionPens.length === 0}
							onExport={() =>
								openExport(
									'Pens with Only One Pressure-Response Session',
									'data-quality-pressure-single-session',
									['Brand', 'Pen', 'Inventory ID', 'Date'],
									singleSessionPens.map((p) => [p.brand, p.penEntityId, p.inventoryId, p.date]),
								)}
						/>
						<p class="description">
							Pens with only one recorded session. A second session would confirm consistency.
						</p>
						{#if singleSessionPens.length === 0}
							<p class="good">Every pen has at least two sessions on record.</p>
						{:else}
							<table class="compact">
								<thead>
									<tr><th>Brand</th><th>Pen</th><th>Inventory ID</th><th>Date</th></tr>
								</thead>
								<tbody>
									{#each singleSessionPens as p (p.inventoryId)}
										<tr>
											<td>{p.brand}</td>
											<td class="mono">
												<a href={resolve('/entity/[entityId]', { entityId: p.penEntityId })}>
													{p.penEntityId}
												</a>
											</td>
											<td class="mono">
												<a href={resolve('/entity/[entityId]', { entityId: p.sessionEntityId })}>
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

				{#if activeSection === 'iaf-not-measured'}
					<section class="section">
						<SectionHeader
							title="IAF — Estimated, Not Measured"
							count={iafEstimatedNoMeasurement.length}
							disabled={iafEstimatedNoMeasurement.length === 0}
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
						<p class="description">
							Pen units with an estimated IAF (from pressure-response sessions) but no direct IAF
							measurement yet — prime candidates for measuring directly.
						</p>
						{#if iafEstimatedNoMeasurement.length === 0}
							<p class="good">Every unit with an IAF estimate also has a direct measurement.</p>
						{:else}
							<table class="compact">
								<thead>
									<tr>
										<th>Brand</th>
										<th>Pen</th>
										<th>Inventory ID</th>
										<th>Estimated IAF (gf)</th>
									</tr>
								</thead>
								<tbody>
									{#each iafEstimatedNoMeasurement as p (p.inventoryId)}
										<tr>
											<td>{p.brand}</td>
											<td>
												<a href={resolve('/entity/[entityId]', { entityId: p.penEntityId })}>
													{p.penName}
												</a>
											</td>
											<td class="mono">{p.inventoryId}</td>
											<td class="mono">{p.estimate.toFixed(1)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</section>
				{/if}

				{#if activeSection === 'pressure-stale'}
					<section class="section">
						<SectionHeader
							title="Stale Measurements"
							count={staleMeasurements.length}
							disabled={staleMeasurements.length === 0}
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
						<p class="description">
							Pens whose most recent session was more than a year ago. Drift over time may
							invalidate older curves.
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
												<a href={resolve('/entity/[entityId]', { entityId: p.penEntityId })}>
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
						<SectionHeader
							title="Recommended for Re-measurement"
							count={remeasureRecommendations.length}
							disabled={remeasureRecommendations.length === 0}
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
						<p class="description">
							Union of the missing-low-end, single-session, and stale checks. Pens with the most
							reasons appear first.
						</p>
						{#if remeasureRecommendations.length === 0}
							<p class="good">No pens need re-measurement.</p>
						{:else}
							<table class="compact">
								<thead>
									<tr><th>Brand</th><th>Pen</th><th>Inventory ID</th><th>Reasons</th></tr>
								</thead>
								<tbody>
									{#each remeasureRecommendations as p (p.inventoryId)}
										<tr>
											<td>{p.brand}</td>
											<td class="mono">
												<a href={resolve('/entity/[entityId]', { entityId: p.penEntityId })}>
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
</style>
