<script lang="ts">
	// Anchored popover menu (GitHub #232/#234). One shared dismiss / position /
	// Escape behavior for the query-pill context menus (FilterBar, SortBar,
	// ColumnBar) that each hand-rolled an identical `.context-menu`. Positioned
	// at a fixed (x, y); the menu items are plain data, so callers keep their
	// per-bar actions while the rendering and dismissal live here.
	interface MenuAction {
		label: string;
		onclick: () => void;
		/** Render in the destructive (red) style, e.g. Remove. */
		danger?: boolean;
	}
	interface MenuDivider {
		divider: true;
	}
	type MenuItem = MenuAction | MenuDivider;

	let {
		x,
		y,
		items,
		onclose,
	}: {
		x: number;
		y: number;
		items: MenuItem[];
		onclose: () => void;
	} = $props();

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<!-- Any click (in or out) dismisses, matching the prior per-bar behavior; a
     selected item runs its action first, then closes. Escape also closes. -->
<svelte:window onclick={onclose} onkeydown={onKeydown} />

<div class="context-menu" role="menu" style="left: {x}px; top: {y}px;">
	{#each items as item, i (i)}
		{#if 'divider' in item}
			<hr />
		{:else}
			<button
				type="button"
				role="menuitem"
				class:delete={item.danger}
				onclick={() => {
					item.onclick();
					onclose();
				}}>{item.label}</button
			>
		{/if}
	{/each}
</div>

<style>
	/* Square, flat flyout — matches the FilterBar/SortBar/ColumnBar panels. */
	.context-menu {
		position: fixed;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		z-index: 200;
		min-width: 150px;
	}
	.context-menu button {
		display: block;
		width: 100%;
		text-align: left;
		padding: 6px 12px;
		font-size: 13px;
		border: none;
		background: none;
		cursor: pointer;
		color: var(--text);
	}
	.context-menu button:hover {
		background: var(--hover-bg);
	}
	.context-menu button.delete {
		color: var(--danger);
	}
	.context-menu button.delete:hover {
		background: var(--hover-bg);
	}
	.context-menu hr {
		border: none;
		border-top: 1px solid var(--border);
		margin: 2px 0;
	}
</style>
