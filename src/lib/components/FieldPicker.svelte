<script lang="ts">
	import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
	import {
		fieldLabelBoldWhenKeyMatch,
		fieldMatchesQuery,
		highlightFieldLabel,
		normalizeFieldSearch,
	} from '$lib/field-picker-search.js';
	import { onMount } from 'svelte';

	let {
		fields,
		fieldGroups,
		selected = '',
		exclude = [],
		onselect,
		onselectgroup,
		onremovegroup,
		onclose,
	}: {
		fields: AnyFieldDisplayDef[];
		fieldGroups: string[];
		selected?: string;
		exclude?: string[];
		onselect: (key: string) => void;
		onselectgroup?: (keys: string[]) => void;
		onremovegroup?: (keys: string[]) => void;
		onclose: () => void;
	} = $props();

	let searchQuery = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);

	let excludeSet = $derived(new Set(exclude));
	let hasSearch = $derived(normalizeFieldSearch(searchQuery) !== '');

	onMount(() => {
		searchInput?.focus();
	});

	function pick(key: string) {
		onselect(key);
	}

	function toggleGroup(allGroupFields: AnyFieldDisplayDef[]) {
		const allKeys = allGroupFields.map((f) => f.key);
		const allChosen = allKeys.every((k) => excludeSet.has(k));
		if (allChosen && onremovegroup) {
			onremovegroup(allKeys);
		} else if (onselectgroup) {
			const available = allKeys.filter((k) => !excludeSet.has(k));
			onselectgroup(available);
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (hasSearch) {
				searchQuery = '';
				e.preventDefault();
			} else {
				onclose();
			}
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- The backdrop is a "click outside to close" affordance. The keyboard
	 equivalent is Escape, handled on the window above. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onclose}></div>
<div class="field-picker">
	<div class="search-row">
		<div class="search-wrap">
			<input
				bind:this={searchInput}
				class="search-input"
				type="search"
				placeholder="Search fields…"
				bind:value={searchQuery}
				aria-label="Search fields"
			/>
			{#if hasSearch}
				<button
					type="button"
					class="search-clear"
					aria-label="Clear search"
					onclick={() => (searchQuery = '')}>×</button
				>
			{/if}
		</div>
	</div>
	<div class="groups">
		{#each fieldGroups as group (group)}
			{@const allGroupFields = fields.filter((f) => f.group === group)}
			{@const allChosen = allGroupFields.every((f) => excludeSet.has(f.key))}
			{#if allGroupFields.length > 0}
				<div class="group">
					<div class="group-header">
						<span class="group-label">{group}</span>
						{#if onselectgroup}
							<button
								class="group-toggle"
								class:remove={allChosen}
								onclick={() => toggleGroup(allGroupFields)}
								title={allChosen ? `Remove all ${group}` : `Add all ${group}`}
							>
								{allChosen ? 'none' : 'all'}
							</button>
						{/if}
					</div>
					{#each allGroupFields as f (f.key)}
						{@const chosen = excludeSet.has(f.key)}
						{@const matches = hasSearch && fieldMatchesQuery(f, searchQuery)}
						{@const labelSegments = hasSearch ? highlightFieldLabel(f.label, searchQuery) : null}
						{@const boldWholeLabel = hasSearch && fieldLabelBoldWhenKeyMatch(f, searchQuery)}
						<button
							class="field-item"
							class:selected={f.key === selected}
							class:chosen
							class:search-dim={hasSearch && !matches}
							disabled={chosen}
							onclick={() => {
								if (!chosen) pick(f.key);
							}}
						>
							{#if boldWholeLabel}
								<mark class="search-hit">{f.label}</mark>
							{:else if labelSegments}
								{#each labelSegments as seg, i (i)}
									{#if seg.match}<mark class="search-hit">{seg.text}</mark>{:else}{seg.text}{/if}
								{/each}
							{:else}
								{f.label}
							{/if}{#if chosen}
								✓{/if}
						</button>
					{/each}
				</div>
			{/if}
		{/each}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 199;
	}

	.field-picker {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 4px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		z-index: 200;
		padding: 8px;
		min-width: 300px;
		max-height: min(70vh, 480px);
		overflow-y: auto;
	}

	.search-row {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--bg-card);
		padding-bottom: 8px;
		margin-bottom: 4px;
		border-bottom: 1px solid var(--border-light);
	}

	.search-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-input {
		width: 100%;
		padding: 5px 26px 5px 10px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: transparent;
		color: var(--text);
	}

	.search-input:focus {
		outline: 2px solid color-mix(in srgb, var(--link) 35%, transparent);
		outline-offset: 0;
		border-color: var(--link);
	}

	.search-clear {
		position: absolute;
		right: 6px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 16px;
		line-height: 1;
		padding: 0 2px;
		display: flex;
		align-items: center;
	}

	.search-clear:hover {
		color: var(--text);
	}

	.groups {
		display: flex;
		gap: 12px;
	}

	.group {
		min-width: 120px;
	}

	.group-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 2px 6px 4px;
		border-bottom: 1px solid var(--border);
		margin-bottom: 2px;
	}

	.group-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.group-toggle {
		font-size: var(--type-micro);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: none;
		color: var(--accent);
		cursor: pointer;
		padding: 1px 5px;
	}

	.group-toggle:hover {
		background: var(--hover-bg);
	}

	.group-toggle.remove {
		color: var(--danger);
	}

	.field-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 4px 6px;
		font-size: 13px;
		border: none;
		background: none;
		cursor: pointer;
		color: var(--text);
		border-radius: var(--radius);
	}

	.field-item:hover {
		background: var(--hover-bg);
	}

	.field-item.selected {
		background: var(--pill-sort-bg);
		font-weight: 600;
	}

	.field-item.chosen {
		opacity: 0.4;
		cursor: default;
	}

	.field-item.search-dim {
		color: var(--text-muted);
		opacity: 0.45;
	}

	.field-item.search-dim:hover {
		opacity: 0.65;
		color: var(--text-dim);
	}

	/* Search matches are one of the few places Metro spends the accent as
	   a fill: the hit must be findable mid-word while scanning. */
	.search-hit {
		font-weight: 700;
		background: var(--accent);
		color: var(--accent-contrast);
		border-radius: var(--radius);
		padding: 0 2px;
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
	}
</style>
