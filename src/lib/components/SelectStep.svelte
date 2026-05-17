<script lang="ts">
	import type { SelectStep, AnyFieldDef } from 'queriton';

	let {
		step = $bindable(),
		fields,
		fieldGroups,
		onchange,
		onremove,
		removable = true,
	}: {
		step: SelectStep;
		fields: AnyFieldDef[];
		fieldGroups: string[];
		onchange: () => void;
		onremove: () => void;
		removable?: boolean;
	} = $props();

	let collapsed = $state(false);

	function toggle(key: string, checked: boolean) {
		if (checked) {
			step.fields = [...step.fields, key];
		} else {
			step.fields = step.fields.filter((k) => k !== key);
		}
		onchange();
	}

	function toggleGroup(group: string, checked: boolean) {
		const groupKeys = fields.filter((f) => f.group === group).map((f) => f.key);
		if (checked) {
			const toAdd = groupKeys.filter((k) => !step.fields.includes(k));
			step.fields = [...step.fields, ...toAdd];
		} else {
			step.fields = step.fields.filter((k) => !groupKeys.includes(k));
		}
		onchange();
	}

	function isGroupChecked(group: string): boolean {
		const groupKeys = fields.filter((f) => f.group === group).map((f) => f.key);
		return groupKeys.every((k) => step.fields.includes(k));
	}

	function isGroupIndeterminate(group: string): boolean {
		const groupKeys = fields.filter((f) => f.group === group).map((f) => f.key);
		const count = groupKeys.filter((k) => step.fields.includes(k)).length;
		return count > 0 && count < groupKeys.length;
	}
</script>

<div class="step">
	<div class="step-type">columns</div>
	<div class="step-controls">
		{#if collapsed}
			<span class="collapsed-summary">{step.fields.length} of {fields.length} columns selected</span
			>
		{:else}
			<div class="columns-groups">
				{#each fieldGroups as group (group)}
					{@const checked = isGroupChecked(group)}
					{@const indeterminate = isGroupIndeterminate(group)}
					<div class="column-group">
						<label class="group-header">
							<input
								type="checkbox"
								{checked}
								{indeterminate}
								onchange={(e) => toggleGroup(group, (e.target as HTMLInputElement).checked)}
							/>
							<strong>{group}</strong>
						</label>
						<div class="group-fields">
							{#each fields.filter((f) => f.group === group) as f (f.key)}
								<label>
									<input
										type="checkbox"
										checked={step.fields.includes(f.key)}
										onchange={(e) => toggle(f.key, (e.target as HTMLInputElement).checked)}
									/>
									{f.label}
								</label>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
	<div class="step-actions">
		<button class="step-collapse" onclick={() => (collapsed = !collapsed)}
			>{collapsed ? '▼' : '▲'}</button
		>
		{#if removable}
			<button class="step-remove" onclick={onremove}>&times;</button>
		{/if}
	</div>
</div>

<style>
	.columns-groups {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
	}

	.column-group {
		min-width: 150px;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0;
		font-size: 13px;
		cursor: pointer;
		margin-bottom: 4px;
		padding-bottom: 4px;
		border-bottom: 1px solid #e0e0e0;
	}

	.group-fields {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-left: 4px;
	}

	.group-fields label {
		font-size: 13px;
		display: flex;
		align-items: center;
		gap: 0;
		cursor: pointer;
	}

	:global(.group-fields input[type='checkbox']),
	:global(.group-header input[type='checkbox']) {
		margin: 0 2px 0 0 !important;
		width: 14px;
		height: 14px;
	}

	.collapsed-summary {
		font-size: 13px;
		color: #888;
		padding: 2px 0;
	}

	.step-actions {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.step-collapse {
		background: none;
		border: none;
		color: #999;
		cursor: pointer;
		font-size: 12px;
		padding: 2px 6px;
		line-height: 1;
	}

	.step-collapse:hover {
		color: #2563eb;
	}
</style>
