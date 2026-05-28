<!--
  /pressure-backfill — temporary-but-kept dev tool for issue #212.

  Lets the user step through every pressure-response session that's
  missing a (force, 0) and/or (force, 100) endpoint record, drag a
  slider to choose a plausible force value, watch the bracket-midpoint
  P00 / P100 estimate update live in the chart, then save the choice.
  The accumulated edits are emitted as a JSON snippet at the bottom of
  the page that gets fed to scripts/apply-pressure-backfill.mjs to
  surgically splice the new records into the brand pressure-response
  JSON files.

  Not linked from Nav. Reach via /pressure-backfill directly.
-->
<script lang="ts">
	import { brandName } from '$data/lib/drawtab-loader.js';
	import { sessionEntityId } from '$data/lib/pressure/session-id.js';
	import type { PressureRecord } from '$data/lib/pressure/interpolate.js';
	import PressureChart from '$lib/components/PressureChart.svelte';

	let { data } = $props();

	let pens = $derived(data.pens);
	let penNameById = $derived(
		new Map(
			pens.map((p) => [p.EntityId, p.PenName === p.PenId ? p.PenId : `${p.PenName} (${p.PenId})`]),
		),
	);

	// --- Which sessions need backfill? -------------------------------------
	//
	// A session "needs P00 backfill" when no record has y ≤ 0. Adding a
	// (force, 0) at force < records[0].x closes that gap and makes the
	// bracket-midpoint branch fire.
	//
	// A session "needs P100 backfill" when no record has y ≥ 100 — i.e. the
	// curve stops short of saturation. We skip already-saturated sessions
	// (any y ≥ 100) because interpolate.ts already returns the legacy
	// "first saturated x" value for them.
	function needsP00(records: readonly PressureRecord[]): boolean {
		if (records.length === 0) return false;
		return !records.some(([, y]) => y <= 0);
	}
	function needsP100(records: readonly PressureRecord[]): boolean {
		if (records.length === 0) return false;
		return !records.some(([, y]) => y >= 100);
	}

	type SessionView = {
		_id: string;
		entityId: string;
		brand: string;
		brandLabel: string;
		penLabel: string;
		inventoryId: string;
		date: string;
		tabletId: string;
		records: readonly PressureRecord[];
		needsP00: boolean;
		needsP100: boolean;
	};

	let candidates = $derived<SessionView[]>(
		data.sessions
			.filter((s) => needsP00(s.Records) || needsP100(s.Records))
			.map((s) => ({
				_id: s._id,
				entityId: sessionEntityId(s),
				brand: s.Brand,
				brandLabel: brandName(s.Brand),
				penLabel: penNameById.get(s.PenEntityId) ?? s.PenEntityId,
				inventoryId: s.InventoryId,
				date: s.Date,
				tabletId: s.TabletEntityId,
				records: s.Records,
				needsP00: needsP00(s.Records),
				needsP100: needsP100(s.Records),
			}))
			// Stable sort by brand, then inventoryId, then date — predictable
			// click-through order across reloads.
			.sort((a, b) => {
				if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
				if (a.inventoryId !== b.inventoryId) return a.inventoryId.localeCompare(b.inventoryId);
				return a.date.localeCompare(b.date);
			}),
	);

	let totalP00Needed = $derived(candidates.filter((s) => s.needsP00).length);
	let totalP100Needed = $derived(candidates.filter((s) => s.needsP100).length);

	// --- Navigator state ---------------------------------------------------

	let idx = $state(0);
	// Clamp to candidates length whenever data shifts.
	$effect(() => {
		if (idx >= candidates.length && candidates.length > 0) idx = 0;
	});

	let current = $derived<SessionView | null>(candidates[idx] ?? null);

	// Saved edits keyed by session _id. Each entry holds whichever of
	// prependP00Force / appendP100Force the user committed via "Save".
	type SavedEdit = {
		_id: string;
		brand: string;
		inventoryId: string;
		date: string;
		entityId: string;
		penLabel: string;
		prependP00Force?: number;
		appendP100Force?: number;
	};
	let saved = $state<Record<string, SavedEdit>>({});

	function defaultP00Force(records: readonly PressureRecord[]): number {
		// Halfway between 0 and the first measured force is a sensible start.
		// Round to 1 decimal so the slider lands on a clean tick.
		const x = records[0]?.[0] ?? 1;
		return Math.max(0, Math.round((x / 2) * 10) / 10);
	}
	function defaultP100Force(records: readonly PressureRecord[]): number {
		// 50 gf past the last measured force, matching the chart's "max"
		// zoom headroom. Clamp to >= lastForce so the value is monotonic.
		const x = records[records.length - 1]?.[0] ?? 100;
		return Math.round((x + 50) * 10) / 10;
	}

	// Slider values for the currently-displayed session. Reset whenever
	// the navigator moves to a new session: if there's a previously-saved
	// edit for that session, restore its values; otherwise seed with
	// per-session defaults. Single $state vars (rather than a per-session
	// map) keep bind:value reactivity straightforward.
	let p00Force = $state<number>(0);
	let p100Force = $state<number>(0);
	let lastInitId = $state<string | null>(null);

	$effect(() => {
		const s = current;
		if (!s) return;
		if (s._id === lastInitId) return;
		lastInitId = s._id;
		const prev = saved[s._id];
		p00Force = prev?.prependP00Force ?? defaultP00Force(s.records);
		p100Force = prev?.appendP100Force ?? defaultP100Force(s.records);
	});

	// Slider ranges. P00 goes from 0 up to the first measured force; P100
	// goes from the last measured force up to ~2× that value (or +200 gf,
	// whichever is bigger — keeps the range meaningful for weak sessions).
	let p00Range = $derived.by(() => {
		if (!current) return { min: 0, max: 1, step: 0.1 };
		return { min: 0, max: current.records[0]?.[0] ?? 1, step: 0.1 };
	});
	let p100Range = $derived.by(() => {
		if (!current) return { min: 0, max: 1000, step: 0.1 };
		const last = current.records[current.records.length - 1]?.[0] ?? 100;
		const max = Math.max(last * 2, last + 200);
		return { min: last, max, step: 0.1 };
	});

	// Records with the user's proposed extras spliced in. P00 prepends
	// (force, 0); P100 appends (force, 100). Records remain sorted because
	// of the slider ranges above (p00Force ≤ first existing x; p100Force ≥
	// last existing x).
	let augmentedRecords = $derived.by<readonly PressureRecord[]>(() => {
		if (!current) return [];
		const recs: PressureRecord[] = [...current.records];
		if (current.needsP00) recs.unshift([p00Force, 0]);
		if (current.needsP100) recs.push([p100Force, 100]);
		return recs;
	});

	// Bracket-midpoint estimates over the augmented records. Computed
	// locally (not via estimateP00/estimateP100) so the readout reflects
	// only the bracket-midpoint branch — which is the only branch that
	// survives issue #212. With the proposed extras spliced in, those
	// values match exactly what interpolate.ts will return post-removal.
	function bracketP00(records: readonly PressureRecord[]): number | null {
		let aMax: number | null = null;
		let bMin: number | null = null;
		for (const [x, y] of records) {
			if (y <= 0) {
				if (aMax === null || x > aMax) aMax = x;
			} else if (bMin === null || x < bMin) bMin = x;
		}
		if (aMax !== null && bMin !== null && aMax < bMin) return (aMax + bMin) / 2;
		return null;
	}
	function bracketP100(records: readonly PressureRecord[]): number | null {
		let cMax: number | null = null;
		let dMin: number | null = null;
		for (const [x, y] of records) {
			if (y >= 100) {
				if (dMin === null || x < dMin) dMin = x;
			} else if (cMax === null || x > cMax) cMax = x;
		}
		if (cMax !== null && dMin !== null && cMax < dMin) return (cMax + dMin) / 2;
		if (cMax === null && dMin !== null) return dMin;
		return null;
	}

	let estP00 = $derived(bracketP00(augmentedRecords));
	let estP100 = $derived(bracketP100(augmentedRecords));

	// --- Actions -----------------------------------------------------------

	function go(delta: number) {
		const next = idx + delta;
		if (next < 0 || next >= candidates.length) return;
		idx = next;
	}

	function saveCurrent() {
		const s = current;
		if (!s) return;
		const edit: SavedEdit = {
			_id: s._id,
			brand: s.brand,
			inventoryId: s.inventoryId,
			date: s.date,
			entityId: s.entityId,
			penLabel: s.penLabel,
		};
		if (s.needsP00) edit.prependP00Force = p00Force;
		if (s.needsP100) edit.appendP100Force = p100Force;
		saved[s._id] = edit;
	}

	function saveAndNext() {
		saveCurrent();
		if (idx + 1 < candidates.length) go(+1);
	}

	function clearSaved() {
		if (!confirm('Discard all unsaved edits in this session?')) return;
		saved = {};
	}

	function unsaveCurrent() {
		const s = current;
		if (!s) return;
		delete saved[s._id];
		saved = { ...saved };
	}

	let savedList = $derived(Object.values(saved));
	let isCurrentSaved = $derived(!!(current && saved[current._id]));

	// JSON the user copies and hands back — apply-pressure-backfill.mjs
	// reads this exact shape.
	let exportJson = $derived(JSON.stringify(savedList, null, 2));

	let exportTextarea: HTMLTextAreaElement | undefined = $state();
	function copyExport() {
		exportTextarea?.select();
		void navigator.clipboard.writeText(exportJson);
	}

	// --- Chart input -------------------------------------------------------
	//
	// One session showing both the originally measured records and (when
	// present) the proposed endpoint(s). The PressureChart's "Raw +
	// estimates" view uses estimateP00/P100 internally — with the proposed
	// records spliced in those calls hit the bracket-midpoint branch, so
	// the dashed estimate line on the chart matches the readouts above.
	let chartSessions = $derived(
		current
			? [
					{
						id: current._id,
						label: `${current.penLabel} · ${current.inventoryId} ${current.date}`,
						records: augmentedRecords,
					},
				]
			: [],
	);
