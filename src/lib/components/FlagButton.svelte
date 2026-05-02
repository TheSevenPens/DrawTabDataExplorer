<script lang="ts">
	let {
		flagged,
		onclick,
		label = 'Flag for comparison',
	}: { flagged: boolean; onclick: () => void; label?: string } = $props();
</script>

<button
	type="button"
	class="flag-btn"
	class:on={flagged}
	{onclick}
	title={flagged ? `Unflag (${label})` : label}
	aria-label={flagged ? `Unflag (${label})` : label}
	aria-pressed={flagged}
>
	{#if flagged}
		⚑
	{:else}
		⚐
	{/if}
</button>

<style>
	.flag-btn {
		padding: 2px 8px;
		font-size: 14px;
		line-height: 1;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
	}
	.flag-btn:hover {
		border-color: #d97706;
		color: #d97706;
	}
	.flag-btn.on {
		background: #fff3cd;
		border-color: #d97706;
		color: #b45309;
	}
</style>
