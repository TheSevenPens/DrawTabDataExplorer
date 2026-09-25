<script lang="ts" generics="T">
	// The Compare spec matrix (#373). Column headers live in the table head so
	// they always line up with the cells. Two views:
	//   summary — one column per comparison column, cells summarised across
	//             its members (compare/summary.ts);
	//   members — every member its own sub-column, banded under its column.
	// Grouping is drag and drop *and* menus: every drag has a menu path
	// (move / merge / remove), so nothing depends on a pointer.
	import { resolve } from '$app/paths';
	import PopoverMenu from '$lib/components/PopoverMenu.svelte';
	import type { CompareGroup } from '$lib/compare-matrix.js';
	import type { MemberRef } from './model';
	import type { ResolvedColumn } from './resolve';
	import type { SummaryGroup } from './summary';
	import { DRAG_MIME as MIME, type DragPayload, type MemberHeader } from './dnd';

	let {
		columns,
		colors,
		view,
		summaryGroups,
		memberGroups,
		memberHeaders,
		overlaps,
		full,
		familyMembersOf,
		ondrop,
		onremovecolumn,
		onremoveref,
		onrename,
		onmoveref,
		onmerge,
		ontoggleexcluded,
		onnewgroup,
	}: {
		columns: ResolvedColumn<T>[];
		colors: string[];
		view: 'summary' | 'members';
		summaryGroups: SummaryGroup[];
		/** buildCompareGroups over every column's members, flattened in column order. */
		memberGroups: CompareGroup[];
		/** Per column, its members' headers (same order as memberGroups values). */
		memberHeaders: MemberHeader[][];
		overlaps: Map<string, { label: string; others: string[] }[]>;
		full: boolean;
		/** A family ref's members with their inclusion in this column. */
		familyMembersOf: (
			columnId: string,
			familyId: string,
		) => (MemberHeader & { included: boolean })[];
		ondrop: (payload: DragPayload, target: string | null) => void;
		onremovecolumn: (id: string) => void;
		onremoveref: (columnId: string, ref: MemberRef) => void;
		onrename: (columnId: string, name: string) => void;
		onmoveref: (from: string, to: string | null, ref: MemberRef) => void;
		onmerge: (from: string, to: string) => void;
		ontoggleexcluded: (columnId: string, modelId: string) => void;
		onnewgroup: () => void;
	} = $props();

	let dropTarget: string | null = $state(null);
	let menu: {
		x: number;
		y: number;
		items: { label: string; onclick: () => void; danger?: boolean }[];
	} | null = $state(null);

	function dragStart(e: DragEvent, payload: DragPayload) {
		e.dataTransfer?.setData(MIME, JSON.stringify(payload));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	function dragOver(e: DragEvent, target: string) {
		if (!e.dataTransfer?.types.includes(MIME)) return;
		e.preventDefault();
		dropTarget = target;
	}
	function drop(e: DragEvent, target: string | null) {
		const raw = e.dataTransfer?.getData(MIME);
		dropTarget = null;
		if (!raw) return;
		e.preventDefault();
		ondrop(JSON.parse(raw) as DragPayload, target);
	}

	function openMenu(
		e: MouseEvent,
		items: { label: string; onclick: () => void; danger?: boolean }[],
	) {
		e.stopPropagation();
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		menu = { x: r.left, y: r.bottom + 4, items };
	}

	function refMenu(e: MouseEvent, col: ResolvedColumn<T>, ref: MemberRef) {
		openMenu(e, [
			...columns
				.filter((c) => c.id !== col.id)
				.map((c) => ({ label: `Move to ${c.name}`, onclick: () => onmoveref(col.id, c.id, ref) })),
			...(full
				? []
				: [{ label: 'Move to a new group', onclick: () => onmoveref(col.id, null, ref) }]),
			{ label: 'Remove', onclick: () => onremoveref(col.id, ref), danger: true },
		]);
	}

	function columnMenu(e: MouseEvent, col: ResolvedColumn<T>) {
		openMenu(e, [
			...columns
				.filter((c) => c.id !== col.id)
				.map((c) => ({ label: `Merge into ${c.name}`, onclick: () => onmerge(col.id, c.id) })),
			{ label: 'Remove column', onclick: () => onremovecolumn(col.id), danger: true },
		]);
	}

	const KIND_LABEL: Record<string, string> = {
		model: '',
		family: 'family',
		unit: 'unit',
		group: 'group',
	};

	let memberColumnCount = $derived(memberHeaders.reduce((n, h) => n + Math.max(1, h.length), 0));

	// Start offset of each column's members inside the flattened member rows.
	let memberOffsets = $derived(
		memberHeaders.reduce<number[]>(
			(acc, _h, i) => [...acc, i === 0 ? 0 : acc[i - 1] + memberHeaders[i - 1].length],
			[],
		),
	);
</script>

<div class="matrix-wrap">
	<table class="matrix" class:members={view === 'members'}>
		<thead>
			<tr>
				<th class="spec-col" scope="col"><span class="sr-only">Spec</span></th>
				{#each columns as col, ci (col.id)}
					<th
						scope="col"
						colspan={view === 'members' ? Math.max(1, memberHeaders[ci]?.length ?? 1) : 1}
						class="col-head"
						class:drop={dropTarget === col.id}
						ondragover={(e) => dragOver(e, col.id)}
						ondragleave={() => (dropTarget = null)}
						ondrop={(e) => drop(e, col.id)}
					>
						<div class="head-card">
							<div class="head-top">
								<span class="swatch" style="background: {colors[ci]}" aria-hidden="true"></span>
								<span
									class="kind"
									draggable="true"
									role="button"
									tabindex="-1"
									title="Drag onto another column to merge"
									ondragstart={(e) => dragStart(e, { kind: 'column', id: col.id })}
									>{KIND_LABEL[col.kind] || 'model'}{col.models.length > 1
										? ` · ${col.models.length}`
										: ''}</span
								>
								<span class="spacer"></span>
								<button
									type="button"
									class="icon"
									aria-label="Actions for {col.name}"
									onclick={(e) => columnMenu(e, col)}>⋯</button
								>
							</div>
							{#if col.kind === 'group'}
								<label class="name">
									<span class="sr-only">Group name</span>
									<input
										type="text"
										value={col.name}
										onchange={(e) => onrename(col.id, (e.currentTarget as HTMLInputElement).value)}
									/>
								</label>
							{:else if col.refs[0]?.ref.type === 'family'}
								<a
									class="name"
									href={resolve('/entity/[entityId]', { entityId: col.refs[0].ref.id })}
									>{col.name}</a
								>
							{:else if col.refs[0]?.ref.type === 'model'}
								<a
									class="name"
									href={resolve('/entity/[entityId]', { entityId: col.refs[0].ref.id })}
									>{col.name}</a
								>
							{:else}
								<span class="name">{col.name}</span>
							{/if}
							{#if col.kind === 'group' || col.kind === 'family'}
								<ul class="chips">
									{#each col.refs as r (r.ref.type + r.ref.id)}
										<li
											class="chip"
											class:missing={r.missing}
											draggable="true"
											ondragstart={(e) => dragStart(e, { kind: 'ref', ref: r.ref, from: col.id })}
										>
											{#if r.ref.type === 'family'}
												<details>
													<summary
														><span class="chip-kind">family</span>
														{r.label} · {r.count}</summary
													>
													<ul class="members">
														{#each familyMembersOf(col.id, r.ref.id) as m (m.id)}
															<li>
																<label
																	><input
																		type="checkbox"
																		checked={m.included}
																		onchange={() => ontoggleexcluded(col.id, m.id)}
																	/>
																	{m.label}</label
																>
															</li>
														{/each}
													</ul>
												</details>
											{:else}
												<span
													><span class="chip-kind">{r.ref.type === 'unit' ? 'unit' : ''}</span
													>{r.label}</span
												>
											{/if}
											{#if col.kind === 'group'}
												<button
													type="button"
													class="icon"
													aria-label="Actions for {r.label}"
													onclick={(e) => refMenu(e, col, r.ref)}>⋯</button
												>
											{/if}
										</li>
									{/each}
								</ul>
								{#if col.refs.length === 0}
									<p class="hint">Drop items here.</p>
								{/if}
							{/if}
							{#each overlaps.get(col.id) ?? [] as o (o.label)}
								<p class="hint">{o.label} is also in {o.others.join(', ')}.</p>
							{/each}
						</div>
					</th>
				{/each}
				{#if !full}
					<th
						class="new-col"
						class:drop={dropTarget === 'new'}
						ondragover={(e) => dragOver(e, 'new')}
						ondragleave={() => (dropTarget = null)}
						ondrop={(e) => drop(e, null)}
					>
						<div class="new-card">
							<span>Drop here for a new column, or</span>
							<button type="button" class="add" onclick={onnewgroup}>new group</button>
						</div>
					</th>
				{/if}
			</tr>
			{#if view === 'members'}
				<tr class="member-row">
					<th class="spec-col"></th>
					{#each columns as col, ci (col.id)}
						{#if (memberHeaders[ci]?.length ?? 0) === 0}
							<th class="band-start"></th>
						{:else}
							{#each memberHeaders[ci] as m, mi (m.id + mi)}
								<th class="member-head" class:band-start={mi === 0} scope="col"
									><a href={resolve('/entity/[entityId]', { entityId: m.id })}>{m.label}</a></th
								>
							{/each}
						{/if}
					{/each}
					{#if !full}<th></th>{/if}
				</tr>
			{/if}
		</thead>
		<tbody>
			{#if view === 'summary'}
				{#each summaryGroups as g (g.group)}
					<tr class="section"><td colspan={columns.length + 2}>{g.group}</td></tr>
					{#each g.rows as row (row.key)}
						<tr class:differs={row.differs}>
							<th scope="row" class="spec-label">{row.label}</th>
							{#each row.cells as cell, ci (ci)}
								<td
									>{#if cell.text}{cell.text}{:else}<span class="blank">—</span
										>{/if}{#if cell.varies}<span class="note">varies</span>{/if}{#if cell.note}<span
											class="note">{cell.note}</span
										>{/if}</td
								>
							{/each}
							{#if !full}<td></td>{/if}
						</tr>
					{/each}
				{/each}
			{:else}
				{#each memberGroups as g (g.group)}
					<tr class="section"><td colspan={memberColumnCount + 2}>{g.group}</td></tr>
					{#each g.fields as row (row.key)}
						<tr class:differs={row.differs}>
							<th scope="row" class="spec-label">{row.label}</th>
							{#each columns as col, ci (col.id)}
								{#if (memberHeaders[ci]?.length ?? 0) === 0}
									<td class="band-start"></td>
								{:else}
									{#each memberHeaders[ci] as m, mi (m.id + mi)}
										{@const val = row.values[memberOffsets[ci] + mi]}
										<td class:band-start={mi === 0} class:multiline={row.multiline}
											>{#if row.multiline && val}<span class="long">{val}</span>{:else}{val ||
													'—'}{/if}</td
										>
									{/each}
								{/if}
							{/each}
							{#if !full}<td></td>{/if}
						</tr>
					{/each}
				{/each}
			{/if}
		</tbody>
	</table>
</div>

{#if menu}
	<PopoverMenu x={menu.x} y={menu.y} items={menu.items} onclose={() => (menu = null)} />
{/if}

<style>
	.matrix-wrap {
		overflow-x: auto;
	}

	.matrix {
		border-collapse: collapse;
		font-size: var(--type-body);
		min-width: 100%;
	}

	.matrix th,
	.matrix td {
		text-align: left;
		vertical-align: top;
		padding: 6px 10px;
		border-bottom: 1px solid var(--border-light);
	}

	.spec-col {
		min-width: 160px;
		position: sticky;
		left: 0;
		background: var(--bg);
		z-index: 1;
	}

	.spec-label {
		font-weight: 600;
		color: var(--text-muted);
		white-space: nowrap;
		position: sticky;
		left: 0;
		background: var(--bg);
	}

	.col-head {
		min-width: 200px;
		padding: 0 5px 8px 5px;
		border-bottom: 0;
	}

	/* The header cards are content, not column captions: they keep their
	   authored case and body type rather than the global th caps. */
	.col-head,
	.new-col,
	.member-head {
		text-transform: none;
		letter-spacing: normal;
		font-size: var(--type-body);
		font-weight: 400;
		white-space: normal;
		color: var(--text);
	}

	.head-card {
		background: var(--bg-card);
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		height: 100%;
		box-sizing: border-box;
		outline: 2px dashed transparent;
		outline-offset: -2px;
	}

	.drop .head-card,
	.drop .new-card {
		outline-color: var(--accent);
	}

	.head-top {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.swatch {
		width: 10px;
		height: 10px;
		flex-shrink: 0;
	}

	.kind,
	.chip-kind {
		font-size: var(--type-micro);
		letter-spacing: var(--track-wide);
		text-transform: uppercase;
		color: var(--text-dim);
		font-weight: 700;
	}

	.kind {
		cursor: grab;
	}

	.chip-kind:not(:empty) {
		margin-right: 6px;
	}

	.spacer {
		flex-grow: 1;
	}

	.icon {
		border: 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		font-size: var(--type-body);
		padding: 0 4px;
		line-height: 1;
	}

	.icon:hover,
	.icon:focus-visible {
		color: var(--text);
	}

	.name {
		font-size: var(--type-subhead);
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
	}

	a.name:hover {
		color: var(--accent);
	}

	.name input {
		font: inherit;
		color: var(--text);
		background: transparent;
		border: 0;
		border-bottom: 1px dashed var(--text-dim);
		padding: 0;
		width: 100%;
	}

	.chips {
		list-style: none;
		margin: 2px 0 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
		font-weight: 400;
	}

	.chip {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 6px;
		font-size: var(--type-caption);
		padding: 3px 6px;
		background: var(--bg);
		border: 1px solid var(--border);
		cursor: grab;
	}

	.chip.missing {
		color: var(--text-dim);
		text-decoration: line-through;
	}

	.chip summary {
		cursor: pointer;
	}

	.members {
		list-style: none;
		margin: 4px 0 0 0;
		padding: 0;
	}

	.members label {
		display: flex;
		gap: 6px;
		align-items: center;
		cursor: pointer;
	}

	.hint {
		margin: 2px 0 0 0;
		font-size: var(--type-micro);
		color: var(--text-dim);
		font-weight: 400;
	}

	.new-col {
		min-width: 140px;
		padding: 0 5px 8px 5px;
		border-bottom: 0;
	}

	.new-card {
		border: 1px dashed var(--border);
		padding: 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		font-size: var(--type-caption);
		font-weight: 400;
		color: var(--text-dim);
		text-align: center;
		outline: 2px dashed transparent;
		outline-offset: -2px;
	}

	.add {
		font: inherit;
		font-size: var(--type-caption);
		padding: 3px 9px;
		border: 1px dashed var(--text-dim);
		background: transparent;
		color: var(--text);
		cursor: pointer;
	}

	.member-row th {
		font-size: var(--type-caption);
		white-space: nowrap;
	}

	.member-row a {
		color: var(--text);
		text-decoration: none;
	}

	.member-row a:hover {
		color: var(--accent);
	}

	.matrix.members td.band-start,
	.matrix.members th.band-start {
		border-left: 2px solid var(--border);
	}

	.section td {
		padding-top: 16px;
		border-bottom: 2px solid var(--border);
		font-size: var(--type-micro);
		letter-spacing: var(--track-wide);
		text-transform: uppercase;
		color: var(--text-dim);
		font-weight: 600;
	}

	/* Rows whose columns differ keep the accent-tinted ground the old compare
	   matrix used — the reason the page is open. */
	tr.differs td {
		background: var(--accent-wash);
	}

	.note {
		display: block;
		font-size: var(--type-micro);
		color: var(--text-dim);
	}

	.blank {
		color: var(--text-dim);
	}

	td.multiline {
		vertical-align: top;
	}

	td.multiline .long {
		display: block;
		min-width: 24ch;
		max-width: 40ch;
		white-space: pre-wrap;
	}
</style>
