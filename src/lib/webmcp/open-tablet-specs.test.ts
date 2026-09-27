import { beforeAll, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { createDiskDataSet } from '$data/lib/dataset-node.js';
import type { Tablet } from '$data/lib/drawtab-loader.js';
import { createOpenTabletSpecsTool } from './open-tablet-specs.js';

const baseUrl = 'https://thesevenpens.github.io/DrawTabDataExplorer/';
let tablets: Tablet[];
beforeAll(async () => {
	const ds = createDiskDataSet({ dataDir: path.resolve('data-repo/data'), userId: 'sevenpens' });
	tablets = await ds.Tablets.toArray();
});

describe('opening tablet specs through WebMCP', () => {
	it('opens the resolved tablet directly on Specs and preserves the deployment base path', async () => {
		let completeNavigation!: () => void;
		const navigate = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					completeNavigation = resolve;
				}),
		);
		const tool = createOpenTabletSpecsTool({
			loadTablets: async () => tablets,
			baseUrl,
			version: null,
			navigate,
		});
		let completed = false;
		const execution = tool.execute({ query: 'Wacom PTH660' }).then((result) => {
			completed = true;
			return result;
		});
		await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce());
		const url = `${baseUrl}entity/wacom.tablet.pth660#specs`;
		expect(navigate).toHaveBeenCalledWith(url);
		expect(completed).toBe(false);
		completeNavigation();
		expect(await execution).toMatchObject({
			status: 'opened',
			tablet: { entityId: 'wacom.tablet.pth660', url },
		});
	});

	it.each([
		[{ query: 'Wacom Intuos Small' }, 'ambiguous'],
		[{ query: 'nonexistent-tablet-xyz' }, 'not_found'],
		[{ query: '' }, 'invalid_input'],
	])('leaves the current page alone for %j', async (input, status) => {
		const navigate = vi.fn(async () => {});
		const result = await createOpenTabletSpecsTool({
			loadTablets: async () => tablets,
			baseUrl,
			version: null,
			navigate,
		}).execute(input);
		expect(result.status).toBe(status);
		if (result.status === 'ambiguous')
			expect(result.message).toContain('call open_tablet_specs again');
		expect(navigate).not.toHaveBeenCalled();
	});

	it('does not navigate when the dataset is unavailable', async () => {
		const navigate = vi.fn(async () => {});
		const result = await createOpenTabletSpecsTool({
			loadTablets: async () => [],
			baseUrl,
			version: null,
			navigate,
		}).execute({ query: 'PTH660' });
		expect(result.status).toBe('unavailable');
		expect(navigate).not.toHaveBeenCalled();
	});

	it('reports navigation failure without claiming the Specs tab opened', async () => {
		const navigate = vi.fn(async () => {
			throw new Error('navigation cancelled');
		});
		const result = await createOpenTabletSpecsTool({
			loadTablets: async () => tablets,
			baseUrl,
			version: null,
			navigate,
		}).execute({ query: 'PTH660' });
		expect(result).toMatchObject({
			status: 'navigation_failed',
			tablet: { url: `${baseUrl}entity/wacom.tablet.pth660#specs` },
		});
	});
});
