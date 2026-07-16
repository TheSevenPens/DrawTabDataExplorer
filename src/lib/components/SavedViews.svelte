<script lang="ts">
	import { onMount } from 'svelte';
	import type { Step } from '@thesevenpens/queriton';
	import { type SavedView, loadViews, saveView, deleteView, renameView } from '$lib/views.js';
	import { promptModal } from '$lib/modal-store.js';

	let {
		steps,
		entityType,
		defaultView,
		onload,
	}: {
		steps: Step[];
		entityType: string;
		defaultView: Step[];
		onload: (steps: Step[]) => void;
	} = $props();

	let BUILTIN_VIEWS: SavedView[] = $derived([{ name: 'Default', steps: defaultView }]);

	let userViews = $state<SavedView[]>([]);
	let selectedName = $state('Default');
	let renaming = $state(false);
	let renameValue = $state('');

	let allViews = $derived([...BUILTIN_VIEWS, ...userViews]);
	let isBuiltin = $derived(BUILTIN_VIEWS.some((v) => v.name === selectedName));

	onMount(() => {
		userViews = loadViews(entityType);
	});

	function refreshViews() {
		userViews = loadViews(entityType);
	}

	let selectedView = $derived(allViews.find((v) => v.name === selectedName) ?? null);

	async function handleCreate() {
		const name = await promptModal('Save view as', '', { confirmLabel: 'Save' });
		if (!name) return;
		saveView(entityType, name, steps);
		refreshViews();
		selectedName = name;
	}

	function handleDelete() {
		if (!selectedView) return;
		deleteView(entityType, selectedView.name);
		selectedName = 'Default';
		refreshViews();
	}

	function startRename() {
		if (!selectedView) return;
		renaming = true;
		renameValue = selectedView.name;
	}

	function finishRename() {
		if (!selectedView) return;
		const newName = renameValue.trim();
		if (newName && newName !== selectedView.name) {
			renameView(entityType, selectedView.name, newName);
			refreshViews();
			selectedName = newName;
		}
		renaming = false;
		renameValue = '';
	}

	function cancelRename() {
		renaming = false;
		renameValue = '';
	}
</script>

<div class="saved-views">
	<div class="views-row">
		<select
			bind:value={selectedName}
			onchange={() => {
				renaming = false;
				if (selectedView) {
					onload(JSON.parse(JSON.stringify(selectedView.steps)));
				}
			}}
		>
			{#each BUILTIN_VIEWS as view (view.name)}
				<option value={view.name}>{view.name}</option>
			{/each}
			{#if userViews.length > 0}
				<option disabled>──────────</option>
				{#each userViews as view (view.name)}
					<option value={view.name}>{view.name}</option>
				{/each}
			{/if}
		</select>

		{#if renaming}
			<input
				class="rename-input"
				type="text"
				bind:value={renameValue}
				onkeydown={(e) => {
					if (e.key === 'Enter') finishRename();
					if (e.key === 'Escape') cancelRename();
				}}
			/>
			<button class="action-btn" onclick={finishRename}>OK</button>
			<button class="action-btn" onclick={cancelRename}>Cancel</button>
		{:else}
			<button class="action-btn" onclick={startRename} disabled={selectedView === null || isBuiltin}
				>Rename</button
			>
			<button
				class="action-btn delete"
				onclick={handleDelete}
				disabled={selectedView === null || isBuiltin}>Delete</button
			>
		{/if}

		<span class="separator"></span>

		<button class="action-btn save" onclick={handleCreate}>Create View</button>
	</div>
</div>

<style>
	.saved-views {
		margin-bottom: 0;
	}

	.views-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.views-row select {
		padding: 5px 10px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		min-width: 180px;
		background: transparent;
		color: var(--text);
	}

	.views-row input {
		padding: 5px 10px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: transparent;
		color: var(--text);
		width: 160px;
	}

	.views-row select:focus,
	.views-row input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.rename-input {
		border-color: var(--accent) !important;
	}

	.separator {
		width: 1px;
		height: 24px;
		background: var(--separator-color);
		margin: 0 4px;
	}

	.action-btn {
		padding: 5px 10px;
		font-size: var(--type-micro);
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		border: 1px solid var(--border);
		background: transparent;
		border-radius: var(--radius);
		cursor: pointer;
		color: var(--text-muted);
	}

	.action-btn:hover:not(:disabled) {
		border-color: var(--text-dim);
		color: var(--text);
	}

	.action-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.action-btn.save {
		border-color: var(--good);
		color: var(--good);
	}

	.action-btn.save:hover:not(:disabled) {
		background: var(--good);
		color: #fff;
	}

	.action-btn.delete:hover:not(:disabled) {
		border-color: var(--danger);
		color: var(--danger);
	}
</style>
