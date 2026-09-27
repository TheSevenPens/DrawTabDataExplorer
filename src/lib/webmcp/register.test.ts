import { describe, expect, it, vi } from 'vitest';
import { registerExplorerTools, type ModelContext } from './register.js';

const context = {
	loadTablets: vi.fn(async () => []),
	baseUrl: 'https://example.org/',
	version: null,
	navigate: vi.fn(async () => {}),
	setTabletComparison: vi.fn(),
};

describe('WebMCP registration', () => {
	it('does nothing in browsers without the experimental API', () => {
		const dispose = registerExplorerTools(document, context);
		expect(dispose).not.toThrow();
		expect(context.loadTablets).not.toHaveBeenCalled();
		expect(context.navigate).not.toHaveBeenCalled();
		expect(context.setTabletComparison).not.toHaveBeenCalled();
	});

	it('registers all tools with distinct annotations and cleans up every registration', () => {
		const registerTool = vi.fn<ModelContext['registerTool']>();
		const doc = Object.assign(document.implementation.createHTMLDocument(), {
			modelContext: { registerTool },
		});
		const dispose = registerExplorerTools(doc, context);
		expect(registerTool).toHaveBeenCalledTimes(5);
		expect(
			registerTool.mock.calls.map(([tool]) => [tool.name, tool.annotations.readOnlyHint]),
		).toEqual([
			['lookup_tablet_specs', true],
			['open_tablet_specs', false],
			['compare_tablet_sizes', false],
			['query_tablets', true],
			['open_tablet_query', false],
		]);
		for (const [, options] of registerTool.mock.calls) expect(options.signal.aborted).toBe(false);
		dispose();
		for (const [, options] of registerTool.mock.calls) expect(options.signal.aborted).toBe(true);
	});

	it.each(['sync', 'async'])(
		'contains %s registration failures so the UI keeps working',
		async (kind) => {
			const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
			try {
				const registerTool = () => {
					if (kind === 'sync') throw new Error('disabled');
					return Promise.reject(new Error('disabled'));
				};
				const doc = Object.assign(document.implementation.createHTMLDocument(), {
					modelContext: { registerTool },
				});
				expect(() => registerExplorerTools(doc, context)).not.toThrow();
				await Promise.resolve();
				expect(warning).toHaveBeenCalledTimes(5);
			} finally {
				warning.mockRestore();
			}
		},
	);
});
