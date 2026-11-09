import { describe, it, expect } from 'vitest';
import { timeAsync, timeAsyncThrow } from '../../src/utils/timeAsync';

describe('timeAsync', () => {
    it('returns success with value and non-negative duration', async () => {
        const result = await timeAsync('test-op', async () => 42);

        expect(result.status).toBe('success');
        expect(result.value).toBe(42);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.error).toBeUndefined();
    });

    it('returns error without throwing', async () => {
        const result = await timeAsync('test-op', async () => {
            throw new Error('boom');
        }, { channel: 'xml-feed' });

        expect(result.status).toBe('error');
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error!.message).toBe('boom');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('normalizes non-Error rejections', async () => {
        const result = await timeAsync('test-op', async () => {
            throw 'string failure';
        });

        expect(result.status).toBe('error');
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error!.message).toBe('string failure');
    });

    it('resolves the wrapped value from the promise (async path)', async () => {
        let resolved = false;
        const result = await timeAsync('test-op', async () => {
            await new Promise(r => setTimeout(r, 5));
            resolved = true;
            return 'done';
        });

        expect(resolved).toBe(true);
        expect(result.value).toBe('done');
        // allow ~1 ms: Node timers may fire marginally early and Math.round can shave another
        expect(result.durationMs).toBeGreaterThanOrEqual(4);
    });
});

describe('timeAsyncThrow', () => {
    it('returns the value on success', async () => {
        const value = await timeAsyncThrow('test-op', async () => 'ok');
        expect(value).toBe('ok');
    });

    it('rethrows the original error after logging', async () => {
        const original = new Error('original failure');
        await expect(
            timeAsyncThrow('test-op', async () => { throw original; })
        ).rejects.toBe(original);
    });
});
