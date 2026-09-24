<script lang="ts">
	// A sortable column header. The <th> carries `aria-sort`; the click target
	// is a real <button>, so the header is reachable with Tab and works with
	// Enter/Space. The old headers put `onclick` on the <th> itself, which a
	// keyboard user could never reach (GitHub #335).
	import type { Snippet } from 'svelte';

	let {
		active,
		dir,
		num = false,
		onclick,
		children,
	}: {
		/** This column is the current sort key. */
		active: boolean;
		dir: 'asc' | 'desc';
		/** Right-align (numeric column). */
		num?: boolean;
		onclick: () => void;
		children: Snippet;
	} = $props();
</script>

<th class:num aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
	<button type="button" class="sort-btn" {onclick}>
		{@render children()}{#if active}<span class="arrow" aria-hidden="true"
				>{dir === 'asc' ? ' ▲' : ' ▼'}</span
			>{/if}
	</button>
</th>

<style>
	th.num {
		text-align: right;
	}
	/* Looks like the header text it replaced: no chrome, inherits type. */
	.sort-btn {
		all: inherit;
		display: inline;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		user-select: none;
	}
	.sort-btn:hover {
		color: var(--text);
	}
	.sort-btn:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: 2px;
	}
	.arrow {
		font-size: 0.8em;
	}
</style>
