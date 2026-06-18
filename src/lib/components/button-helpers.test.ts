import { describe, it, expect } from 'vitest';
import { resolveButtonTitle } from './button-helpers.js';

describe('resolveButtonTitle', () => {
	it('returns the explicit title when not disabled', () => {
		expect(resolveButtonTitle({ title: 'Copy result' })).toBe('Copy result');
	});

	it('surfaces the disabled reason as the tooltip when disabled', () => {
		expect(
			resolveButtonTitle({ disabled: true, disabledReason: 'Maximum 6 tablets reached' }),
		).toBe('Maximum 6 tablets reached');
	});

	it('prefers the disabled reason over an explicit title when disabled', () => {
		expect(
			resolveButtonTitle({ disabled: true, disabledReason: 'No rows to export', title: 'Export' }),
		).toBe('No rows to export');
	});

	it('falls back to the title when disabled without a reason', () => {
		expect(resolveButtonTitle({ disabled: true, title: 'Export' })).toBe('Export');
	});

	it('returns undefined when neither title nor reason applies', () => {
		expect(resolveButtonTitle({})).toBeUndefined();
		expect(resolveButtonTitle({ disabledReason: 'reason but not disabled' })).toBeUndefined();
	});
});
