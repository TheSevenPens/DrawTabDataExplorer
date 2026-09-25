<script lang="ts" generics="T">
	// The /compare workspace (#373), shared by tablets and pens: kind switch,
	// toolbar, add rail, the spec matrix and the kind's extra views (sizes;
	// pressure response / IAF / MAX). Each page supplies lookups, candidates,
	// fields and a `views` snippet; everything that changes the comparison
	// goes through the pure operations in model.ts via the per-kind store.
	import type { Snippet } from 'svelte';
	import type { FieldDisplayDef } from '@thesevenpens/queriton';
	import { resolve } from '$app/paths';
	import Nav from '$lib/components/Nav.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
	import ChartExportButton from '$lib/components/ChartExportButton.svelte';
	import CompareMatrixImage from './CompareMatrixImage.svelte';
	import { layoutMatrixImage, membersImageInput, summaryImageInput } from './matrix-image';
	import { buildCompareGroups, onlyDifferences } from '$lib/compare-matrix.js';
	import { paletteColor } from '$lib/chart-palette.js';
	import { theme } from '$lib/theme-store.js';
	import AddRail from './AddRail.svelte';
	import CompareMatrix from './CompareMatrix.svelte';
	import type { DragPayload, MemberHeader } from './dnd';
	import { presenceOf, type Candidate } from './candidates';
	import { toMarkdownTable } from './markdown';
	import {
		MAX_COLUMNS,
		addRef,
		emptyComparison,
		isFull,
		mergeColumns,
		moveRef,
		newGroup,
		nextGroupName,
		refKey,
		removeColumn,
		removeRef,
		renameColumn,
		toggleExcluded,
		type CompareKind,
		type Comparison,
		type MemberRef,
	} from './model';
	import {
		findOverlaps,
		resolveColumns,
		type ResolvedColumn,
		type ResolveContext,
	} from './resolve';
	import { comparisons, updateComparison } from './store';
	import {
		buildSummaryGroups,
		countIdenticalRows,
		onlyDifferingRows,
		summaryExportRows,
	} from './summary';

	let {
		kind,
		ctx,
		candidates,
		flaggedRefs,
		fields,
		groupOrder,
		display,
		memberHeader,
		extraTabs = [],
		views,
	}: {
		kind: CompareKind;
		ctx: ResolveContext<T>;
		candidates: Candidate[];
		flaggedRefs: MemberRef[];
		fields: FieldDisplayDef<T>[];
		groupOrder: readonly string[];
		display: (field: FieldDisplayDef<T>, item: T) => string;
		memberHeader: (m: T) => MemberHeader;
		extraTabs?: { id: string; label: string }[];
		/** Renders a non-spec tab: (tab id, resolved columns, column colours). */
		views?: Snippet<[string, ResolvedColumn<T>[], string[]]>;
	} = $props();

	const store = $derived(comparisons[kind]);
	let comparison: Comparison = $derived($store);
	let resolved = $derived(resolveColumns(comparison.columns, ctx));
	let colors = $derived(resolved.map((_, i) => paletteColor(i, $theme)));
	let overlaps = $derived(findOverlaps(resolved, ctx));
	let full = $derived(isFull(comparison));

	let view: 'summary' | 'members' = $state('summary');
	let diffsOnly = $state(false);
	let activeTab = $state('specs');

	let allSummary = $derived(buildSummaryGroups(resolved, fields, groupOrder, display));
	let summaryGroups = $derived(diffsOnly ? onlyDifferingRows(allSummary) : allSummary);
	let hiddenCount = $derived(countIdenticalRows(allSummary));

	let flatMembers = $derived(resolved.flatMap((c) => c.models));
	let allMemberGroups = $derived(buildCompareGroups(flatMembers, fields, groupOrder, display));
	let memberGroups = $derived(diffsOnly ? onlyDifferences(allMemberGroups) : allMemberGroups);
	let memberHeaders = $derived(resolved.map((c) => c.models.map(memberHeader)));

	let candidateByKey = $derived(new Map(candidates.map((c) => [refKey(c.ref), c])));
	let flagged = $derived(
		flaggedRefs.map((r) => candidateByKey.get(refKey(r))).filter((c): c is Candidate => !!c),
	);
	const presence = (c: Candidate) => presenceOf(c, resolved, ctx.modelId);

	const update = (op: (c: Comparison) => Comparison) => updateComparison(kind, op);

	// Adding into a column that is a single, unnamed model or family turns it
	// into a named group — its name was the model's own, which no longer fits.
	function intoGroup(c: Comparison, columnId: string): Comparison {
		const col = c.columns.find((x) => x.id === columnId);
		return col && col.refs.length === 1 && col.name === undefined
			? renameColumn(c, columnId, nextGroupName(c))
			: c;
	}

	function handleDrop(p: DragPayload, target: string | null) {
		update((c) => {
			if (p.kind === 'candidate')
				return target ? addRef(intoGroup(c, target), p.ref, target) : addRef(c, p.ref);
			if (p.kind === 'ref') return moveTo(c, p.from, target, p.ref);
			return target ? mergeColumns(intoGroup(c, target), p.id, target) : c;
		});
	}

	function moveTo(c: Comparison, from: string, to: string | null, ref: MemberRef): Comparison {
		if (to) return moveRef(intoGroup(c, to), from, to, ref);
		if (isFull(c)) return c;
		const withGroup = newGroup(c, [ref]);
		return removeRef(withGroup, from, ref);
	}

	// --- export: the visible matrix, as the export dialog's formats or Markdown ---

	let exportHeaders = $derived(
		view === 'summary'
			? ['Section', 'Field', ...resolved.map((c) => c.name)]
			: [
					'Section',
					'Field',
					...resolved.flatMap((c) => c.models.map((m) => `${c.name}: ${memberHeader(m).label}`)),
				],
	);
	let exportRows = $derived(
		view === 'summary'
			? summaryExportRows(summaryGroups)
			: memberGroups.flatMap((g) =>
					g.fields.map((r) => [g.group, r.label, ...r.values.map((v) => v || '—')]),
				),
	);
	let showExport = $state(false);
	let mdStatus = $state('');
	async function copyMarkdown() {
		try {
			await navigator.clipboard.writeText(toMarkdownTable(exportHeaders, exportRows));
			mdStatus = 'Copied';
		} catch {
			mdStatus = 'Copy failed';
		}
		setTimeout(() => (mdStatus = ''), 2000);
	}

	const kindNoun = $derived(kind === 'tablets' ? 'tablets' : 'pens');

	// --- export as an image: what's on screen, drawn as SVG (#378) ---
	let imageSvg: SVGSVGElement | undefined = $state();
	let imageLayout = $derived.by(() => {
		const title = `${kind === 'tablets' ? 'Tablet' : 'Pen'} comparison`;
		const subtitle = [
			`${resolved.length} ${resolved.length === 1 ? 'column' : 'columns'}`,
			`${flatMembers.length} ${kindNoun}`,
			view === 'summary' ? 'summary' : 'every member',
			diffsOnly ? 'only differences' : '',
		]
			.filter(Boolean)
			.join(' · ');
		const cols = resolved.map((c, i) => ({ name: c.name, color: colors[i] }));
		return layoutMatrixImage(
			view === 'summary'
				? summaryImageInput(title, subtitle, cols, summaryGroups)
				: membersImageInput(
						title,
						subtitle,
						cols,
						memberHeaders.map((hs) => hs.map((h) => h.label)),
						memberGroups,
					),
		);
	});
