<script lang="ts">
	// The action bar for rows selected on a list page (#379): compare them,
	// add them to the working comparison, or add them as one group. Fixed to
	// the bottom of the window while anything is selected, so it never
	// shifts the table. Every action is a pure op from entry.ts / model.ts.
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import { addAsGroup, addMissing, startWith } from './entry';
	import { MAX_COLUMNS, type CompareKind, type Comparison, type MemberType } from './model';
	import { comparisons, updateComparison } from './store';

	let {
		kind,
		type,
		ids,
		noun,
		onclear,
	}: {
		kind: CompareKind;
		/** What a selected row is: a model, or a whole family. */
		type: MemberType;
		/** Selected rows' EntityIds. */
		ids: string[];
		/** "tablets", "pen families" … for the count. */
		noun: string;
		onclear: () => void;
	} = $props();

	let refs = $derived(ids.map((id) => ({ type, id: id.toLowerCase() })));
	let href = $derived(kind === 'tablets' ? resolve('/compare/tablets') : resolve('/compare/pens'));
	let tooMany = $derived(refs.length > MAX_COLUMNS);
	let status = $state('');

	function apply(op: (c: Comparison) => Comparison, open: boolean) {
		const before = get(comparisons[kind]).columns.length;
		updateComparison(kind, op);
		if (open) {
			onclear();
			goto(href);
			return;
		}
		const after = get(comparisons[kind]).columns.length;
		const added = after - before;
		status =
			added === 0
				? after >= MAX_COLUMNS
					? 'The comparison is full'
					: 'Already in the comparison'
				: `Added ${added} ${added === 1 ? 'column' : 'columns'}`;
	}

	$effect(() => {
		// A new selection starts without the previous action's status.
		void ids.length;
		status = '';
	});
</script>

{#if ids.length > 0}
	<div class="bar" role="region" aria-label="Selected rows">
		<span class="count">{ids.length} {noun} selected</span>
		<Button
			variant="primary"
			disabled={tooMany}
			disabledReason="More than {MAX_COLUMNS} — add them as one group instead"
			onclick={() => apply(() => startWith(kind, refs), true)}>compare these</Button
		>
		<Button variant="secondary" onclick={() => apply((c) => addMissing(c, refs), false)}
			>add to comparison</Button
		>
		<Button variant="secondary" onclick={() => apply((c) => addAsGroup(c, refs), true)}
			>add as one group</Button
		>
		<Button variant="subtle" onclick={onclear}>clear</Button>
		{#if status}
			<span class="status">{status} · <a {href}>open compare</a></span>
		{/if}
	</div>
{/if}

<style>
	.bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
		padding: 10px 24px;
		background: var(--bg-card);
		border-top: 2px solid var(--accent);
	}

	.count {
		font-size: var(--type-body);
		font-weight: 600;
		color: var(--text);
		margin-right: 6px;
	}

	.status {
		font-size: var(--type-caption);
		color: var(--text-muted);
	}
</style>
