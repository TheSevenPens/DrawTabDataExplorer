// Runs API Explorer queries in a Web Worker that can be stopped (GitHub #348).
//
// The explorer used to run user code with `new Function` on the page's main
// thread, so `while (true) {}` froze the tab with no way out but closing
// it. Now the code runs in a module worker; the page stays responsive, and
// Stop — or the timeout — terminates the worker outright. The next run starts
// a fresh one.
//
// Not a security boundary: this is a local playground where people run their
// own code, and a Worker still has network access. If shared or linked
// scripts ever become a feature, that needs a separate-origin design, and a
// link must never auto-execute.

/** Page -> worker. */
export interface RunRequest {
	id: number;
	code: string;
	baseUrl: string;
	userId: string;
}

/** Worker -> page. */
export type RunReply =
	| { id: number; ok: true; value: unknown; elapsedMs: number }
	| { id: number; ok: false; error: string; elapsedMs: number };

export type RunOutcome =
	| { kind: 'ok'; value: unknown; elapsedMs: number }
	| { kind: 'error'; message: string; elapsedMs: number }
	| { kind: 'stopped'; reason: 'user' | 'timeout'; elapsedMs: number };

/**
 * Make a query result safe to post back. Structured-cloneable values (plain
 * data, arrays, Maps, Dates) pass through unchanged — hidden relationship
 * methods and Symbol-keyed computed values on dataset rows are simply not
 * copied. Anything else (a Query object, a function) is reduced to what
 * JSON.stringify would show, which is what the explorer displays anyway.
 */
export function toCloneable(value: unknown): unknown {
	if (value === undefined) return undefined;
	try {
		structuredClone(value);
		return value;
	} catch {
		try {
			const json = JSON.stringify(value);
			return json === undefined ? undefined : JSON.parse(json);
		} catch (e) {
			return `<<unserializable: ${e instanceof Error ? e.message : String(e)}>>`;
		}
	}
}

/** "Name: message" for Errors, String() for anything else thrown. */
export function describeError(e: unknown): string {
	return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

/** The minimum of the Worker API the runner uses — lets tests inject a fake. */
export interface WorkerLike {
	postMessage(message: RunRequest): void;
	terminate(): void;
	onmessage: ((e: MessageEvent<RunReply>) => void) | null;
	onerror: ((e: ErrorEvent) => void) | null;
}

export interface QueryRunnerOptions {
	/** Stop a run automatically after this long. */
	timeoutMs: number;
	now?: () => number;
}

export interface QueryRunner {
	/** Run `code`; resolves when it finishes, fails, is stopped or times out. */
	run(code: string, context: { baseUrl: string; userId: string }): Promise<RunOutcome>;
	/** Terminate the running query (no-op when idle). */
	stop(): void;
	/** Terminate the worker for good (page unmount). */
	dispose(): void;
}

export function createQueryRunner(
	makeWorker: () => WorkerLike,
	{ timeoutMs, now = () => performance.now() }: QueryRunnerOptions,
): QueryRunner {
	let worker: WorkerLike | null = null;
	let nextId = 1;
	let pending: {
		id: number;
		start: number;
		timer: ReturnType<typeof setTimeout>;
		resolve: (o: RunOutcome) => void;
	} | null = null;

	function settle(outcome: RunOutcome) {
		if (!pending) return;
		clearTimeout(pending.timer);
		const { resolve } = pending;
		pending = null;
		resolve(outcome);
	}

	function kill() {
		worker?.terminate();
		worker = null;
	}

	function halt(reason: 'user' | 'timeout') {
		if (!pending) return;
		const elapsedMs = Math.round(now() - pending.start);
		// The only way to interrupt synchronous user code is to terminate the
		// worker; the next run gets a new one (and a fresh dataset cache).
		kill();
		settle({ kind: 'stopped', reason, elapsedMs });
	}

	function ensureWorker(): WorkerLike {
		if (worker) return worker;
		const w = makeWorker();
		w.onmessage = (e) => {
			const reply = e.data;
			if (!pending || reply.id !== pending.id) return;
			settle(
				reply.ok
					? { kind: 'ok', value: reply.value, elapsedMs: reply.elapsedMs }
					: { kind: 'error', message: reply.error, elapsedMs: reply.elapsedMs },
			);
		};
		w.onerror = (e) => {
			// The worker itself failed (bad module, uncaught error outside the
			// run's try/catch). Report it and start clean next time.
			const elapsedMs = pending ? Math.round(now() - pending.start) : 0;
			kill();
			settle({ kind: 'error', message: e.message || 'The query worker failed.', elapsedMs });
		};
		worker = w;
		return w;
	}

	return {
		run(code, { baseUrl, userId }) {
			halt('user');
			const w = ensureWorker();
			const id = nextId++;
			return new Promise<RunOutcome>((resolve) => {
				pending = {
					id,
					start: now(),
					timer: setTimeout(() => halt('timeout'), timeoutMs),
					resolve,
				};
				w.postMessage({ id, code, baseUrl, userId });
			});
		},
		stop: () => halt('user'),
		dispose() {
			halt('user');
			kill();
		},
	};
}