</script>

<Nav />
<h1 class="sr-only">Compare {kindNoun}</h1>

<div class="toolbar">
	<nav class="kind-switch" aria-label="What to compare">
		<a href={resolve('/compare/tablets')} aria-current={kind === 'tablets' ? 'page' : undefined}
			>tablets</a
		>
		<a href={resolve('/compare/pens')} aria-current={kind === 'pens' ? 'page' : undefined}>pens</a>
	</nav>
	<span class="count"
		>{comparison.columns.length} of {MAX_COLUMNS} columns · {flatMembers.length} {kindNoun}</span
	>
	<span class="spacer"></span>
	{#if activeTab === 'specs' && resolved.length > 0}
		<SegmentedControl
			ariaLabel="Group display"
			options={[
				{ value: 'summary', label: 'summary' },
				{ value: 'members', label: 'members' },
			]}
			bind:value={view}
		/>
		<label class="diffs">
			<input type="checkbox" bind:checked={diffsOnly} />
			only differences{hiddenCount > 0 && view === 'summary' ? ` (hides ${hiddenCount})` : ''}
		</label>
		<Button variant="subtle" onclick={copyMarkdown}>{mdStatus || 'copy markdown'}</Button>
		<Button variant="subtle" onclick={() => (showExport = true)}>export</Button>
		<ChartExportButton
			label="image ▾"
			title="{kind === 'tablets' ? 'Tablet' : 'Pen'} comparison"
			filename="{kind}-comparison"
			getSvg={() => imageSvg}
		/>
	{/if}
	{#if resolved.length > 0}
		<Button variant="subtle" onclick={() => update(() => emptyComparison(kind))}>clear</Button>
	{/if}
</div>

<div class="workspace">
	<AddRail
		{candidates}
		{flagged}
		columns={resolved.map((c) => ({ id: c.id, name: c.name }))}
		{full}
		searchLabel={kind === 'tablets'
			? 'Search tablets and families'
			: 'Search pens, families and units'}
		{presence}
		onadd={(ref) => update((c) => addRef(c, ref))}
		onaddto={(ref, id) => update((c) => addRef(intoGroup(c, id), ref, id))}
	/>
	<div class="main">
		{#if resolved.length === 0}
			<EmptyState>
				Nothing to compare yet. Search on the left and add {kindNoun} or whole families — each becomes
				a column — or use <strong>Compare</strong> on any {kind === 'tablets' ? 'tablet' : 'pen'} or family
				page.
			</EmptyState>
		{:else}
			<Tabs tabs={[{ id: 'specs', label: 'Specs' }, ...extraTabs]} bind:active={activeTab} />
			{#if activeTab === 'specs'}
				<CompareMatrix
					columns={resolved}
					{colors}
					{view}
					{summaryGroups}
					{memberGroups}
					{memberHeaders}
					{overlaps}
					{full}
					familyMembersOf={(columnId, familyId) => {
						const excluded = comparison.columns.find((c) => c.id === columnId)?.excluded ?? [];
						return ctx.familyMembers(familyId).map((m) => ({
							...memberHeader(m),
							included: !excluded.includes(ctx.modelId(m)),
						}));
					}}
					ondrop={handleDrop}
					onremovecolumn={(id) => update((c) => removeColumn(c, id))}
					onremoveref={(id, ref) => update((c) => removeRef(c, id, ref))}
					onrename={(id, name) => update((c) => renameColumn(c, id, name))}
					onmoveref={(from, to, ref) => update((c) => moveTo(c, from, to, ref))}
					onmerge={(from, to) => update((c) => mergeColumns(intoGroup(c, to), from, to))}
					ontoggleexcluded={(id, modelId) => update((c) => toggleExcluded(c, id, modelId))}
					onnewgroup={() => update((c) => newGroup(c))}
				/>
				{#if view === 'summary'}
					<p class="legend">
						A range is smallest – largest across a column's {kindNoun}; <em>varies</em> means they differ.
						Shaded rows differ between columns. — = not recorded.
					</p>
				{/if}
			{:else if views}
				{@render views(activeTab, resolved, colors)}
			{/if}
		{/if}
	</div>
</div>

{#if activeTab === 'specs' && resolved.length > 0}
	<CompareMatrixImage layout={imageLayout} bind:svg={imageSvg} />
{/if}

{#if showExport}
	<ExportDialog
		entityType="{kind}-comparison"
		title="Export {kindNoun} comparison"
		filename="{kind}-comparison"
		headers={exportHeaders}
		rows={exportRows}
		onclose={() => (showExport = false)}
	/>
{/if}

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
		margin: 4px 0 16px 0;
	}

	.kind-switch {
		display: flex;
		gap: 18px;
	}

	.kind-switch a {
		font-size: var(--type-subhead);
		letter-spacing: var(--track-tight);
		text-transform: lowercase;
		color: var(--text-dim);
		text-decoration: none;
		padding-bottom: 2px;
		border-bottom: 2px solid transparent;
	}

	.kind-switch a:hover {
		color: var(--text-muted);
	}

	.kind-switch a[aria-current='page'] {
		color: var(--text);
		border-bottom-color: var(--accent);
	}

	.count {
		font-size: var(--type-caption);
		color: var(--text-muted);
	}

	.spacer {
		flex-grow: 1;
	}

	.diffs {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--type-caption);
		color: var(--text-muted);
		cursor: pointer;
	}

	.workspace {
		display: flex;
		gap: 24px;
		align-items: flex-start;
	}

	.main {
		flex-grow: 1;
		min-width: 0;
	}

	.legend {
		font-size: var(--type-caption);
		color: var(--text-dim);
		margin: 12px 0 0 0;
	}

	/* Stacked: stretch, so the matrix scrolls inside its own wrapper instead
	   of widening the page. */
	@media (max-width: 900px) {
		.workspace {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
