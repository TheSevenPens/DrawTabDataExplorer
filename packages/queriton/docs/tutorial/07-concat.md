# 7. Concat

In this chapter you'll combine two Queries vertically with `.concat()` — SQL's `UNION ALL` by another name.

## The basic shape

`.concat(other)` appends every row from the other Query to the rows of this one. There's no deduplication; if both sides have the same row, both copies appear in the result.

```ts run
const orderRows = await ordersQ().toArray();
const customerOrders = await ordersQ().concat(ordersQ()).toArray();
expect(customerOrders).toHaveLength(orderRows.length * 2);
```

`.union()` is a synonym for `.concat()` — use whichever name reads better in context. queriton has no `union distinct` verb; chain `.distinct()` (or roll your own via `.summarize({ by: ... })`) if you need dedup.

## Concat with different row shapes

Both sides don't have to share a type. The result widens to `T | U`:

```ts run
type Match = { kind: string; id: string };
const onlineRows: Match[] = [
	{ kind: 'online', id: 'O1' },
	{ kind: 'online', id: 'O2' },
];
const physicalRows: Match[] = [{ kind: 'physical', id: 'P1' }];
const fieldDef = [
	{ key: 'kind', label: 'kind', type: 'string' as const, getValue: (r: Match) => r.kind },
	{ key: 'id', label: 'id', type: 'string' as const, getValue: (r: Match) => r.id },
];
const online = new Query<Match>(async () => onlineRows, fieldDef);
const physical = new Query<Match>(async () => physicalRows, fieldDef);

const combined = await online.concat(physical).toArray();
expect(combined.map((r) => r.id)).toEqual(['O1', 'O2', 'P1']);
```

## Field-def merging

When the two sides have different field arrays, the result's active field-defs are the union (first-defined wins on collisions). Downstream `.filter()` / `.sort()` work against that merged set. In practice it's simplest to make sure both sides expose the columns you intend to query — the rest is automatic.

## When to use it

`.concat()` is useful when you have multiple Queries of the same conceptual shape coming from different sources, and you want to treat them as one stream — combining "open orders" with "archived orders," or merging "this season's sessions" with "last season's." It's also the natural way to materialise a tiny lookup table inline and append it to a larger feed.

In the next chapter we'll meet the DataSet — queriton's named-collection container.
