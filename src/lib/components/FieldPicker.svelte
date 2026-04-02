<script lang="ts">
	import type { FieldDef } from '$data/lib/pipeline/index.js';

	let { fields, fieldGroups, selected = '', exclude = [], onselect, onselectgroup, onclose }: {
		fields: FieldDef<any>[];
		fieldGroups: string[];
		selected?: string;
		exclude?: string[];
		onselect: (key: string) => void;
		onselectgroup?: (keys: string[]) => void;
		onclose: () => void;
	} = $props();

	let excludeSet = $derived(new Set(exclude));

	function pick(key: string) {
		onselect(key);
	}

	function pickGroup(groupFields: FieldDef<any>[]) {
		if (onselectgroup) {
			onselectgroup(groupFields.map(f => f.key));
		}
	}
</script>

<div class="backdrop" onclick={onclose}></div>
<div class="field-picker">
	<div class="groups">
		{#each fieldGroups as group}
			{@const allGroupFields = fields.filter(f => f.group === group)}
			{@const availableGroupFields = allGroupFields.filter(f => !excludeSet.has(f.key))}
			{#if allGroupFields.length > 0}
				<div class="group">
					<div class="group-header">
						<span class="group-label">{group}</span>
						{#if onselectgroup && availableGroupFields.length > 0}
							<button class="group-add" onclick={() => pickGroup(availableGroupFields)} title="Add all {group} fields">all</button>
						{/if}
					</div>
					{#each allGroupFields as f}
						{@const chosen = excludeSet.has(f.key)}
						<button
							class="field-item"
							class:selected={f.key === selected}
							class:chosen
							disabled={chosen}
							onclick={() => { if (!chosen) pick(f.key); }}
						>
							{f.label}{#if chosen} ✓{/if}
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

	.group-add {
		font-size: 10px;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: none;
		color: var(--link);
		cursor: pointer;
		padding: 1px 5px;
	}

	.group-add:hover {
		background: var(--hover-bg);
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

	.field-item.chosen {
		opacity: 0.4;
		cursor: default;
	}
</style>
