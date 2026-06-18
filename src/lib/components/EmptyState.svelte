<script lang="ts">
	// Shared empty-state message (GitHub #237). Replaces the ~23 inline
	// `.no-data` / `.empty` paragraphs scattered across detail tabs, compare
	// pages, and analysis sections. The message is a snippet; an optional
	// `action` snippet renders a call-to-action below it (e.g. "flag a pen
	// first") so empty *workflow* states can point the user at what to do next.
	import type { Snippet } from 'svelte';

	let { children, action }: { children: Snippet; action?: Snippet } = $props();
</script>

<p class="empty-state">{@render children()}</p>
{#if action}
	<div class="empty-action">{@render action()}</div>
{/if}

<style>
	.empty-state {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
		margin: 0;
	}

	.empty-action {
		margin-top: 8px;
	}
</style>
