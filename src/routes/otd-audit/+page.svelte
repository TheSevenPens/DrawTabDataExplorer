<script lang="ts">
	// TEMPORARY OTD→entity audit-curation page. Same table + filters as the
	// reference "OTD To Tablet Entity" section, but each row's verdict is
	// editable. Edits are kept in localStorage (so you don't lose work) and
	// exported as the exact data/otd/otd-entity-audit.json shape to hand back.
	// Delete the whole src/routes/otd-audit/ folder when done.
	import Button from '$lib/components/Button.svelte';
	import EntityLink from '$lib/components/EntityLink.svelte';
	import type { OtdEntityMapRow, AuditValue } from '$lib/otd-entity-match.js';

	let { data } = $props();
	const rows = $derived(data.otdEntityMatches.filter((m) => m.entityId));

	const DRAFT_KEY = 'otd-audit-draft';
	const keyOf = (m: OtdEntityMapRow) => `${m.otdFile}|${m.entityId}`;

	// Verdict map (only non-"unreviewed" stored), seeded from the committed
	// overlay (row.audit) then overlaid with the local draft.
	function committedSeed(): Record<string, AuditValue> {
		const base: Record<string, AuditValue> = {};
		for (const m of data.otdEntityMatches)
			if (m.entityId && m.audit !== 'unreviewed') base[keyOf(m)] = m.audit;
		return base;
	}
	function initialEdits(): Record<string, AuditValue> {
		const base = committedSeed();
		try {
			Object.assign(base, JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'));
		} catch {
			/* no draft */
		}
		return base;
	}
	let edits = $state<Record<string, AuditValue>>(initialEdits());

	function persist() {
		try {
			localStorage.setItem(DRAFT_KEY, JSON.stringify(edits));
		} catch {
			/* ignore */
		}
	}
	const current = (m: OtdEntityMapRow): AuditValue => edits[keyOf(m)] ?? 'unreviewed';
	function setAudit(m: OtdEntityMapRow, val: AuditValue) {
		const k = keyOf(m);
		if (val === 'unreviewed') {
			const { [k]: _drop, ...rest } = edits;
			edits = rest;
		} else {
			edits = { ...edits, [k]: val };
		}
		persist();
	}

	// --- Filters (identical to the reference section; audit uses the live edit) ---
	let search = $state('');
	let vendor = $state('');
	let confidence = $state('');
	let basis = $state('');
	let auditF = $state('');
	const vendors = $derived([...new Set(rows.map((m) => m.otdVendor))].sort());
	const bases = $derived([...new Set(rows.map((m) => m.basis))]);
	const filtered = $derived(
		rows.filter(
			(m) =>
				(vendor === '' || m.otdVendor === vendor) &&
				(confidence === '' || m.confidence === confidence) &&
				(basis === '' || m.basis === basis) &&
				(auditF === '' || current(m) === auditF) &&
				(search === '' ||
					`${m.otdName} ${m.fullName ?? ''}`.toLowerCase().includes(search.toLowerCase())),
		),
	);

	const tally = $derived({
		approved: rows.filter((m) => current(m) === 'approved').length,
		rejected: rows.filter((m) => current(m) === 'rejected').length,
		unclear: rows.filter((m) => current(m) === 'unclear').length,
		unreviewed: rows.filter((m) => current(m) === 'unreviewed').length,
	});

	// Bulk-apply to the currently filtered rows.
	function bulk(val: AuditValue) {
		const next = { ...edits };
		for (const m of filtered) {
			const k = keyOf(m);
			if (val === 'unreviewed') delete next[k];
			else next[k] = val;
		}
		edits = next;
		persist();
	}
	function resetToCommitted() {
		edits = committedSeed();
		persist();
	}

	const exportJson = $derived(JSON.stringify({ audits: edits }, null, 2) + '\n');
	let copied = $state(false);
	async function copy() {
		try {
			await navigator.clipboard.writeText(exportJson);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* clipboard blocked */
		}
	}
	function download() {
		const blob = new Blob([exportJson], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'otd-entity-audit.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
	const area = (w: number | null, h: number | null) =>
		round1(w) != null && round1(h) != null ? `${round1(w)} × ${round1(h)}` : '—';

	// Diagonal difference (mm) between the OTD and our active areas — a single
	// scalar for "how far apart are these two sizes". Big values flag a shaky
	// (or wrong) correlation.
	function diagDiff(m: OtdEntityMapRow): number | null {
		if (
			m.otdWidthMM == null ||
			m.otdHeightMM == null ||
			m.ourWidthMM == null ||
			m.ourHeightMM == null
		)
			return null;
		const otd = Math.hypot(m.otdWidthMM, m.otdHeightMM);
		const our = Math.hypot(m.ourWidthMM, m.ourHeightMM);
		return Math.round(Math.abs(otd - our) * 10) / 10;
	}

	const VERDICTS: AuditValue[] = ['unreviewed', 'approved', 'rejected', 'unclear'];
</script>

<svelte:head><title>OTD Audit (temporary)</title></svelte:head>

<div class="page">
	<div class="head">
		<h1>OTD → Tablet Entity — Audit</h1>
		<a href="/reference">← back to reference</a>
	</div>
	<p class="meta">
		<strong>Temporary curation page.</strong> Mark each correlation's verdict below — your work is
		saved in this browser (localStorage). When done, <em>Copy</em> or <em>Download</em> the JSON and
		hand it back; it's the exact <code>data/otd/otd-entity-audit.json</code> shape.
	</p>
	<p class="meta">
		{rows.length} correlations · <strong>{tally.approved}</strong> approved ·
		<strong>{tally.rejected}</strong>
		rejected · <strong>{tally.unclear}</strong> unclear · <strong>{tally.unreviewed}</strong> unreviewed
	</p>

	<div class="ref-filters">
		<input type="search" placeholder="Search name…" bind:value={search} />
		<select bind:value={vendor} aria-label="Filter by vendor">
			<option value="">All vendors</option>
			{#each vendors as v (v)}<option value={v}>{v}</option>{/each}
		</select>
		<select bind:value={confidence} aria-label="Filter by confidence">
			<option value="">All confidence</option>
			<option value="high">high</option>
			<option value="medium">medium</option>
		</select>
		<select bind:value={basis} aria-label="Filter by basis">
			<option value="">All bases</option>
			{#each bases as b (b)}<option value={b}>{b}</option>{/each}
		</select>
		<select bind:value={auditF} aria-label="Filter by verdict">
			<option value="">All verdicts</option>
			{#each VERDICTS as v (v)}<option value={v}>{v}</option>{/each}
		</select>
		<span class="filter-count">{filtered.length} of {rows.length}</span>
	</div>

	<div class="bulk">
		<span class="bulk-label">Set all {filtered.length} shown to:</span>
		<Button size="sm" onclick={() => bulk('approved')}>approve</Button>
		<Button size="sm" onclick={() => bulk('rejected')}>reject</Button>
		<Button size="sm" onclick={() => bulk('unclear')}>unclear</Button>
		<Button size="sm" variant="subtle" onclick={() => bulk('unreviewed')}>clear</Button>
	</div>

	<div class="table-wrap">
		<table class="ref-table">
			<thead>
				<tr>
					<th class="wrap-cell">OTD Name</th>
					<th>Tablet Entity</th>
					<th class="wrap-cell">Tablet Full Name</th>
					<th>Confidence</th>
					<th>Basis</th>
					<th>Verdict</th>
					<th>OTD Area (mm)</th>
					<th>Our Area (mm)</th>
					<th class="num">Diag Δ (mm)</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as m (m.otdFile)}
					{@const dd = diagDiff(m)}
					<tr>
						<td class="wrap-cell">{m.otdName}</td>
						<td><EntityLink entityId={m.entityId!}>{m.modelId}</EntityLink></td>
						<td class="wrap-cell">{m.fullName ?? '—'}</td>
						<td><span class="badge conf-{m.confidence}">{m.confidence}</span></td>
						<td class="dim mono">{m.basis}</td>
						<td>
							<select
								class="verdict v-{current(m)}"
								value={current(m)}
								onchange={(e) => setAudit(m, e.currentTarget.value as AuditValue)}
								aria-label="Verdict for {m.otdName}"
							>
								{#each VERDICTS as v (v)}<option value={v}>{v}</option>{/each}
							</select>
						</td>
						<td class="mono">{area(m.otdWidthMM, m.otdHeightMM)}</td>
						<td class="mono">{area(m.ourWidthMM, m.ourHeightMM)}</td>
						<td class="num mono" class:diff-large={dd != null && dd >= 5}>{dd ?? '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<section class="export">
		<div class="export-head">
			<h2>Export ({Object.keys(edits).length} verdicts)</h2>
			<div class="export-actions">
				<Button variant="primary" size="sm" onclick={copy}
					>{copied ? 'Copied!' : 'Copy JSON'}</Button
				>
				<Button size="sm" onclick={download}>Download</Button>
				<Button variant="subtle" size="sm" onclick={resetToCommitted}>Reset draft</Button>
			</div>
		</div>
		<textarea class="export-json" readonly rows="10" value={exportJson}></textarea>
	</section>
</div>

<style>
	.page {
		max-width: 1200px;
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 8px;
	}
	h1 {
		font-size: var(--type-title);
		font-weight: var(--weight-display);
		letter-spacing: var(--track-tight);
		color: var(--text);
	}
	.head a {
		color: var(--link);
		font-size: var(--type-caption);
	}
	.meta {
		margin: 0 0 6px;
		color: var(--text-muted);
		font-size: var(--type-caption);
	}
	.meta strong {
		color: var(--text);
		font-weight: 600;
	}
	.meta code {
		background: var(--bg-card);
		padding: 1px 5px;
		border-radius: var(--radius);
	}
	.bulk {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin: 4px 0 8px;
	}
	.bulk-label {
		font-size: var(--type-caption);
		color: var(--text-muted);
		margin-right: 2px;
	}
	.table-wrap {
		overflow-x: auto;
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
		color: var(--text-muted);
	}
	.num {
		text-align: right;
	}
	/* Let the two long name columns wrap so the whole table fits the page
	   width — otherwise the right-hand columns sit off-screen behind a
	   horizontal scrollbar that's stranded below 160+ rows. */
	.wrap-cell {
		white-space: normal;
		min-width: 130px;
	}
	/* A large diagonal gap flags a shaky size correlation. */
	.diff-large {
		color: var(--warning);
	}
	.badge {
		display: inline-block;
		padding: 1px 6px;
		font-size: var(--type-micro);
		letter-spacing: var(--track-wide);
		text-transform: uppercase;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text-muted);
	}
	.badge.conf-high {
		border-color: var(--accent);
		color: var(--accent);
	}
	.verdict {
		padding: 2px 6px;
		font-size: var(--type-caption);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		color: var(--text);
	}
	.verdict.v-approved {
		border-color: var(--good);
		color: var(--good);
	}
	.verdict.v-rejected {
		border-color: var(--danger);
		color: var(--danger);
	}
	.verdict.v-unclear {
		border-color: var(--warning);
		color: var(--warning);
	}
	.export {
		margin-top: 20px;
		border-top: 1px solid var(--border);
		padding-top: 12px;
	}
	.export-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 6px;
	}
	.export h2 {
		font-size: var(--type-subhead);
		font-weight: 600;
		color: var(--text);
	}
	.export-actions {
		display: flex;
		gap: 6px;
	}
	.export-json {
		width: 100%;
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
		font-size: var(--type-caption);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		color: var(--text);
		padding: 8px;
		resize: vertical;
	}
</style>
