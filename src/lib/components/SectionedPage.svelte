<script lang="ts" module>
	export interface Section {
		id: string;
		category: string;
		label: string;
		/** Optional count chip rendered next to the label. */
		count?: number;
	}
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { Snippet } from 'svelte';

	let {
		sections,
		defaultSection,
		content,
	}: {
		sections: Section[];
		defaultSection?: string;
		/** Receives the currently-active section id; render the panel for it. */
		content: Snippet<[string]>;
	} = $props();

	let sectionIds = $derived(new Set(sections.map((s) => s.id)));
	let fallbackId = $derived(defaultSection ?? sections[0]?.id ?? '');

	let activeSection: string = $derived.by(() => {
		const hash = page.url.hash.slice(1);
		return sectionIds.has(hash) ? hash : fallbackId;
	});

	function setSection(id: string) {
		// page.url.pathname is already resolved (includes base path).
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${page.url.pathname}#${id}`, {
			replaceState: false,
			noScroll: true,
		});
	}

	let groupedSections = $derived.by(() => {
		const map = new Map<string, Section[]>();
		for (const s of sections) {
			if (!map.has(s.category)) map.set(s.category, []);
			map.get(s.category)!.push(s);
		}
		return [...map.entries()];
	});
</script>

<div class="layout">
	<nav class="tree" aria-label="Page sections">
		{#each groupedSections as [category, items] (category)}
			<div class="tree-cat">
				<div class="tree-cat-label">{category}</div>
				<ul>
					{#each items as item (item.id)}
						<li>
							<button
								type="button"
								class:active={activeSection === item.id}
								onclick={() => setSection(item.id)}
							>
								<span class="tree-label">{item.label}</span>
								{#if item.count != null}
									<span class="tree-count" class:zero={item.count === 0}>{item.count}</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</nav>

	<main class="content">
		{@render content(activeSection)}
	</main>
</div>

<style>
	.layout {
		display: flex;
		gap: 24px;
		align-items: flex-start;
	}

	.tree {
		flex: 0 0 240px;
		position: sticky;
		top: 16px;
		max-height: calc(100vh - 32px);
		overflow-y: auto;
		border-right: 1px solid var(--border, #e0e0e0);
		padding: 4px 12px 4px 0;
		font-size: 13px;
	}

	.tree-cat {
		margin-bottom: 14px;
	}

	.tree-cat-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted, #888);
		padding: 0 8px;
		margin-bottom: 4px;
	}

	.tree-cat ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tree-cat li {
		margin: 0;
	}

	.tree-cat button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		padding: 5px 10px;
		font-size: 13px;
		text-align: left;
		border: 1px solid transparent;
		/* Reserved up-front so the active accent edge below doesn't
		   change the button's width and shift the tree. */
		border-left: 2px solid transparent;
		border-radius: var(--radius);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		line-height: 1.3;
	}

	/*
	 * Was a hard-coded light-blue fill (#eff6ff / #dbeafe) that ignored the
	 * theme and rendered wrong on dark. Metro marks the selected section
	 * with a bright label and an accent edge instead of a tinted block.
	 */
	.tree-cat button:hover {
		background: var(--hover-bg);
		color: var(--text);
	}

	.tree-cat button.active {
		background: transparent;
		border-left-color: var(--accent);
		color: var(--text);
		font-weight: 600;
	}

	.tree-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/*
	 * The count IS the signal on /data-quality — non-zero means issues,
	 * zero means clean — so it keeps a semantic colour rather than the
	 * accent. Flattened from a filled pill to a square outline.
	 */
	.tree-count {
		flex: 0 0 auto;
		font-size: var(--type-micro);
		font-variant-numeric: tabular-nums;
		padding: 1px 6px;
		border-radius: var(--radius);
		background: transparent;
		border: 1px solid var(--danger);
		color: var(--danger);
	}

	.tree-count.zero {
		background: transparent;
		border-color: var(--good);
		color: var(--good);
	}

	.content {
		flex: 1;
		min-width: 0;
	}
</style>
