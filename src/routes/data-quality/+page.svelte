<script lang="ts">
	import { onMount } from 'svelte';
	import { loadAllFromURL, type DrawTabDataAll } from '$data/lib/drawtab-all.js';
	import Nav from '$lib/components/Nav.svelte';

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
	let penCompletion: CompletionStat[] = $state([]);
	let orphanedCompat: { type: string; id: string }[] = $state([]);
	let entityCounts: { entity: string; count: number }[] = $state([]);

	function checkRequired(records: Record<string, any>[], entity: string, requiredFields: string[]): Issue[] {
		const found: Issue[] = [];
		for (const rec of records) {
			const eid = rec.EntityId ?? rec._id ?? 'UNKNOWN';
			for (const field of requiredFields) {
				const val = rec[field];
				if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
					found.push({ entity, entityId: eid, field, issue: 'missing or empty' });
				}
			}
		}
		return found;
	}

	function checkWhitespace(records: Record<string, any>[], entity: string): Issue[] {
		const found: Issue[] = [];
		for (const rec of records) {
			const eid = rec.EntityId ?? rec._id ?? 'UNKNOWN';
			for (const [field, value] of Object.entries(rec)) {
				if (typeof value === 'string' && value !== value.trim()) {
					found.push({ entity, entityId: eid, field, issue: 'leading/trailing whitespace', value });
				}
			}
		}
		return found;
	}

	function computeCompletion(records: Record<string, any>[], fields: string[]): CompletionStat[] {
		const total = records.length;
		return fields.map(field => {
			const populated = records.filter(r => {
				const v = r[field];
				return v !== undefined && v !== null && v !== '';
			}).length;
			return { field, populated, total, percent: total > 0 ? ((populated / total) * 100).toFixed(1) : '0' };
		}).sort((a, b) => parseFloat(a.percent) - parseFloat(b.percent));
	}

	function findOrphanedCompat(ds: DrawTabDataAll): { type: string; id: string }[] {
		const tabletIds = new Set(ds.tablets.map(t => t.ModelId));
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

	onMount(async () => {
		ds = await loadAllFromURL('');
		const allIssues: Issue[] = [];

		// Required field checks
		allIssues.push(...checkRequired(ds.tablets, 'Tablet', ['EntityId', 'Brand', 'ModelId', 'ModelName', 'ModelType']));
		allIssues.push(...checkRequired(ds.pens, 'Pen', ['EntityId', 'Brand', 'PenId', 'PenName']));
		allIssues.push(...checkRequired(ds.drivers, 'Driver', ['EntityId', 'Brand', 'DriverVersion', 'DriverName', 'OSFamily', 'ReleaseDate']));
		allIssues.push(...checkRequired(ds.penFamilies, 'PenFamily', ['EntityId', 'Brand', 'FamilyId', 'FamilyName']));
		allIssues.push(...checkRequired(ds.tabletFamilies, 'TabletFamily', ['EntityId', 'Brand', 'FamilyId', 'FamilyName']));
		allIssues.push(...checkRequired(ds.penCompat, 'PenCompat', ['Brand', 'TabletId', 'PenId']));

		// Whitespace checks
		allIssues.push(...checkWhitespace(ds.tablets, 'Tablet'));
		allIssues.push(...checkWhitespace(ds.pens, 'Pen'));
		allIssues.push(...checkWhitespace(ds.drivers, 'Driver'));

		issues = allIssues;

		// Completion stats
		tabletCompletion = computeCompletion(ds.tablets, [
			'ModelLaunchYear', 'ModelAudience', 'ModelFamily', 'ModelStatus', 'ModelIncludedPen',
			'DigitizerType', 'DigitizerPressureLevels', 'DigitizerDimensions', 'DigitizerDensity',
			'DigitizerReportRate', 'DigitizerTilt', 'DigitizerAccuracyCenter', 'DigitizerAccuracyCorner',
			'DigitizerMaxHover', 'DigitizerSupportsTouch',
			'DisplayResolution', 'DisplayPanelTech', 'DisplayBrightness', 'DisplayContrast',
			'DisplayColorBitDepth', 'DisplayColorGamuts', 'DisplayLamination',
			'PhysicalDimensions', 'PhysicalWeight', 'ModelProductLink',
		]);

		penCompletion = computeCompletion(ds.pens, ['PenName', 'PenFamily', 'PenYear']);

		// Orphaned compat references
		orphanedCompat = findOrphanedCompat(ds);

		// Entity counts
		entityCounts = [
			{ entity: 'Tablets', count: ds.tablets.length },
			{ entity: 'Pens', count: ds.pens.length },
			{ entity: 'Pen Compat Rows', count: ds.penCompat.length },
			{ entity: 'Pen Families', count: ds.penFamilies.length },
			{ entity: 'Tablet Families', count: ds.tabletFamilies.length },
			{ entity: 'Drivers', count: ds.drivers.length },
		];
	});
</script>

<Nav />
<h1>Data Quality</h1>

{#if !ds}
	<p>Loading...</p>
{:else}

	<!-- Entity Counts -->
	<section class="section">
		<h2>Entity Counts</h2>
		<table class="compact">
			<thead><tr><th>Entity</th><th>Count</th></tr></thead>
			<tbody>
				{#each entityCounts as row}
					<tr><td>{row.entity}</td><td>{row.count}</td></tr>
				{/each}
			</tbody>
		</table>
	</section>

	<!-- Issues -->
	<section class="section">
		<h2>Issues ({issues.length})</h2>
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

	<!-- Orphaned Compat References -->
	<section class="section">
		<h2>Orphaned Compat References ({orphanedCompat.length})</h2>
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

	<!-- Tablet Field Completion -->
	<section class="section">
		<h2>Tablet Field Completion</h2>
		<p class="description">How many of the {ds.tablets.length} tablets have each optional field populated.</p>
		<table class="compact">
			<thead><tr><th>Field</th><th>Populated</th><th>%</th><th></th></tr></thead>
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
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<!-- Pen Field Completion -->
	<section class="section">
		<h2>Pen Field Completion</h2>
		<p class="description">How many of the {ds.pens.length} pens have each optional field populated.</p>
		<table class="compact">
			<thead><tr><th>Field</th><th>Populated</th><th>%</th><th></th></tr></thead>
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
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

{/if}

<style>
	h1 { margin-bottom: 16px; }

	.section {
		margin-bottom: 32px;
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
</style>
