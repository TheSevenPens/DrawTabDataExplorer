import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createQueryRunner,
	describeError,
	toCloneable,
	type RunReply,
	type RunRequest,
	type WorkerLike,
} from './query-runner.js';

// A fake worker the test drives by hand: it records what it was sent and
// replies only when told to, like a worker running user code would.
class FakeWorker implements WorkerLike {
	sent: RunRequest[] = [];
	terminated = false;
	onmessage: ((e: MessageEvent<RunReply>) => void) | null = null;
	onerror: ((e: ErrorEvent) => void) | null = null;
	postMessage(m: RunRequest) {
		this.sent.push(m);
	}
	terminate() {
		this.terminated = true;
	}
	reply(r: RunReply) {
		this.onmessage?.({ data: r } as MessageEvent<RunReply>);
	}
}

const ctx = { baseUrl: '', userId: 'sevenpens' };

describe('createQueryRunner', () => {
	let workers: FakeWorker[];
	let clock: number;
	const make = () => {
		const w = new FakeWorker();
		workers.push(w);
		return w;
	};

	beforeEach(() => {
		vi.useFakeTimers();
		workers = [];
		clock = 0;
	});
	afterEach(() => vi.useRealTimers());

	it('posts the code and resolves with the worker reply', async () => {
		const runner = createQueryRunner(make, { timeoutMs: 1000, now: () => clock });
		const p = runner.run('return 1', ctx);
		const [req] = workers[0].sent;
		expect(req).toMatchObject({ code: 'return 1', baseUrl: '', userId: 'sevenpens' });
		workers[0].reply({ id: req.id, ok: true, value: 1, elapsedMs: 5 });
		await expect(p).resolves.toEqual({ kind: 'ok', value: 1, elapsedMs: 5 });
	});

	it('reports a thrown error from the worker', async () => {
		const runner = createQueryRunner(make, { timeoutMs: 1000 });
		const p = runner.run('throw 1', ctx);
		workers[0].reply({ id: workers[0].sent[0].id, ok: false, error: 'Error: boom', elapsedMs: 2 });
		await expect(p).resolves.toEqual({ kind: 'error', message: 'Error: boom', elapsedMs: 2 });
	});

	it('Stop terminates the worker and the next run uses a new one', async () => {
		const runner = createQueryRunner(make, { timeoutMs: 1000, now: () => clock });
		const p = runner.run('while (true) {}', ctx);
		clock = 250;
		runner.stop();
		await expect(p).resolves.toEqual({ kind: 'stopped', reason: 'user', elapsedMs: 250 });
		expect(workers[0].terminated).toBe(true);
		runner.run('return 2', ctx);
		expect(workers).toHaveLength(2);
	});

	it('times out a run that never replies', async () => {
		const runner = createQueryRunner(make, { timeoutMs: 1000, now: () => clock });
		const p = runner.run('while (true) {}', ctx);
		clock = 1000;
		vi.advanceTimersByTime(1000);
		await expect(p).resolves.toEqual({ kind: 'stopped', reason: 'timeout', elapsedMs: 1000 });
		expect(workers[0].terminated).toBe(true);
	});

	it('reuses the worker (and its dataset cache) across finished runs', async () => {
		const runner = createQueryRunner(make, { timeoutMs: 1000 });
		const a = runner.run('return 1', ctx);
		workers[0].reply({ id: workers[0].sent[0].id, ok: true, value: 1, elapsedMs: 1 });
		await a;
		runner.run('return 2', ctx);
		expect(workers).toHaveLength(1);
		expect(workers[0].sent).toHaveLength(2);
	});

	it('ignores a late reply from a run that was already stopped', async () => {
		const runner = createQueryRunner(make, { timeoutMs: 1000 });
		const first = runner.run('slow()', ctx);
		const staleId = workers[0].sent[0].id;
		runner.stop();
		await first;
		const second = runner.run('return 2', ctx);
		workers[0].reply({ id: staleId, ok: true, value: 'stale', elapsedMs: 1 });
		workers[1].reply({ id: workers[1].sent[0].id, ok: true, value: 2, elapsedMs: 1 });
		await expect(second).resolves.toMatchObject({ kind: 'ok', value: 2 });
	});

	it('a worker-level error settles the run and resets the worker', async () => {
		const runner = createQueryRunner(make, { timeoutMs: 1000 });
		const p = runner.run('return 1', ctx);
		workers[0].onerror?.({ message: 'Failed to load module' } as ErrorEvent);
		await expect(p).resolves.toMatchObject({ kind: 'error', message: 'Failed to load module' });
		expect(workers[0].terminated).toBe(true);
	});
});

describe('toCloneable', () => {
	it('passes plain data, arrays and Maps through unchanged', () => {
		const data = { a: [1, 'x'], m: new Map([['k', 1]]) };
		expect(toCloneable(data)).toBe(data);
	});

	it('reduces values with functions to their JSON view', () => {
		const withFn = { n: 1, f: () => 2 };
		expect(toCloneable(withFn)).toEqual({ n: 1 });
	});

	it('keeps undefined, and describes values JSON cannot represent', () => {
		expect(toCloneable(undefined)).toBeUndefined();
		const cyclic: Record<string, unknown> = { f: () => 1 };
		cyclic.self = cyclic;
		expect(toCloneable(cyclic)).toMatch(/^<<unserializable: /);
	});
});

describe('describeError', () => {
	it('formats Errors as Name: message and other throws with String()', () => {
		expect(describeError(new TypeError('x is not a function'))).toBe(
			'TypeError: x is not a function',
		);
		expect(describeError(42)).toBe('42');
	});
});
