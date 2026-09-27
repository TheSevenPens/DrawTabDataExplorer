<script lang="ts">
	// Agent note: keep this short reference aligned with src/lib/webmcp/register.ts
	// and each tool's inputSchema. Detailed behavior lives in docs/AGENT-READABILITY.md.
	const tools = [
		{
			name: 'lookup_tablet_specs',
			description: 'Return a tablet’s specifications for an answer in chat.',
			input: { query: 'Wacom PTK870' },
		},
		{
			name: 'open_tablet_specs',
			description: 'Open a tablet in the browser with its Specs tab selected.',
			input: { query: 'Wacom PTH660' },
		},
		{
			name: 'compare_tablet_sizes',
			description:
				'Show an active drawing area size comparison for 2–8 tablets. Replaces the working tablet comparison and opens Sizes.',
			input: { tablets: ['PTH660', 'PTK670'] },
		},
		{
			name: 'query_tablets',
			description: 'Return matching tablets for an answer in chat, with optional size ranking.',
			input: { tabletType: 'PENDISPLAY', releaseYear: 2026 },
		},
		{
			name: 'open_tablet_query',
			description: 'Run the same query and open the filtered, sorted Tablets list in the browser.',
			input: { tabletType: 'PENTABLET', sortBy: 'activeArea' },
		},
	];
</script>

<svelte:head>
	<title>Agents — DrawTab Data Explorer</title>
	<meta
		name="description"
		content="WebMCP tools for tablet specifications, visual size comparisons, filtering and size ranking in DrawTab Data Explorer."
	/>
</svelte:head>

<h1 class="sr-only">Agents</h1>

<div class="agent-reference">
	<h2>WebMCP tools</h2>
	<p>
		Explorer supports WebMCP. Compatible browser agents can discover and call these tools from any
		page. Ask your agent in chat for data or a browser view.
	</p>

	<div class="table-wrap">
		<table aria-label="Available WebMCP tools">
			<thead>
				<tr>
					<th scope="col">Tool</th>
					<th scope="col">What it does</th>
					<th scope="col">Example input</th>
				</tr>
			</thead>
			<tbody>
				{#each tools as tool (tool.name)}
					<tr>
						<td><code>{tool.name}</code></td>
						<td>{tool.description}</td>
						<td><code>{JSON.stringify(tool.input)}</code></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<h2>Inputs at a glance</h2>
	<p>
		Specs and comparisons accept tablet names, model IDs or EntityIds. Ambiguous names return
		candidates for the agent to choose from.
	</p>
	<p>
		Both query tools accept <code>tabletType</code> (<code>PENTABLET</code>,
		<code>PENDISPLAY</code> or <code>STANDALONE</code>), an exact <code>releaseYear</code>, and
		<code>sortBy: "activeArea"</code>. Provide at least one of these. With <code>sortBy</code>,
		<code>sortDirection</code> is <code>"desc"</code> (largest first, the default) or
		<code>"asc"</code> (smallest first).
	</p>
	<p>
		Size means active drawing area: width × height. Rankings include discontinued models and omit
		models without usable area data. Queries use Explorer’s recorded data and the regular Tablets
		list; advanced Query Builder operations are not yet exposed through WebMCP.
	</p>
</div>

<style>
	.agent-reference {
		max-width: 1100px;
	}

	h2 {
		font-size: var(--type-subhead);
		font-weight: 600;
		margin: 0 0 10px;
	}

	p {
		line-height: 1.6;
		margin: 0 0 12px;
	}

	.table-wrap {
		margin: 20px 0 28px;
	}

	td {
		white-space: normal;
		vertical-align: top;
	}

	td:first-child {
		white-space: nowrap;
	}

	code {
		font-size: var(--type-caption);
		overflow-wrap: anywhere;
	}
</style>
