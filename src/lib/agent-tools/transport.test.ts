import { describe, expect, it, vi } from 'vitest';
import {
	detectBackend,
	noopBackend,
	registerTools,
	type AgentTool,
	type ToolBackend,
} from './transport.js';

const tool = (name: string): AgentTool => ({
	name,
	description: `does ${name}`,
	inputSchema: { type: 'object', properties: {} },
	handler: () => ({ ok: true }),
});

/** Records what a host would have received. */
function recordingBackend(): ToolBackend & { got: string[]; dropped: string[] } {
	const got: string[] = [];
	const dropped: string[] = [];
	return {
		kind: 'test',
		got,
		dropped,
		register: (t) => void got.push(t.name),
		unregister: (n) => void dropped.push(n),
	};
}

describe('detectBackend', () => {
	it('reports "none" when there is no navigator at all', () => {
		expect(detectBackend({}).kind).toBe('none');
	});

	it('reports "none" when navigator exists but exposes no tool API', () => {
		expect(detectBackend({ navigator: {} }).kind).toBe('none');
	});

	// The common case for every real visitor today. It must not throw.
	it('reports "none" when modelContext exists but has no registerTool', () => {
		expect(detectBackend({ navigator: { modelContext: {} } }).kind).toBe('none');
	});

	it('binds to navigator.modelContext.registerTool when present', () => {
		const registerTool = vi.fn();
		const backend = detectBackend({ navigator: { modelContext: { registerTool } } });
		expect(backend.kind).toBe('navigator.modelContext');
		backend.register(tool('a'));
		expect(registerTool).toHaveBeenCalledOnce();
	});

	// Withdrawal is optional in the proposal; absence must not become a crash.
	it('omits unregister when the host does not offer it', () => {
		const backend = detectBackend({ navigator: { modelContext: { registerTool: vi.fn() } } });
		expect(backend.unregister).toBeUndefined();
	});
});

describe('registerTools', () => {
	it('registers each tool once and reports the names', () => {
		const backend = recordingBackend();
		const { result } = registerTools([tool('a'), tool('b')], backend);
		expect(backend.got).toEqual(['a', 'b']);
		expect(result.registered).toEqual(['a', 'b']);
		expect(result.live).toBe(true);
	});

	// The accounting rule: `registered: 2` against a no-op is not success, and a
	// caller that cannot tell the difference will report agent support that
	// does not exist.
	it('marks a no-op registration as not live', () => {
		const { result } = registerTools([tool('a')], noopBackend);
		expect(result.registered).toEqual(['a']);
		expect(result.backend).toBe('none');
		expect(result.live).toBe(false);
	});

	it('keeps the first of a duplicated name and reports the rest', () => {
		const backend = recordingBackend();
		const { result } = registerTools([tool('a'), tool('a')], backend);
		expect(backend.got).toEqual(['a']);
		expect(result.duplicates).toEqual(['a']);
	});

	it('records a host rejection without aborting the remaining tools', () => {
		const backend: ToolBackend = {
			kind: 'test',
			register: (t) => {
				if (t.name === 'bad') throw new Error('rejected by host');
			},
		};
		const { result } = registerTools([tool('good'), tool('bad'), tool('also-good')], backend);
		expect(result.registered).toEqual(['good', 'also-good']);
		expect(result.failed).toEqual({ bad: 'rejected by host' });
	});

	it('withdraws only what it registered', () => {
		const backend = recordingBackend();
		const { dispose } = registerTools([tool('a'), tool('b')], backend);
		dispose();
		expect(backend.dropped).toEqual(['a', 'b']);
	});

	it('disposes silently when the host cannot withdraw', () => {
		const { dispose } = registerTools([tool('a')], noopBackend);
		expect(() => dispose()).not.toThrow();
	});
});
