import { describe, it, expect } from 'vitest';
import Property from '../../../src/models/Property';

/**
 * C13: the query patterns used by the application must be covered by indexes.
 * (Index *selection* is planner-dependent on tiny datasets, so these tests pin
 * index *existence*; live-plan verification runs against the dev database.)
 */
describe('Property indexes (C13)', () => {
    it('defines an index for the default listing query (status + newest, not deleted)', async () => {
        const indexes = await Property.listIndexes();
        const keys = indexes.map(ix => JSON.stringify(ix.key));

        expect(keys).toContain(JSON.stringify({ status: 1, createdAt: -1 }));
    });

    it('defines an index for the featured section (featured + recency, not deleted)', async () => {
        const indexes = await Property.listIndexes();
        const keys = indexes.map(ix => JSON.stringify(ix.key));

        expect(keys).toContain(JSON.stringify({ featured: 1, updatedAt: -1 }));
    });

    it('defines the geospatial and city indexes', async () => {
        const indexes = await Property.listIndexes();
        const keys = indexes.map(ix => JSON.stringify(ix.key));

        expect(keys).toContain(JSON.stringify({ location: '2dsphere' }));
        expect(keys).toContain(JSON.stringify({ cityLower: 1 }));
    });

    it('partial indexes only cover non-deleted documents', async () => {
        const indexes = await Property.listIndexes();
        const listing = indexes.find(ix => JSON.stringify(ix.key) === JSON.stringify({ status: 1, createdAt: -1 }));

        expect(listing?.partialFilterExpression).toEqual({ deletedAt: null });
    });
});
