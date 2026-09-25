<script lang="ts">
	// The Compare add rail (#373): search models, families and (pens) units,
	// plus the flagged inbox. A result is added with "+ add" (its own column),
	// dragged onto a column, or sent to a column from its menu — the keyboard
	// path for the drag.
	import PopoverMenu from '$lib/components/PopoverMenu.svelte';
	import { searchCandidates, type Candidate } from './candidates';
	import type { MemberRef } from './model';
	import { DRAG_MIME, type DragPayload } from './dnd';

	let {
		candidates,
		flagged,
		columns,
		full,
		searchLabel,
		presence,
		onadd,
		onaddto,
	}: {
		candidates: Candidate[];
		/** Flagged items, already resolved to candidates. */
		flagged: Candidate[];
		columns: { id: string; name: string }[];
		full: boolean;
		searchLabel: string;
		/** Where a candidate already sits ("in Mediums"), or ''. */
		presence: (c: Candidate) => string;
		onadd: (ref: MemberRef) => void;
		onaddto: (ref: MemberRef, columnId: string) => void;
	} = $props();

	let query = $state('');
	let results = $derived(searchCandidates(candidates, query));
	let menu: { x: number; y: number; items: { label: string; onclick: () => void }[] } | null =
		$state(null);

	function dragStart(e: DragEvent, c: Candidate) {
		const payload: DragPayload = { kind: 'candidate', ref: c.ref };
		e.dataTransfer?.setData(DRAG_MIME, JSON.stringify(payload));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
	}

	function addToMenu(e: MouseEvent, c: Candidate) {
		e.stopPropagation();
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		menu = {
			x: r.left,
			y: r.bottom + 4,
			items: columns.map((col) => ({
				label: `Add to ${col.name}`,
				onclick: () => onaddto(c.ref, col.id),
			})),
		};
	}
</script>

<aside class="rail" aria-label="Add to comparison">
	<div class="cap">add</div>
	<label class="search">
		<span>{searchLabel}</span>
		<input type="search" bind:value={query} placeholder="name or model id" />
	</label>

	{#snippet row(c: Candidate)}
		<li class="res" draggable="true" ondragstart={(e) => dragStart(e, c)}>
			<div class="res-main">
				<div class="kind">{c.kindLabel}</div>
				<div class="label">
					{c.label}{#if c.detail}<span class="detail">({c.detail})</span>{/if}
				</div>
				{#if presence(c)}<div class="where">{presence(c)}</div>{/if}
			</div>
			<div class="res-actions">
				<button
					type="button"
					class="add"
					disabled={full}
					title={full
						? 'All 8 columns are used — add it to a column instead'
						: 'Add as its own column'}
					aria-label="Add {c.label} as its own column"
					onclick={() => onadd(c.ref)}>+ add</button
				>
				{#if columns.length > 0}
					<button
						type="button"
						class="more"
						aria-label="Add {c.label} to a column"
						onclick={(e) => addToMenu(e, c)}>▾</button
					>
				{/if}
			</div>
		</li>
	{/snippet}

	{#if query.trim()}
		{#if results.length > 0}
			<ul class="list">
				{#each results as c (c.ref.type + c.ref.id)}{@render row(c)}{/each}
			</ul>
		{:else}
			<p class="empty">Nothing matches “{query}”.</p>
		{/if}
	{/if}

	<div class="flag-head">
		<div class="cap">flagged · {flagged.length}</div>
		{#if flagged.length > 0}
			<button
				type="button"
				class="add"
				disabled={full}
				onclick={() => flagged.forEach((c) => onadd(c.ref))}>+ add all</button
			>
		{/if}
	</div>
	{#if flagged.length > 0}
		<ul class="list">
			{#each flagged as c (c.ref.type + c.ref.id)}{@render row(c)}{/each}
		</ul>
	{:else}
		<p class="empty">
			Flag items anywhere in the explorer to collect them here. Flagging is optional.
		</p>
	{/if}
	<p class="empty">Drag an item onto a column to put it in that group.</p>
</aside>

{#if menu}
	<PopoverMenu x={menu.x} y={menu.y} items={menu.items} onclose={() => (menu = null)} />
{/if}

<style>
	.rail {
		width: 280px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.cap,
	.kind {
		font-size: var(--type-micro);
		letter-spacing: var(--track-wide);
		text-transform: uppercase;
		color: var(--text-dim);
		font-weight: 700;
	}

	.search {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: var(--type-caption);
		color: var(--text-muted);
	}

	.search input {
		font: inherit;
		font-size: var(--type-body);
		padding: 7px 9px;
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text);
		border-radius: var(--radius);
	}

	.search input:focus-visible {
		outline: none;
		border-color: var(--accent);
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 420px;
		overflow-y: auto;
	}

	.res {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		padding: 7px 0;
		border-bottom: 1px solid var(--border-light);
		cursor: grab;
	}

	.res-main {
		flex-grow: 1;
		min-width: 0;
	}

	.label {
		font-size: var(--type-body);
		color: var(--text);
	}

	/* A margin, not a text space: Svelte trims whitespace at the block edge. */
	.detail {
		color: var(--text-dim);
		margin-left: 0.3em;
	}

	.where {
		font-size: var(--type-micro);
		color: var(--text-dim);
	}

	.res-actions {
		display: flex;
		gap: 2px;
		flex-shrink: 0;
	}

	.add,
	.more {
		font: inherit;
		font-size: var(--type-caption);
		padding: 2px 8px;
		border: 1px dashed var(--text-dim);
		background: transparent;
		color: var(--text);
		cursor: pointer;
		white-space: nowrap;
	}

	.more {
		border-style: solid;
		border-color: var(--border);
		padding: 2px 5px;
	}

	.add:disabled {
		color: var(--text-dim);
		cursor: not-allowed;
	}

	.flag-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-top: 8px;
	}

	.empty {
		margin: 0;
		font-size: var(--type-caption);
		color: var(--text-dim);
	}
</style>
