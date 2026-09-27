import { createTabletSpecsTool, type TabletSpecsContext } from './tablet-specs.js';

export interface OpenTabletSpecsContext extends TabletSpecsContext {
	navigate: (url: string) => Promise<void>;
}

export function createOpenTabletSpecsTool(context: OpenTabletSpecsContext) {
	const lookup = createTabletSpecsTool(context);
	return {
		name: 'open_tablet_specs',
		description:
			'Open a drawing tablet in the Explorer browser with its Specs tab selected. Use when the user wants to see specs in the browser. Accepts a name, alternate name, model ID or EntityId. Returns candidates without navigating when ambiguous. For specs in chat, use lookup_tablet_specs.',
		inputSchema: lookup.inputSchema,
		annotations: { readOnlyHint: false, consequentialHint: false },
		async execute(input: unknown) {
			const result = await lookup.execute(input);
			if (result.status === 'ambiguous')
				return {
					...result,
					message:
						'Multiple tablets match. Choose an entityId from the candidates and call open_tablet_specs again. Refine the query if the desired model is not listed.',
				};
			if (result.status !== 'found') return result;

			const url = new URL(result.tablet.url);
			url.hash = 'specs';
			const tablet = { ...result.tablet, url: url.href };
			try {
				// Use the app router and existing hash-to-tab behavior, without DOM clicks.
				await context.navigate(url.href);
				return { status: 'opened' as const, tablet, source: result.source };
			} catch {
				return {
					status: 'navigation_failed' as const,
					tablet,
					message:
						'The tablet was found, but its Specs tab could not be opened. Retry or open the returned URL.',
				};
			}
		},
	};
}
