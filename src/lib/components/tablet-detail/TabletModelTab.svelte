<script lang="ts">
	import EntityLink from '$lib/components/EntityLink.svelte';
	import { type Tablet } from '$data/lib/drawtab-loader.js';
	import { TABLET_FIELDS } from '$data/lib/entities/tablet-fields.js';
	import { type TabletFamily } from '$data/lib/entities/tablet-family-fields.js';
	import { unitPreference, showAltUnits } from '$lib/unit-store.js';
	import { stripUnit, formatValueWithAlt } from '$lib/field-display.js';

	let {
		tablet,
		family,
		includedPenItems,
	}: {
		tablet: Tablet;
		family: TabletFamily | null;
		includedPenItems: { entityId: string; name: string }[];
	} = $props();

	const modelTabGroups = ['Model', 'Physical'];

	function getGroupFields(groups: string[]) {
		return TABLET_FIELDS.filter((f) => groups.includes(f.group));
	}

	function isUrl(val: string): boolean {
		return val.startsWith('http://') || val.startsWith('https://');
	}
</script>

<div class="detail-columns">
	{#each modelTabGroups as group (group)}
		{@const groupFields = getGroupFields([group])}
		{@const hasValues = groupFields.some((f) => {
			const v = f.getValue(tablet);
			return v && v !== '-';
		})}
		{#if hasValues}
			<div class="detail-col">
				<section class="field-group" id="group-{group.toLowerCase()}">
					<div class="group-header"><h2>{group}</h2></div>
					<dl>
						{#each groupFields as f (f.key)}
							{@const val = f.getValue(tablet)}
							{#if val && val !== '-'}
								<div class="field-row">
									<dt>{stripUnit(f.label, f.unit)}</dt>
									<dd>
										{#if f.key === 'ModelIncludedPen'}
											{#each includedPenItems as pen, i (pen.entityId)}
												{#if i > 0},
												{/if}
												<EntityLink entityId={pen.entityId}>{pen.name}</EntityLink>
											{/each}
										{:else if f.key === 'ModelFamily' && family}
											<EntityLink entityId={family.EntityId}>{family.FamilyName}</EntityLink>
										{:else if isUrl(val)}
											<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
											<a href={val} target="_blank" rel="noopener">
												{f.key === 'ModelUserManual'
													? 'View Manual ↗'
													: f.key === 'ModelProductLink'
														? 'View Product Page ↗'
														: val}
											</a>
										{:else}
											{f.getDisplayValue
												? f.getDisplayValue(tablet)
												: formatValueWithAlt(val, f.label, f.unit, $unitPreference, $showAltUnits)}
										{/if}
										{#if f.computed}
											<span class="computed-badge">computed</span>
										{/if}
									</dd>
								</div>
							{/if}
						{/each}
					</dl>
				</section>
			</div>
		{/if}
	{/each}
</div>

<style>
	.detail-columns {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 20px;
	}

	.detail-col {
		min-width: 0;
	}

	.field-group {
		margin-bottom: 16px;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
		padding-bottom: 3px;
		border-bottom: 2px solid var(--border);
	}

	h2 {
		font-size: 14px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 0;
	}

	dl {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0;
	}

	.field-row {
		display: flex;
		gap: 8px;
		padding: 3px 0;
		border-bottom: 1px solid var(--border);
		font-size: 13px;
	}

	dt {
		min-width: 100px;
		font-weight: 600;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	dd {
		color: var(--text);
		word-break: break-all;
	}

	dd a {
		color: var(--link);
		text-decoration: none;
	}

	dd a:hover {
		text-decoration: underline;
	}

	.computed-badge {
		display: inline-block;
		margin-left: 4px;
		padding: 1px 4px;
		font-size: 10px;
		color: var(--text-dim);
		border: 1px solid var(--border-light);
		border-radius: 3px;
		vertical-align: middle;
	}
</style>
