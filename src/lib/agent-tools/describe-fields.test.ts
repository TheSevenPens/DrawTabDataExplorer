import { describe, expect, it } from 'vitest';
import { describeFields, type DescribableField } from './describe-fields.js';

type Tablet = { Digitizer?: { SupportsTouch?: string; Tilt?: string } };

// The real definitions these are copied from, verbatim in shape, are in
// data-repo/lib/entities/tablet-fields.ts. DigitizerSupportsTouch is the field
// whose value domain an agent got wrong in the wild.
const FIELDS: DescribableField<Tablet>[] = [
	{
		key: 'DigitizerSupportsTouch',
		label: 'Touch',
		type: 'enum',
		enumValues: ['YES', 'NO'],
		group: 'Digitizer',
		getValue: (t) => t.Digitizer?.SupportsTouch ?? '',
	},
	{
		key: 'DigitizerTilt',
		label: 'Tilt (degrees)',
		type: 'number',
		group: 'Digitizer',
		unit: 'degrees',
		getValue: (t) => t.Digitizer?.Tilt ?? '',
	},
	{
		key: 'ModelBrand',
		label: 'Brand',
		type: 'string',
		group: 'Model',
		getValue: () => 'WACOM',
	},
];

const T = (touch?: string, tilt?: string): Tablet => ({ Digitizer: { SupportsTouch: touch, Tilt: tilt } });

describe('describeFields', () => {
	// The whole reason the tool exists: "enum" alone does not prevent an agent
	// filtering on boolean `true` and getting a confident zero.
	it('surfaces the allowed values for an enum field', () => {
		const { fields } = describeFields('tablet', FIELDS);
		const touch = fields.find((f) => f.key === 'DigitizerSupportsTouch');
		expect(touch?.type).toBe('enum');
		expect(touch?.enumValues).toEqual(['YES', 'NO']);
	});

	it('copies enumValues rather than aliasing the source array', () => {
		const { fields } = describeFields('tablet', FIELDS);
		fields.find((f) => f.key === 'DigitizerSupportsTouch')!.enumValues!.push('MAYBE');
		expect(FIELDS[0].enumValues).toEqual(['YES', 'NO']);
	});

	it('sections fields by group the way the UI does', () => {
		const { groups } = describeFields('tablet', FIELDS);
		expect(groups.Digitizer).toEqual(['DigitizerSupportsTouch', 'DigitizerTilt']);
		expect(groups.Model).toEqual(['ModelBrand']);
	});

	it('filters by group, case-insensitively, and still reports the true total', () => {
		const r = describeFields('tablet', FIELDS, { groups: ['digitizer'] });
		expect(r.fields.map((f) => f.key)).toEqual(['DigitizerSupportsTouch', 'DigitizerTilt']);
		expect(r.totalFields).toBe(3);
	});

	it('filters by key', () => {
		const r = describeFields('tablet', FIELDS, { keys: ['ModelBrand'] });
		expect(r.fields.map((f) => f.key)).toEqual(['ModelBrand']);
	});

	it('omits fill rates entirely when no sample is given', () => {
		const r = describeFields('tablet', FIELDS);
		expect(r.sampled).toBe(0);
		expect(r.fields.every((f) => f.fillRate === undefined)).toBe(true);
	});

	// A 25%-populated field is queryable and practically a dead end; an agent
	// that filters on it reports "no matches" when the truth is "not recorded".
	it('computes fill rate from the sample', () => {
		const sample = [T('YES', '60'), T('NO'), T(undefined, '60'), T('  ')];
		const r = describeFields('tablet', FIELDS, { sample });
		const byKey = Object.fromEntries(r.fields.map((f) => [f.key, f.fillRate]));
		expect(r.sampled).toBe(4);
		expect(byKey.DigitizerSupportsTouch).toBe(0.5); // whitespace is not a value
		expect(byKey.DigitizerTilt).toBe(0.5);
		expect(byKey.ModelBrand).toBe(1);
	});

	it('reports a getter that threw instead of swallowing it', () => {
		const boom: DescribableField<Tablet>[] = [
			{
				key: 'Explodes',
				label: 'Explodes',
				type: 'string',
				group: 'Digitizer',
				getValue: () => {
					throw new Error('sparse row');
				},
			},
		];
		const r = describeFields('tablet', boom, { sample: [T('YES')] });
		expect(r.errored).toEqual(['Explodes']);
		expect(r.fields[0].fillRate).toBe(0);
	});
});