</script>

<svelte:head>
	<title>Pressure backfill (dev tool)</title>
</svelte:head>

<div class="page">
	<header>
		<h1>Pressure backfill (dev tool)</h1>
		<p class="lead">
			For each pressure session that's missing a 0% or 100% endpoint record, drag the slider to pick
			a plausible force value and watch the bracket-midpoint P00 / P100 estimate update. Save your
			choice and move to the next. When done, copy the JSON at the bottom and hand it back so it can
			be applied to the brand JSON files via
			<code>scripts/apply-pressure-backfill.mjs</code>.
		</p>
		<p class="meta">
			<strong>{candidates.length}</strong> sessions need backfill —
			{totalP00Needed} need a 0% endpoint, {totalP100Needed} need a 100% endpoint.
			<strong>{savedList.length}</strong> saved so far.
		</p>
	</header>

	{#if candidates.length === 0}
		<p class="empty">Every session already has a 0% and 100% endpoint. Nothing to backfill.</p>
	{:else if !current}
		<p class="empty">Out of range. <button onclick={() => (idx = 0)}>Go to first</button></p>
	{:else}
		<section class="nav-row">
			<button onclick={() => go(-1)} disabled={idx === 0}>← Prev</button>
			<span class="counter">
				{idx + 1} / {candidates.length}
				{#if isCurrentSaved}<span class="saved-pill">saved</span>{/if}
			</span>
			<button onclick={() => go(+1)} disabled={idx >= candidates.length - 1}>Next →</button>
			<span class="spacer"></span>
			<button onclick={unsaveCurrent} disabled={!isCurrentSaved}>Unsave</button>
			<button onclick={saveCurrent} class="primary">Save</button>
			<button onclick={saveAndNext} class="primary" disabled={idx >= candidates.length - 1}>
				Save &amp; Next
			</button>
		</section>

		<section class="session-meta">
			<table>
				<tbody>
					<tr><th>Pen</th><td>{current.penLabel}</td></tr>
					<tr><th>Brand</th><td>{current.brandLabel}</td></tr>
					<tr><th>Inventory</th><td class="mono">{current.inventoryId}</td></tr>
					<tr><th>Date</th><td class="mono">{current.date}</td></tr>
					<tr><th>Tablet</th><td class="mono">{current.tabletId}</td></tr>
					<tr><th>Entity</th><td class="mono">{current.entityId}</td></tr>
					<tr><th>Records</th><td class="num">{current.records.length}</td></tr>
					<tr>
						<th>First</th>
						<td class="mono">
							[{current.records[0][0]}, {current.records[0][1]}]
						</td>
					</tr>
					<tr>
						<th>Last</th>
						<td class="mono">
							[{current.records[current.records.length - 1][0]},
							{current.records[current.records.length - 1][1]}]
						</td>
					</tr>
				</tbody>
			</table>
		</section>

		<section class="panels">
			<div class="panel">
				<h3 class="panel-title">
					IAF zoom <span class="panel-sub">— tune P00</span>
				</h3>
				<PressureChart sessions={chartSessions} height={320} title="" lockedZoom="iaf" />
				{#if current.needsP00}
					{@const r = p00Range}
					<div class="slider-row">
						<label>
							<span class="slider-label">P00 (force at 0%)</span>
							<input type="range" min={r.min} max={r.max} step={r.step} bind:value={p00Force} />
							<input
								type="number"
								min={r.min}
								max={r.max}
								step={r.step}
								bind:value={p00Force}
								class="num-input"
							/>
						</label>
						<div class="slider-meta">
							<span class="range-hint">range {r.min} – {r.max.toFixed(1)} gf</span>
							<span class="est">
								bracket P00 = <strong>{estP00 === null ? '—' : estP00.toFixed(2)}</strong> gf
							</span>
						</div>
					</div>
				{:else}
					<div class="slider-row inactive">
						<span class="slider-label">
							P00: already bracketed ({current.records.find(([, y]) => y <= 0)?.join(', ')})
						</span>
					</div>
				{/if}
			</div>

			<div class="panel">
				<h3 class="panel-title">
					Max-pressure zoom <span class="panel-sub">— tune P100</span>
				</h3>
				<PressureChart sessions={chartSessions} height={320} title="" lockedZoom="max" />
				{#if current.needsP100}
					{@const r = p100Range}
					<div class="slider-row">
						<label>
							<span class="slider-label">P100 (force at 100%)</span>
							<input type="range" min={r.min} max={r.max} step={r.step} bind:value={p100Force} />
							<input
								type="number"
								min={r.min}
								max={r.max}
								step={r.step}
								bind:value={p100Force}
								class="num-input"
							/>
						</label>
						<div class="slider-meta">
							<span class="range-hint">range {r.min.toFixed(1)} – {r.max.toFixed(1)} gf</span>
							<span class="est">
								bracket P100 = <strong>{estP100 === null ? '—' : estP100.toFixed(2)}</strong> gf
							</span>
						</div>
					</div>
				{:else}
					<div class="slider-row inactive">
						<span class="slider-label">P100: already saturated or bracketed</span>
					</div>
				{/if}
			</div>
		</section>
	{/if}

	<section class="export">
		<div class="export-header">
			<h2>Saved edits ({savedList.length})</h2>
			<div class="export-actions">
				<button onclick={copyExport} disabled={savedList.length === 0}>Copy JSON</button>
				<button onclick={clearSaved} disabled={savedList.length === 0}>Clear all</button>
			</div>
		</div>
		<textarea
			bind:this={exportTextarea}
			readonly
			rows={Math.min(20, Math.max(4, savedList.length * 4 + 2))}
			value={exportJson}
		></textarea>
		<p class="export-hint">
			Hand this back to apply via <code>scripts/apply-pressure-backfill.mjs</code>.
		</p>
		{#if savedList.length > 0}
			<ul class="saved-summary">
				{#each savedList as e (e._id)}
					<li>
						<span class="mono">{e.brand} · {e.inventoryId} · {e.date}</span> —
						{#if e.prependP00Force !== undefined}P00=<strong>{e.prependP00Force}</strong>{/if}
						{#if e.prependP00Force !== undefined && e.appendP100Force !== undefined}
							·
						{/if}
						{#if e.appendP100Force !== undefined}P100=<strong>{e.appendP100Force}</strong>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.page {
		max-width: 1080px;
		margin: 0 auto;
		padding: 16px;
	}
	header {
		margin-bottom: 16px;
	}
	h1 {
		margin: 0 0 8px;
		font-size: 22px;
	}
	.lead {
		color: var(--text-muted);
		font-size: 13px;
		line-height: 1.5;
		margin: 0 0 8px;
	}
	.meta {
		margin: 0;
		font-size: 13px;
	}
	.empty {
		padding: 24px;
		text-align: center;
		color: var(--text-muted);
	}
	.nav-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}
	.nav-row .spacer {
		flex: 1;
	}
	.counter {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.saved-pill {
		display: inline-block;
		margin-left: 6px;
		padding: 1px 6px;
		font-size: 11px;
		border-radius: 8px;
		background: #16a34a;
		color: #fff;
	}
	button {
		padding: 4px 12px;
		font-size: 13px;
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text);
		border-radius: 4px;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		border-color: #2563eb;
		color: #2563eb;
	}
	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	button.primary {
		background: #2563eb;
		color: #fff;
		border-color: #2563eb;
	}
	button.primary:hover:not(:disabled) {
		background: #1d4ed8;
		color: #fff;
	}
	.session-meta {
		margin-bottom: 12px;
	}
	.session-meta table {
		font-size: 12px;
		border-collapse: collapse;
	}
	.session-meta th {
		text-align: left;
		padding: 2px 12px 2px 0;
		color: var(--text-muted);
		font-weight: 500;
		white-space: nowrap;
	}
	.session-meta td {
		padding: 2px 0;
	}
	.panels {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin-bottom: 24px;
	}
	@media (max-width: 900px) {
		.panels {
			grid-template-columns: 1fr;
		}
	}
	.panel {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 10px 12px 12px;
		background: var(--bg-card);
		min-width: 0;
	}
	.panel-title {
		margin: 0 0 6px;
		font-size: 13px;
		font-weight: 700;
	}
	.panel-sub {
		font-weight: 400;
		color: var(--text-muted);
	}
	.slider-row {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--border);
	}
	.slider-row.inactive {
		color: var(--text-muted);
		font-size: 12px;
		font-style: italic;
	}
	.slider-row label {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.slider-label {
		min-width: 140px;
		font-weight: 600;
		font-size: 12px;
	}
	.slider-row input[type='range'] {
		flex: 1;
		min-width: 80px;
	}
	.num-input {
		width: 80px;
		padding: 3px 6px;
		font-size: 13px;
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
	.slider-meta {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding-left: 150px;
	}
	.range-hint {
		font-size: 11px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.est {
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.export {
		border-top: 1px solid var(--border);
		padding-top: 16px;
	}
	.export-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
	}
	.export h2 {
		margin: 0;
		font-size: 15px;
		flex: 1;
	}
	.export-actions {
		display: flex;
		gap: 6px;
	}
	textarea {
		width: 100%;
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
		font-size: 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 8px;
		box-sizing: border-box;
		background: var(--bg-card);
		color: var(--text);
		resize: vertical;
	}
	.export-hint {
		font-size: 12px;
		color: var(--text-muted);
		margin: 6px 0 12px;
	}
	.saved-summary {
		font-size: 12px;
		padding-left: 18px;
		margin: 0;
		max-height: 180px;
		overflow-y: auto;
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
</style>
