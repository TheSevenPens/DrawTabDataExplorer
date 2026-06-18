<script lang="ts">
	// Shared flag toggle (GitHub #235). Two visual variants of one control so
	// every flag affordance — list cells, detail headers, family/unit toggles —
	// looks and behaves the same: the default bordered icon button (detail
	// headers) and a borderless `compact` icon (dense table cells).
	let {
		flagged,
		onclick,
		label = 'Flag for comparison',
		compact = false,
	}: { flagged: boolean; onclick: () => void; label?: string; compact?: boolean } = $props();
</script>

<button
	type="button"
	class="flag-btn"
	class:on={flagged}
	class:compact
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

	/* Borderless minimal icon for dense table cells. */
	.flag-btn.compact {
		padding: 0;
		font-size: 16px;
		border: none;
		background: none;
		color: var(--text-dim);
	}
	.flag-btn.compact:hover {
		color: #d97706;
	}
	.flag-btn.compact.on {
		background: none;
		color: #d97706;
	}
</style>
