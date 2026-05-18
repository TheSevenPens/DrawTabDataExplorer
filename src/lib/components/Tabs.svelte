<script lang="ts">
	export interface Tab {
		id: string;
		label: string;
		/** Optional count chip rendered next to the label, e.g. "Inventory (12)". */
		badge?: number | string;
		/** Defaults to true. Set false to conditionally hide a tab. */
		visible?: boolean;
	}

	let {
		tabs,
		active = $bindable(),
	}: {
		tabs: Tab[];
		active: string;
	} = $props();

	let visibleTabs = $derived(tabs.filter((t) => t.visible !== false));
</script>

<div class="detail-tabs">
	{#each visibleTabs as tab (tab.id)}
		{@const hasBadge = tab.badge !== undefined && tab.badge !== ''}
		<button class:active={active === tab.id} onclick={() => (active = tab.id)}>
			{hasBadge ? `${tab.label} (${tab.badge})` : tab.label}
		</button>
	{/each}
</div>

<style>
	.detail-tabs {
		display: flex;
		gap: 0;
		border-bottom: 2px solid var(--border);
		margin-bottom: 16px;
	}
	.detail-tabs button {
		padding: 6px 16px;
		font-size: 13px;
		border: 1px solid transparent;
		border-bottom: none;
		border-radius: 4px 4px 0 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		position: relative;
		bottom: -2px;
	}
	.detail-tabs button:hover {
		color: #2563eb;
		background: var(--bg-card);
		border-color: var(--border);
	}
	.detail-tabs button.active {
		background: var(--bg);
		color: #2563eb;
		border-color: var(--border);
		font-weight: 600;
	}
</style>
