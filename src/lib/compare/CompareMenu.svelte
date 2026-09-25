<script lang="ts">
	// The "compare" menu on detail pages (#373): add this model / family /
	// unit to the working comparison without leaving the page, or jump
	// straight into a comparison built around it. Sits beside FlagButton —
	// flags are the inbox, this is the direct path.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import PopoverMenu from '$lib/components/PopoverMenu.svelte';
	import { addMissing, holds, startWith } from './entry';
	import type { CompareKind, MemberRef } from './model';
	import { comparisons, updateComparison } from './store';

	let {
		kind,
		item,
		family,
		familyLabel = 'Compare with its family',
		members,
	}: {
		kind: CompareKind;
		item: MemberRef;
		/** A model's family (or a unit's model): offers comparing the two. */
		family?: MemberRef;
		familyLabel?: string;
		/** A family's members: offers "compare its members". */
		members?: MemberRef[];
	} = $props();

	const store = $derived(comparisons[kind]);
	let inComparison = $derived(holds($store, item));
	let href = $derived(kind === 'tablets' ? resolve('/compare/tablets') : resolve('/compare/pens'));
	let menu: { x: number; y: number } | null = $state(null);

	function open(e: MouseEvent) {
		e.stopPropagation();
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		menu = { x: r.left, y: r.bottom + 4 };
	}

	function andOpen(op: Parameters<typeof updateComparison>[1]) {
		updateComparison(kind, op);
		goto(href);
	}

	let items = $derived([
		inComparison
			? { label: 'Open the comparison', onclick: () => goto(href) }
			: {
					label: 'Add to comparison',
					onclick: () => updateComparison(kind, (c) => addMissing(c, [item])),
				},
		...(family
			? [{ label: familyLabel, onclick: () => andOpen((c) => addMissing(c, [item, family])) }]
			: []),
		...(members && members.length > 1
			? [
					{
						label: `Compare its ${members.length} members side by side`,
						onclick: () => andOpen(() => startWith(kind, members)),
					},
				]
			: []),
		{
			label: 'Start a new comparison with this',
			onclick: () => andOpen(() => startWith(kind, [item])),
		},
	]);
</script>

<span class="compare-menu">
	<Button variant="menu-trigger" onclick={open} title="Compare this with others">compare ▾</Button>
	{#if inComparison}
		<a class="in" {href}>in comparison</a>
	{/if}
</span>

{#if menu}
	<PopoverMenu x={menu.x} y={menu.y} {items} onclose={() => (menu = null)} />
{/if}

<style>
	.compare-menu {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.in {
		font-size: var(--type-caption);
		color: var(--text-muted);
	}

	.in:hover {
		color: var(--accent);
	}
</style>
