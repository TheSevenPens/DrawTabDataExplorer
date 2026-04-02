<script lang="ts">
	import type { FieldDef } from '$data/lib/pipeline/index.js';

	let { fields, fieldGroups, selected = '', exclude = [], onselect, onclose }: {
		fields: FieldDef<any>[];
		fieldGroups: string[];
		selected?: string;
		exclude?: string[];
		onselect: (key: string) => void;
		onclose: () => void;
	} = $props();

	let excludeSet = $derived(new Set(exclude));

	function pick(key: string) {
		onselect(key);
	}
</script>

<div class="backdrop" onclick={onclose}></div>
<div class="field-picker">
	<div class="groups">
		{#each fieldGroups as group}
			{@const groupFields = fields.filter(f => f.group === group && !excludeSet.has(f.key))}
			{#if groupFields.length > 0}
				<div class="group">
					<div class="group-label">{group}</div>
					{#each groupFields as f}
						<button
							class="field-item"
							class:selected={f.key === selected}
							onclick={() => pick(f.key)}
						>
							{f.label}
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
		z-index: 99;
	}

	.field-picker {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 4px;
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		box-shadow: 0 4px 16px rgba(0,0,0,0.15);
		z-index: 100;
		padding: 8px;
		min-width: 300px;
	}

	.groups {
		display: flex;
		gap: 12px;
	}

	.group {
		min-width: 120px;
	}

	.group-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 2px 6px 4px;
		border-bottom: 1px solid var(--border);
		margin-bottom: 2px;
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
		border-radius: 3px;
	}

	.field-item:hover {
		background: var(--hover-bg);
	}

	.field-item.selected {
		background: var(--pill-sort-bg);
		font-weight: 600;
	}
</style>
