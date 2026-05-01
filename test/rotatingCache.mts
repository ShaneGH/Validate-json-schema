
import { test } from 'node:test';
import assert from 'node:assert';
import { create, get, NOT_FOUND, put, RotatingCache } from '../src/rotatingCache.js';

test('rotatingCache', { concurrency: true }, t => {
    function verifyCacheKeys(cache: RotatingCache<number>, expectLength: number) {
        const keys = Object.keys(cache.items)
        assert.equal(keys.length, cache.evictionsHeap.length)
        assert.equal(keys.length, expectLength)

        for (const k of keys) {
            assert.equal(1, cache.evictionsHeap.filter(x => x.key === k).length)

            assert.equal(cache.items[k].data, parseInt(k))
            assert.equal(cache.items[k].evictionTracker.key, k)
        }

        for (let i = 0; i < cache.evictionsHeap.length; i++) {
            assert.equal(i, cache.evictionsHeap[i].heapIndex)
        }
    }

    const cacheSize = 20
    const cache = create<number>(cacheSize)
    for (let i = 0; i < cacheSize; i++) {
        put(cache, i.toString(), i)
        verifyCacheKeys(cache, i + 1)
    }

    for (let i = 0; i < cacheSize; i++) {
        assert.equal(get(cache, i.toString()), i)
        verifyCacheKeys(cache, cache.evictionsHeap.length)
    }

    assert.equal(get(cache, cacheSize.toString()), NOT_FOUND)

    const next1 = cacheSize * 100
    const next2 = next1 + 1
    const next3 = next2 + 1

    put(cache, next1.toString(), next1)
    verifyCacheKeys(cache, cacheSize)
    assert.equal(get(cache, next1.toString()), next1)
    assert.equal(get(cache, "0"), NOT_FOUND)

    put(cache, next2.toString(), next2)
    verifyCacheKeys(cache, cacheSize)
    assert.equal(get(cache, next2.toString()), next2)
    assert.equal(get(cache, "1"), NOT_FOUND)

    get(cache, "2")
    put(cache, next3.toString(), next3)
    verifyCacheKeys(cache, cacheSize)
    assert.equal(get(cache, next3.toString()), next3)
    assert.equal(get(cache, "3"), NOT_FOUND)
});