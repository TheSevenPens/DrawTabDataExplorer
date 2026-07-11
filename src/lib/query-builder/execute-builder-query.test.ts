import { describe, it, expect, vi } from 'vitest';
import { applyFilters, executeBuilderQuery } from './execute-builder-query.js';
import type { Query } from '@thesevenpens/queriton';

function mockQuery(): Query<unknown> & {
	calls: string[];
} {
	const calls: string[] = [];
	const chain = {
		calls,
		filter: vi.fn((...args: unknown[]) => {
			calls.push(`filter:${JSON.stringify(args)}`);
			return chain;
		}),
		filterIn: vi.fn((field: string, values: unknown[]) => {
			calls.push(`filterIn:${field}:${values.join(',')}`);
			return chain;
		}),
		select: vi.fn((cols: string[]) => {
			calls.push(`select:${cols.join(',')}`);
			return chain;
		}),
		sort: vi.fn((field: string, dir: string) => {
			calls.push(`sort:${field}:${dir}`);
			return chain;
		}),
		skip: vi.fn((n: number) => {
			calls.push(`skip:${n}`);
			return chain;
		}),
		take: vi.fn((n: number) => {
			calls.push(`take:${n}`);
			return chain;
		}),
		countBy: vi.fn((by: string | string[], opts: { countAlias?: string }) => {
			calls.push(`countBy:${Array.isArray(by) ? by.join('+') : by}:${opts.countAlias}`);
			return chain;
		}),
		distinct: vi.fn(async (field: string) => {
			calls.push(`distinct:${field}`);
			return ['A', 'B'];
		}),
		count: vi.fn(async () => {
			calls.push('count');
			return 42;
		}),
		toArray: vi.fn(async () => {
			calls.push('toArray');
			return [{ Brand: 'WACOM' }];
		}),
	};
	return chain as unknown as Query<unknown> & { calls: string[] };
}

describe('applyFilters', () => {
	it('maps in operator to filterIn', () => {
		const q = mockQuery();
		applyFilters(q, [{ field: 'Brand', operator: 'in', value: 'WACOM, HUION' }]);
		expect(q.filterIn).toHaveBeenCalledWith('Brand', ['WACOM', 'HUION']);
	});

	it('skips incomplete filters', () => {
		const q = mockQuery();
		applyFilters(q, [
			{ field: 'Brand', operator: '==', value: '' },
			{ field: 'ModelType', operator: '==', value: 'PENDISPLAY' },
		]);
		expect(q.calls).toEqual(['filter:["ModelType","==","PENDISPLAY"]']);
	});
});

describe('executeBuilderQuery', () => {
	it('runs toArray pipeline in order', async () => {
		const ds = {
			Tablets: mockQuery(),
			Pens: mockQuery(),
			PenCompat: mockQuery(),
			Drivers: mockQuery(),
			PressureResponse: mockQuery(),
		} as unknown as import('$data/lib/dataset.js').DrawTabDataSet;
		const q = ds.Tablets as ReturnType<typeof mockQuery>;
		await executeBuilderQuery(ds, {
			collection: 'Tablets',
			filters: [{ field: 'Brand', operator: '==', value: 'WACOM' }],
			sorts: [{ field: 'ModelLaunchYear', direction: 'desc' }],
			columns: ['Brand', 'ModelId'],
			take: 5,
			output: { mode: 'toArray' },
		});
		expect(q.calls).toEqual([
			'filter:["Brand","==","WACOM"]',
			'select:Brand,ModelId',
			'sort:ModelLaunchYear:desc',
			'take:5',
			'toArray',
		]);
	});

	it('runs distinct terminal', async () => {
		const ds = {
			Tablets: mockQuery(),
			Pens: mockQuery(),
			PenCompat: mockQuery(),
			Drivers: mockQuery(),
			PressureResponse: mockQuery(),
		} as unknown as import('$data/lib/dataset.js').DrawTabDataSet;
		const q = ds.Tablets as ReturnType<typeof mockQuery>;
		const result = await executeBuilderQuery(ds, {
			collection: 'Tablets',
			filters: [],
			sorts: [],
			columns: [],
			output: { mode: 'distinct', field: 'ModelType' },
		});
		expect(q.calls).toEqual(['distinct:ModelType']);
		expect(result).toEqual(['A', 'B']);
	});
});
