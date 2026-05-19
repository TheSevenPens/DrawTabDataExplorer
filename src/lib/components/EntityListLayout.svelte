<script lang="ts">
	// Shared shell for entity list pages: Nav + optional SubNav +
	// EntityExplorer. Routes that need extra page-only logic (custom
	// cellLinks, name maps, etc.) compute those locally and pass them
	// through as `explorerProps`. See CLAUDE.md for the pattern.

	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import type { SubNavTab } from '$lib/nav/subnav-tabs.js';
	import type { AnyFieldDisplayDef, Step } from '@thesevenpens/queriton';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type CellLinkFn = (item: any) => { label: string; href: string }[];

	// Mirrors EntityExplorer's prop type. Kept inline rather than imported
	// so this file is the single point you read to understand the shell.
	interface ExplorerProps {
		title: string;
		entityType: string;
		entityLabel: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		data: any[];
		fields: AnyFieldDisplayDef[];
		fieldGroups: string[];
		defaultColumns: string[];
		defaultView: Step[];
		detailBasePath?: string;
		linkField?: string;
		cellLinks?: Record<string, CellLinkFn>;
		quickFilterFields?: string[];
		defaultFilterField?: string;
		alwaysSearchFields?: string[];
		flaggedIds?: Set<string>;
		onToggleFlag?: (entityId: string) => void;
		titleTag?: 'h1' | 'h2';
	}

	let { subNavTabs, ...explorerProps }: { subNavTabs?: SubNavTab[] } & ExplorerProps = $props();
</script>

<Nav />
{#if subNavTabs}
	<SubNav tabs={subNavTabs} />
{/if}
<EntityExplorer {...explorerProps} />
