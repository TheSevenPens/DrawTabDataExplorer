// Worker side of the API Explorer runner (see query-runner.ts, GitHub #348).
// User code runs here, as the body of an async function with `ds` in scope,
// so a runaway query blocks this thread — not the page — and the page can
// terminate it.

import { DrawTabDataSet } from '$data/lib/dataset.js';
import { describeError, toCloneable, type RunReply, type RunRequest } from './query-runner.js';

// One dataset per worker, reused across runs so later queries hit the
// collection cache — the same behaviour the page had before.
let ds: DrawTabDataSet | null = null;
let dsKey = '';

self.onmessage = async (e: MessageEvent<RunRequest>) => {
	const { id, code, baseUrl, userId } = e.data;
	const key = `${baseUrl}|${userId}`;
	if (!ds || key !== dsKey) {
		ds = new DrawTabDataSet({ kind: 'url', baseUrl, userId });
		dsKey = key;
	}
	const start = performance.now();
	const elapsed = () => Math.round(performance.now() - start);
	let reply: RunReply;
	try {
		const fn = new Function('ds', `return (async () => { ${code} })()`) as (
			d: DrawTabDataSet,
		) => Promise<unknown>;
		const value = await fn(ds);
		reply = { id, ok: true, value: toCloneable(value), elapsedMs: elapsed() };
	} catch (err) {
		reply = { id, ok: false, error: describeError(err), elapsedMs: elapsed() };
	}
	self.postMessage(reply);
};
